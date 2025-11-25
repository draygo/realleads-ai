/**
 * Database Client - Supabase Postgres Connection
 * 
 * This file provides a centralized database client for connecting to Supabase Postgres.
 * All database queries throughout the application should use this client.
 * 
 * DEPENDENCIES:
 * - pg (node-postgres): Direct Postgres connection
 * - @supabase/supabase-js: Optional, for auth token verification
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/db/queries.ts
 * - Used by: backend/src/executor/actions/*.ts
 * - Used by: backend/src/routes/*.ts
 * 
 * ENVIRONMENT VARIABLES:
 * - DATABASE_URL: Postgres connection string (required)
 * - SUPABASE_JWT_SECRET: For verifying auth tokens (required)
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../middleware/logger';

// ============================================================================
// Types
// ============================================================================

export interface DbClient {
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;
  getClient(): Promise<PoolClient>;
  end(): Promise<void>;
}

export interface SupabaseAuthResult {
  userId: string;
  email: string;
  isValid: boolean;
}

// ============================================================================
// Database Pool Configuration
// ============================================================================

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create connection pool
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Supabase uses SSL
  },
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Timeout connection attempts after 10 seconds
});

// Log pool errors
pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

// Log when a client is acquired from the pool (debug only)
pool.on('connect', () => {
  logger.debug('New database client connected');
});

// Log when a client is removed from the pool (debug only)
pool.on('remove', () => {
  logger.debug('Database client removed from pool');
});

// ============================================================================
// Supabase Client (for auth verification)
// ============================================================================

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

let supabaseClient: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  logger.info('Supabase client initialized');
} else {
  logger.warn(
    'SUPABASE_URL or SUPABASE_ANON_KEY not set - auth verification may not work'
  );
}

// ============================================================================
// Database Client Interface
// ============================================================================

/**
 * Execute a parameterized query
 * This is the primary method for running queries safely
 * 
 * @param text - SQL query with $1, $2, etc. placeholders
 * @param params - Array of parameter values
 * @returns Query result
 * 
 * @example
 * const result = await db.query(
 *   'SELECT * FROM leads WHERE agent_id = $1 AND status = $2',
 *   [agentId, 'active']
 * );
 */
async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const startTime = Date.now();

  try {
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - startTime;

    logger.debug('Database query executed', {
      duration,
      rowCount: result.rowCount,
      query: text.substring(0, 100), // Log first 100 chars of query
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Database query failed', {
      duration,
      error: error instanceof Error ? error.message : String(error),
      query: text.substring(0, 100),
      params: params ? params.length : 0,
    });
    throw error;
  }
}

/**
 * Get a client from the pool for transaction support
 * Important: You must call client.release() when done!
 * 
 * @returns Pool client for transactions
 * 
 * @example
 * const client = await db.getClient();
 * try {
 *   await client.query('BEGIN');
 *   await client.query('INSERT INTO leads ...');
 *   await client.query('INSERT INTO communications ...');
 *   await client.query('COMMIT');
 * } catch (err) {
 *   await client.query('ROLLBACK');
 *   throw err;
 * } finally {
 *   client.release();
 * }
 */
async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

/**
 * Close all database connections
 * Call this on server shutdown
 */
async function end(): Promise<void> {
  logger.info('Closing database connection pool');
  await pool.end();
}

// ============================================================================
// Supabase Auth Verification
// ============================================================================

/**
 * Verify a Supabase access token and extract user information
 * 
 * @param accessToken - JWT access token from Supabase auth
 * @returns User information if valid, null if invalid
 * 
 * @example
 * const authResult = await verifySupabaseToken(req.headers.authorization);
 * if (!authResult.isValid) {
 *   return res.status(401).json({ error: 'Invalid token' });
 * }
 */
export async function verifySupabaseToken(
  accessToken: string
): Promise<SupabaseAuthResult | null> {
  if (!supabaseClient) {
    logger.error('Cannot verify token - Supabase client not initialized');
    return null;
  }

  try {
    // Remove 'Bearer ' prefix if present
    const token = accessToken.startsWith('Bearer ')
      ? accessToken.slice(7)
      : accessToken;

    // Verify token with Supabase
    const {
      data: { user },
      error,
    } = await supabaseClient.auth.getUser(token);

    if (error || !user) {
      logger.warn('Invalid Supabase token', { error: error?.message });
      return null;
    }

    return {
      userId: user.id,
      email: user.email || '',
      isValid: true,
    };
  } catch (error) {
    logger.error('Error verifying Supabase token', {
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

// ============================================================================
// Health Check
// ============================================================================

/**
 * Test database connection
 * Used by health check endpoint
 * 
 * @returns true if connection is healthy, false otherwise
 */
export async function healthCheck(): Promise<boolean> {
  try {
    const result = await pool.query('SELECT 1 as health');
    return result.rows[0]?.health === 1;
  } catch (error) {
    logger.error('Database health check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

// ============================================================================
// Export Database Client
// ============================================================================

export const db: DbClient = {
  query,
  getClient,
  end,
};

// Export helper functions
export { healthCheck };

// Default export
export default db;
