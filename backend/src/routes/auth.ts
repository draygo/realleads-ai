/**
 * backend/src/routes/auth.ts
 * --------------------------------------------------------------------
 * Authentication & provisioning routes for RealLeads backend.
 *
 * Responsibilities:
 * 1. Provide an endpoint for the frontend OAuth callback to call
 *    after Supabase has authenticated the user (Google sign-in).
 * 2. Ensure that every authenticated email has a corresponding row
 *    in the internal `agents` table (create or update).
 * 3. Optional: expose a small debug endpoint `/api/auth/me` that
 *    returns the Supabase user given an access token.
 *
 * This file is imported in `src/server.ts` and mounted as:
 *
 *     app.use('/api/auth', authRouter);
 *
 * so the routes below are reachable as:
 *
 *   - POST /api/auth/provision
 *   - GET  /api/auth/me   (optional debug helper)
 *
 * --------------------------------------------------------------------
 */

import express, { Request, Response } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const authRouter = express.Router();

/**
 * --------------------------------------------------------------------
 * Supabase admin client
 * --------------------------------------------------------------------
 * We use the service-role key **only on the backend** so that this
 * router can:
 *  - Read / write any row in the database (e.g., `agents` table).
 *  - Call `auth.getUser(access_token)` for debugging.
 *
 * SECURITY NOTE:
 *  - Never expose the service-role key to the browser.
 *  - It should be stored in your Replit / server secrets only.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // We log this once on boot. If these are missing, the routes below
  // will send 500 errors with a clear message.
  console.error(
    '[auth.ts] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.'
  );
}

let supabaseAdmin: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      // On the server we usually don't persist sessions.
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Type describing the minimal shape of an "agent" record we care about
 * for upserting. Adjust this to match your Supabase `agents` table.
 *
 * Recommended table (simplified):
 *   create table agents (
 *     id uuid primary key default gen_random_uuid(),
 *     email text unique not null,
 *     name text,
 *     role text default 'agent',
 *     is_active boolean default true,
 *     last_login_at timestamptz default now(),
 *     created_at timestamptz default now(),
 *     updated_at timestamptz default now()
 *   );
 */
interface AgentUpsertPayload {
  email: string;
  name?: string | null;
  // Feel free to add additional fields as needed:
  // role?: string;
  // is_active?: boolean;
  // last_login_at?: string; // ISO date string
}

/**
 * Small helper to validate the JSON body for /provision.
 */
function parseProvisionBody(body: any): AgentUpsertPayload | null {
  if (!body || typeof body !== 'object') return null;

  const { email, name } = body;

  if (!email || typeof email !== 'string') {
    return null;
  }

  return {
    email: email.toLowerCase().trim(),
    name: typeof name === 'string' ? name.trim() : null,
  };
}

/**
 * --------------------------------------------------------------------
 * POST /api/auth/provision
 * --------------------------------------------------------------------
 * Called by the frontend (AuthCallback.tsx) *after* Supabase has
 * successfully created a session for a Google-authenticated user.
 *
 * Expected JSON body:
 *   {
 *     "email": "draygo@gmail.com",
 *     "name": "David Ray"
 *   }
 *
 * Behavior:
 *   - Validates that email is present.
 *   - Uses Supabase admin client to UPSERT into `agents` table on
 *     conflict by `email`.
 *   - Updates `last_login_at` so we always know the last sign-in time.
 *   - Returns the agent row as JSON so the frontend could store it
 *     if needed.
 *
 * Example success response (200):
 *   {
 *     "ok": true,
 *     "agent": { ...row from agents table... }
 *   }
 *
 * Example error response (4xx / 5xx):
 *   {
 *     "ok": false,
 *     "error": "Validation error",
 *     "message": "Missing or invalid email"
 *   }
 */

