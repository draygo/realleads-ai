/**
 * Authentication Routes
 * 
 * This file handles all authentication-related API endpoints for RealLeads.ai.
 * 
 * Routes:
 * - POST /api/auth/provision - Creates or updates agent record after OAuth
 * - GET /api/auth/me - Returns current authenticated user information
 * 
 * Authentication Flow:
 * 1. User completes Google OAuth via Supabase
 * 2. Frontend gets session with access token
 * 3. Frontend calls /api/auth/provision with Bearer token
 * 4. Backend verifies token with Supabase
 * 5. Backend creates/updates agent record in database
 * 6. Frontend redirects to dashboard
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../db/client';
import { pool } from '../db';
import { logger } from '../middleware/logger'; // FIXED: Changed from '../utils/logger'

// Create Express router for auth endpoints
const router = Router();

/**
 * POST /api/auth/provision
 * 
 * Provisions (creates or updates) an agent record after successful OAuth.
 * 
 * This endpoint is called by the frontend after Google OAuth completes.
 * It links the Supabase authentication user to an internal agent record.
 * 
 * Request Headers:
 * - Authorization: Bearer <supabase_access_token>
 * 
 * Response:
 * - 200: Agent provisioned successfully
 * - 401: Invalid or missing authorization token
 * - 500: Server error during provisioning
 */
router.post('/provision', async (req: Request, res: Response) => {
  try {
    // Extract the Bearer token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Missing or invalid authorization header');
      return res.status(401).json({ 
        ok: false, 
        error: 'Missing or invalid authorization header' 
      });
    }

    // Extract the actual token (remove "Bearer " prefix)
    const token = authHeader.substring(7);

    /**
     * Verify the token with Supabase
     * 
     * This checks:
     * - Token is valid and not expired
     * - Token signature is correct
     * - User exists in Supabase auth system
     */
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      logger.error('Failed to verify user token', { error: authError });
      return res.status(401).json({ 
        ok: false, 
        error: 'Invalid authentication token' 
      });
    }

    // Extract user information from Supabase user object
    const supabaseUserId = user.id;
    const email = user.email || '';
    const fullName = user.user_metadata?.full_name || user.email?.split('@')[0] || '';

    logger.info('Provisioning agent', { 
      supabaseUserId, 
      email 
    });

    /**
     * UPSERT Agent Record
     * 
     * Uses PostgreSQL's INSERT ... ON CONFLICT to either:
     * - Insert a new agent record (if supabase_user_id doesn't exist)
     * - Update existing agent record (if supabase_user_id already exists)
     * 
     * This approach:
     * - Prevents duplicate key errors
     * - Handles multiple login attempts gracefully
     * - Ensures user data stays current
     * - Eliminates need for separate SELECT query
     * 
     * The RETURNING clause gives us the final record (whether inserted or updated)
     */
    const upsertQuery = `
      INSERT INTO agents (supabase_user_id, email, full_name, role)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (supabase_user_id)
      DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name,
        updated_at = NOW()
      RETURNING id, supabase_user_id, email, full_name, role, created_at, updated_at
    `;

    // Execute the UPSERT query
    const result = await pool.query(upsertQuery, [
      supabaseUserId,
      email,
      fullName,
      'agent' // Default role for new users
    ]);

    // Get the agent record (either newly inserted or updated)
    const agent = result.rows[0];

    logger.info('Agent provisioned successfully', {
      agentId: agent.id,
      email: agent.email,
      supabaseUserId: agent.supabase_user_id
    });

    /**
     * Return success response
     * 
     * The frontend uses this to confirm provisioning succeeded
     * and can now consider the user fully authenticated
     */
    return res.status(200).json({
      ok: true,
      agent: {
        id: agent.id,
        email: agent.email,
        fullName: agent.full_name,
        role: agent.role,
        supabaseUserId: agent.supabase_user_id
      }
    });

  } catch (error) {
    // Log the full error for debugging
    logger.error('Error provisioning agent', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Return generic error to client (don't expose internal details)
    return res.status(500).json({ 
      ok: false, 
      error: 'Failed to provision agent' 
    });
  }
});

/**
 * GET /api/auth/me
 * 
 * Returns information about the currently authenticated user.
 * 
 * This endpoint:
 * - Verifies the user's Supabase token
 * - Retrieves the associated agent record from database
 * - Returns combined user/agent information
 * 
 * Request Headers:
 * - Authorization: Bearer <supabase_access_token>
 * 
 * Response:
 * - 200: User information retrieved successfully
 * - 401: Invalid or missing authorization token
 * - 404: User authenticated but no agent record found
 * - 500: Server error
 */
router.get('/me', async (req: Request, res: Response) => {
  try {
    // Extract Bearer token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      logger.warn('Missing or invalid authorization header on /me endpoint');
      return res.status(401).json({ 
        ok: false, 
        error: 'Missing or invalid authorization header' 
      });
    }

    // Extract the actual token
    const token = authHeader.substring(7);

    /**
     * Verify token with Supabase
     * 
     * Gets the authenticated user information from Supabase
     */
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      logger.error('Failed to verify user token on /me endpoint', { error: authError });
      return res.status(401).json({ 
        ok: false, 
        error: 'Invalid authentication token' 
      });
    }

    const supabaseUserId = user.id;

    /**
     * Retrieve agent record from database
     * 
     * Links the Supabase user to our internal agent record
     */
    const agentQuery = 'SELECT * FROM agents WHERE supabase_user_id = $1';
    const agentResult = await pool.query(agentQuery, [supabaseUserId]);

    if (agentResult.rows.length === 0) {
      logger.warn('No agent record found for authenticated user', { supabaseUserId });
      return res.status(404).json({ 
        ok: false, 
        error: 'Agent record not found' 
      });
    }

    const agent = agentResult.rows[0];

    /**
     * Return combined user information
     * 
     * Includes both Supabase user data and internal agent data
     */
    return res.status(200).json({
      ok: true,
      user: {
        id: agent.id,
        email: agent.email,
        fullName: agent.full_name,
        role: agent.role,
        supabaseUserId: agent.supabase_user_id,
        createdAt: agent.created_at,
        updatedAt: agent.updated_at
      }
    });

  } catch (error) {
    // Log error for debugging
    logger.error('Error fetching user info', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    // Return generic error
    return res.status(500).json({ 
      ok: false, 
      error: 'Failed to fetch user information' 
    });
  }
});

// Export the router to be mounted in the main app
export default router;