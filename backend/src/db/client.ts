/**
 * Database Client - Supabase Postgres Connection
 * 
 * This file provides a centralized database client for connecting to Supabase Postgres.
 * All database queries throughout the application should use this client.
 * 
 * EXPORTS:
 * - db: Main database client with query, getClient, end methods
 * - supabase: Supabase client for auth verification (ADDED FOR auth.ts)
 * - pool: Direct access to connection pool
 * - healthCheck: Database health check function
 * - verifySupabaseToken: Verify Supabase JWT tokens
 * 
 * DEPENDENCIES:
 * - pg (node-postgres): Direct Postgres connection
 * - @supabase/supabase-js: For auth token verification
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/db/queries.ts
 * - Used by: backend/src/executor/actions/*.ts
 * - Used by: backend/src/routes/*.ts (including auth.ts)
 * 
 * ENVIRONMENT VARIABLES:
 * - DATABASE_URL: Postgres connection string (required)
 * - SUPABASE_URL: Supabase project URL (required for auth)
 * - SUPABASE_ANON_KEY: Supabase anonymous key (required for auth)
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../middleware/logger';

// ============================================================================
// TypeScript Interfaces
// ============================================================================

/**
 * Database Client Interface
 * 
 * Defines the contract for database operations.
 * All methods use parameterized queries to prevent SQL injection.
 */
export interface DbClient {
  /**
   * Execute a parameterized SQL query
   * @param text - SQL query with $1, $2, etc. placeholders
   * @param params - Array of values to replace placeholders
   * @returns Query result with rows and metadata
   */
  query<T = any>(text: string, params?: any[]): Promise<QueryResult<T>>;

  /**
   * Get a dedicated client for transaction support
   * IMPORTANT: Must call client.release() when done!
   * @returns Pool client for running transactions
   */
  getClient(): Promise<PoolClient>;

  /**
   * Close all database connections gracefully
   * Call this on server shutdown
   */
  end(): Promise<void>;
}

/**
 * Supabase Authentication Result
 * 
 * Contains user information extracted from verified JWT token.
 */
export interface SupabaseAuthResult {
  /** Supabase user ID (UUID) */
  userId: string;

  /** User's email address */
  email: string;

  /** Whether the token was valid */
  isValid: boolean;
}

// ============================================================================
// Database Pool Configuration
// ============================================================================

/**
 * Get DATABASE_URL from environment
 * This should be the Supabase Postgres connection string
 * Format: postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres
 */
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

/**
 * Create PostgreSQL Connection Pool
 * 
 * The pool maintains a set of reusable database connections.
 * This is more efficient than creating new connections for each query.
 * 
 * Configuration:
 * - max: Maximum number of clients (20 is good for Supabase free tier)
 * - idleTimeoutMillis: Close idle clients after 30 seconds to free resources
 * - connectionTimeoutMillis: Timeout connection attempts after 10 seconds
 * - ssl.rejectUnauthorized: false - Required for Supabase SSL connections
 */
export const pool = new Pool({
  connectionString: DATABASE_URL,

  // SSL is required for Supabase connections
  ssl: {
    rejectUnauthorized: false, // Supabase uses self-signed certificates
  },

  // Maximum number of clients in the pool
  max: 20,

  // Close idle clients after 30 seconds
  idleTimeoutMillis: 30000,

  // Timeout connection attempts after 10 seconds
  connectionTimeoutMillis: 10000,
});

/**
 * Pool Error Handler
 * 
 * Handles unexpected errors on idle clients in the pool.
 * This prevents the app from crashing if a connection fails.
 */
pool.on('error', (err) => {
  logger.error('Unexpected database pool error', { error: err.message });
});

/**
 * Pool Connect Event
 * 
 * Logs when a new client connects to the database.
 * Only logged in debug mode to avoid log spam.
 */
pool.on('connect', () => {
  logger.debug('New database client connected');
});

/**
 * Pool Remove Event
 * 
 * Logs when a client is removed from the pool.
 * Only logged in debug mode to avoid log spam.
 */
pool.on('remove', () => {
  logger.debug('Database client removed from pool');
});

// ============================================================================
// Supabase Client (for Auth Verification)
// ============================================================================

/**
 * Get Supabase configuration from environment
 * 
 * IMPORTANT: We use ANON_KEY here, not SERVICE_ROLE_KEY
 * 
 * Why ANON_KEY?
 * - Backend verifies tokens that were issued by Supabase Auth
 * - These tokens are signed with the JWT secret
 * - ANON_KEY is sufficient for verification
 * - SERVICE_ROLE_KEY is for bypassing RLS (not needed here)
 */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

/**
 * Supabase Client Instance
 * 
 * Used for:
 * - Verifying JWT access tokens from frontend
 * - Getting user information from auth tokens
 * - NOT for database queries (use pool instead)
 * 
 * May be null if environment variables are missing.
 */
let supabaseClient: SupabaseClient | null = null;

// Initialize Supabase client if credentials are available
if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  logger.info('Supabase client initialized', {
    service: 'realleads-backend',
    environment: process.env.NODE_ENV || 'development',
  });
} else {
  logger.warn(
    'SUPABASE_URL or SUPABASE_ANON_KEY not set - auth verification may not work'
  );
}

/**
 * Export Supabase client for use in routes
 * 
 * CRITICAL: This export was missing in the old version!
 * auth.ts needs to import { supabase } to verify tokens.
 * 
 * We export as 'supabase' to match the import in auth.ts
 */
export const supabase = supabaseClient;

// ============================================================================
// Database Client Interface Implementation
// ============================================================================