authRouter.post('/provision', async (req: Request, res: Response) => {
  // -------------------------------------------------------------------
  // Early checks for configuration.
  // -------------------------------------------------------------------
  if (!supabaseAdmin) {
    return res.status(500).json({
      ok: false,
      error: 'Server configuration error',
      message:
        'Supabase admin client is not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    });
  }

  // -------------------------------------------------------------------
  // 1. Validate request body
  // -------------------------------------------------------------------
  const payload = parseProvisionBody(req.body);

  if (!payload) {
    return res.status(400).json({
      ok: false,
      error: 'Validation error',
      message: 'Missing or invalid "email" in request body.',
    });
  }

  const { email, name } = payload;

  console.log('[auth.ts] /provision called for email:', email);

  try {
    // -----------------------------------------------------------------
    // 2. Prepare the row we want to upsert into `agents`.
    // -----------------------------------------------------------------
    const nowIso = new Date().toISOString();

    // IMPORTANT:
    //   Make sure these column names match your actual `agents` table.
    //   If you don't have `name` or `last_login_at`, remove or rename
    //   those properties here.
    const upsertRow: Record<string, any> = {
      email,
      name: name || email,
      last_login_at: nowIso,
    };

    // You can also set defaults here if you have these columns:
    // upsertRow.role = 'agent';
    // upsertRow.is_active = true;

    // -----------------------------------------------------------------
    // 3. Perform the upsert.
    // -----------------------------------------------------------------
    //
    // Assumes:
    //   - Table name: "agents"
    //   - Unique constraint on "email" so we can use onConflict: 'email'
    //
    const { data, error } = await supabaseAdmin
      .from('agents') // <-- adjust if your table name differs
      .upsert(upsertRow, {
        onConflict: 'email', // make sure a unique index on email exists
      })
      .select('*')
      .single(); // we expect exactly one row

    if (error) {
      console.error('[auth.ts] Supabase upsert error in /provision:', error);

      return res.status(500).json({
        ok: false,
        error: 'Database error',
        message: error.message ?? 'Unknown Supabase error during upsert.',
      });
    }

    console.log('[auth.ts] /provision succeeded for email:', email, '→ agent id:', data?.id);

    return res.status(200).json({
      ok: true,
      agent: data,
    });
  } catch (err) {
    // -----------------------------------------------------------------
    // 4. Catch-all error handler: ALWAYS return JSON, never empty body.
    // -----------------------------------------------------------------
    console.error('Error in /api/auth/provision:', err);

    const message = err instanceof Error ? err.message : String(err);

    return res.status(500).json({
      ok: false,
      error: 'Internal server error in /api/auth/provision',
      message,
    });
  }
});

/**
 * --------------------------------------------------------------------
 * GET /api/auth/me  (optional debug route)
 * --------------------------------------------------------------------
 * This endpoint is **optional** and mostly for debugging.
 *
 * Usage (from a REST client or curl):
 *   GET /api/auth/me
 *   Authorization: Bearer <access_token_from_supabase>
 *
 * Behavior:
 *   - Extracts the bearer token from the Authorization header.
 *   - Uses Supabase admin client to call auth.getUser(token).
 *   - Returns the Supabase user object or an error.
 *
 * DO NOT expose this endpoint publicly in production unless you
 * lock it down with additional checks; it is mainly for local dev
 * and debugging the login flow.
 */

authRouter.get('/me', async (req: Request, res: Response) => {
  if (!supabaseAdmin) {
    return res.status(500).json({
      ok: false,
      error: 'Server configuration error',
      message:
        'Supabase admin client is not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
    });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({
      ok: false,
      error: 'Unauthorized',
      message: 'Missing Bearer token in Authorization header.',
    });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);

    if (error) {
      console.error('[auth.ts] auth.getUser error in /me:', error);
      return res.status(401).json({
        ok: false,
        error: 'Unauthorized',
        message: error.message ?? 'Could not load user for provided token.',
      });
    }

    return res.status(200).json({
      ok: true,
      user: data.user,
    });
  } catch (err) {
    console.error('Error in /api/auth/me:', err);
    const message = err instanceof Error ? err.message : String(err);

    return res.status(500).json({
      ok: false,
      error: 'Internal server error in /api/auth/me',
      message,
    });
  }
});
