/**
 * Authentication Routes
 * 
 * This file handles authentication flows, specifically:
 * - POST /api/auth/provision: Create/update internal user after Supabase OAuth
 * - POST /api/auth/logout: Handle logout (optional)
 * 
 * DEPENDENCIES:
 * - backend/src/db/client.ts: Database operations and Supabase token verification
 * - backend/src/middleware/logger.ts: Logging
 * - backend/src/middleware/error-handler.ts: Error handling
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/server.ts
 * - Called by: web/src/pages/AuthCallback.tsx (after Google OAuth)
 * 
 * FLOW:
 * 1. User logs in with Google via Supabase on frontend
 * 2. Frontend receives access_token from Supabase
 * 3. Frontend calls POST /api/auth/provision with token in Authorization header
 * 4. Backend verifies token, creates/updates internal user record
 * 5. Frontend redirects to dashboard with session established
 */

import { Router, Request, Response } from 'express';
import { verifySupabaseToken, db } from '../db/client';
import { logger } from '../middleware/logger';
import { asyncHandler, AuthError } from '../middleware/error-handler';

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface InternalUser {
  id: string;
  supabase_user_id: string;
  email: string;
  display_name?: string;
  role: string;
  created_at: Date;
  updated_at: Date;
}

interface ProvisionResponse {
  ok: boolean;
  user: InternalUser;
  supabaseUserId: string;
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /api/auth/provision
 * 
 * Creates or updates an internal user record after Supabase OAuth.
 * This bridges Supabase auth (auth.users) with our internal agents table.
 * 
 * HEADERS:
 * - Authorization: Bearer <supabase_access_token>
 * 
 * RETURNS:
 * - 200: { ok: true, user: InternalUser, supabaseUserId: string }
 * - 401: { error: { message: "Invalid or missing token" } }
 * - 500: { error: { message: "Internal server error" } }
 */
router.post(
  '/provision',
  asyncHandler(async (req: Request, res: Response) => {
    // Extract token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('Authorization header missing or invalid');
    }

    const accessToken = authHeader.substring(7); // Remove 'Bearer ' prefix

    logger.debug('Provisioning user', {
      hasToken: !!accessToken,
      tokenLength: accessToken.length,
    });

    // Verify Supabase token
    const authResult = await verifySupabaseToken(accessToken);

    if (!authResult || !authResult.isValid) {
      logger.warn('Invalid Supabase token in provision request');
      throw new AuthError('Invalid or expired token');
    }

    logger.info('Supabase token verified', {
      supabaseUserId: authResult.userId,
      email: authResult.email,
    });

    // Check if internal user already exists
    const existingUserQuery = `
      SELECT * FROM agents
      WHERE supabase_user_id = $1
    `;

    const existingUserResult = await db.query<InternalUser>(existingUserQuery, [
      authResult.userId,
    ]);

    let user: InternalUser;

    if (existingUserResult.rows.length > 0) {
      // User exists - update last_signed_in_at
      user = existingUserResult.rows[0];

      const updateQuery = `
        UPDATE agents
        SET updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `;

      const updatedResult = await db.query<InternalUser>(updateQuery, [user.id]);
      user = updatedResult.rows[0];

      logger.info('Existing user updated', {
        userId: user.id,
        email: user.email,
      });
    } else {
      // User doesn't exist - create new record
      const insertQuery = `
        INSERT INTO agents (
          supabase_user_id,
          email,
          display_name,
          role
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

      // Extract display name from email if not provided
      const displayName = authResult.email.split('@')[0];

      const insertResult = await db.query<InternalUser>(insertQuery, [
        authResult.userId,
        authResult.email,
        displayName,
        'agent', // Default role
      ]);

      user = insertResult.rows[0];

      logger.info('New user created', {
        userId: user.id,
        email: user.email,
        supabaseUserId: authResult.userId,
      });
    }

    // Return user data
    const response: ProvisionResponse = {
      ok: true,
      user,
      supabaseUserId: authResult.userId,
    };

    res.json(response);
  })
);

/**
 * POST /api/auth/logout
 * 
 * Optional logout endpoint (mainly for logging purposes)
 * Actual logout is handled by Supabase on the frontend
 */
router.post(
  '/logout',
  asyncHandler(async (req: Request, res: Response) => {
    // Log logout event
    logger.info('User logged out', {
      ip: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({ ok: true, message: 'Logged out successfully' });
  })
);

/**
 * GET /api/auth/me
 * 
 * Get current user information
 * Requires valid Authorization header with Supabase token
 */
router.get(
  '/me',
  asyncHandler(async (req: Request, res: Response) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('Authorization header missing or invalid');
    }

    const accessToken = authHeader.substring(7);

    // Verify token
    const authResult = await verifySupabaseToken(accessToken);

    if (!authResult || !authResult.isValid) {
      throw new AuthError('Invalid or expired token');
    }

    // Get internal user
    const userQuery = `
      SELECT * FROM agents
      WHERE supabase_user_id = $1
    `;

    const userResult = await db.query<InternalUser>(userQuery, [authResult.userId]);

    if (userResult.rows.length === 0) {
      throw new AuthError('User not found - please sign in again');
    }

    const user = userResult.rows[0];

    res.json({
      ok: true,
      user,
      supabaseUserId: authResult.userId,
    });
  })
);

// ============================================================================
// Export Router
// ============================================================================

export default router;