/**
 * Execute a Parameterized SQL Query
 * 
 * This is the primary method for running queries safely.
 * Always use parameterized queries to prevent SQL injection!
 * 
 * @param text - SQL query with $1, $2, etc. placeholders
 * @param params - Array of parameter values to replace placeholders
 * @returns Query result with rows and metadata
 * 
 * @example
 * // Good - parameterized query (safe)
 * const result = await db.query(
 *   'SELECT * FROM leads WHERE agent_id = $1 AND status = $2',
 *   [agentId, 'active']
 * );
 * 
 * @example
 * // Bad - string concatenation (SQL injection risk!)
 * const result = await db.query(
 *   `SELECT * FROM leads WHERE agent_id = '${agentId}'`
 * );
 */
async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const startTime = Date.now();

  try {
    // Execute the query using the connection pool
    const result = await pool.query<T>(text, params);
    const duration = Date.now() - startTime;

    // Log query execution (debug level to avoid log spam)
    logger.debug('Database query executed', {
      duration,
      rowCount: result.rowCount,
      query: text.substring(0, 100), // Log first 100 chars of query
    });

    return result;
  } catch (error) {
    const duration = Date.now() - startTime;

    // Log query failure with details for debugging
    logger.error('Database query failed', {
      duration,
      error: error instanceof Error ? error.message : String(error),
      query: text.substring(0, 100),
      params: params ? params.length : 0,
    });

    // Re-throw error so caller can handle it
    throw error;
  }
}

/**
 * Get a Client from Pool for Transactions
 * 
 * Use this when you need to run multiple queries as an atomic transaction.
 * 
 * IMPORTANT: You MUST call client.release() when done!
 * Forgetting to release causes connection leaks and pool exhaustion.
 * 
 * @returns Pool client for running transactions
 * 
 * @example
 * // Proper transaction usage
 * const client = await db.getClient();
 * try {
 *   await client.query('BEGIN');
 *   await client.query('INSERT INTO leads (name) VALUES ($1)', ['John']);
 *   await client.query('INSERT INTO communications (lead_id) VALUES ($1)', [leadId]);
 *   await client.query('COMMIT');
 * } catch (err) {
 *   await client.query('ROLLBACK');
 *   throw err;
 * } finally {
 *   client.release(); // CRITICAL: Always release!
 * }
 */
async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

/**
 * Close All Database Connections
 * 
 * Gracefully shuts down the connection pool.
 * Call this when the server is shutting down.
 * 
 * This ensures:
 * - All active queries complete
 * - Connections are closed properly
 * - No "connection terminated unexpectedly" errors
 */
async function end(): Promise<void> {
  logger.info('Closing database connection pool');
  await pool.end();
}

// ============================================================================
// Supabase Auth Verification
// ============================================================================

/**
 * Verify a Supabase Access Token
 * 
 * Takes a JWT access token from the frontend and verifies it with Supabase.
 * Returns user information if valid, null if invalid.
 * 
 * This is used by authenticated routes to verify the user's identity.
 * 
 * @param accessToken - JWT access token (with or without "Bearer " prefix)
 * @returns User information if valid, null if invalid
 * 
 * @example
 * // In an Express route
 * const authResult = await verifySupabaseToken(req.headers.authorization);
 * if (!authResult || !authResult.isValid) {
 *   return res.status(401).json({ error: 'Invalid token' });
 * }
 * // User is authenticated, can access their data
 * const userId = authResult.userId;
 */
export async function verifySupabaseToken(
  accessToken: string
): Promise<SupabaseAuthResult | null> {
  // Check if Supabase client is initialized
  if (!supabaseClient) {
    logger.error('Cannot verify token - Supabase client not initialized');
    return null;
  }

  try {
    // Remove 'Bearer ' prefix if present
    // Frontend typically sends: "Authorization: Bearer <token>"
    const token = accessToken.startsWith('Bearer ')
      ? accessToken.slice(7)
      : accessToken;

    // Verify the token with Supabase
    // This checks:
    // - Token signature is valid
    // - Token hasn't expired
    // - User exists in Supabase Auth
    const {
      data: { user },
      error,
    } = await supabaseClient.auth.getUser(token);

    // Check if verification failed
    if (error || !user) {
      logger.warn('Invalid Supabase token', { error: error?.message });
      return null;
    }

    // Token is valid - return user information
    return {
      userId: user.id,
      email: user.email || '',
      isValid: true,
    };
  } catch (error) {
    // Unexpected error during verification
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
 * Test Database Connection
 * 
 * Runs a simple query to verify the database is reachable and responding.
 * Used by the /health/detailed endpoint to check system status.
 * 
 * @returns true if database is healthy, false if unreachable
 * 
 * @example
 * // In health check endpoint
 * const dbHealthy = await healthCheck();
 * res.json({ database: dbHealthy ? 'healthy' : 'unhealthy' });
 */
export async function healthCheck(): Promise<boolean> {
  try {
    // Run a simple query that should always succeed
    const result = await pool.query('SELECT 1 as health');

    // Check if we got the expected result
    return result.rows[0]?.health === 1;
  } catch (error) {
    // Query failed - database is unhealthy
    logger.error('Database health check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Main Database Client
 * 
 * Primary export for database operations.
 * Use this for most database queries throughout the application.
 * 
 * @example
 * import { db } from '../db/client';
 * const result = await db.query('SELECT * FROM leads WHERE id = $1', [leadId]);
 */
export const db: DbClient = {
  query,
  getClient,
  end,
};

/**
 * Export All Components
 * 
 * Named exports for specific use cases:
 * - pool: Direct pool access (advanced use cases)
 * - supabase: Supabase client (auth verification)
 * - healthCheck: Database health check
 * - verifySupabaseToken: Token verification function
 */
export { pool, healthCheck };

/**
 * Default Export
 * 
 * Allows: import db from '../db/client';
 * This is the recommended way to import the database client.
 */
export default db;