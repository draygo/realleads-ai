/**
 * Database Connection Pool
 * 
 * This file configures the PostgreSQL connection pool for the backend.
 * Uses pg (node-postgres) library to manage database connections.
 * 
 * Connection Pool Benefits:
 * - Reuses connections instead of creating new ones for each query
 * - Manages connection lifecycle automatically
 * - Handles reconnection on failures
 * - Limits concurrent connections to database
 * 
 * Configuration is optimized for Supabase Session Pooler on Replit.
 */

import { Pool, PoolConfig } from 'pg';
import { logger } from '../middleware/logger';

/**
 * Database Connection Configuration
 * 
 * Optimized for Supabase Session Pooler with IPv4 compatibility.
 * 
 * Important Settings:
 * - max: Maximum number of clients in the pool (20 for Supabase free tier)
 * - connectionTimeoutMillis: How long to wait for a connection (10 seconds)
 * - idleTimeoutMillis: How long a client can be idle before being released (30 seconds)
 * - keepAlive: Sends periodic packets to keep connection alive
 * - keepAliveInitialDelayMillis: Wait 10 seconds before first keepalive packet
 * 
 * These settings prevent "client_termination" errors from Supabase.
 */
const poolConfig: PoolConfig = {
  // Get connection string from environment variable
  connectionString: process.env.DATABASE_URL,

  // Maximum number of clients in the pool
  // Supabase free tier allows up to 100 connections, we use 20 to be safe
  max: 20,

  // Maximum time (ms) to wait for a connection from the pool
  // If pool is exhausted, wait up to 10 seconds before timing out
  connectionTimeoutMillis: 10000,

  // Maximum time (ms) a client can be idle before being released
  // Release idle connections after 30 seconds to free up resources
  idleTimeoutMillis: 30000,

  // Enable TCP keepalive to prevent connection timeouts
  // This sends periodic packets to keep the connection alive
  keepAlive: true,

  // Wait 10 seconds after connection before sending first keepalive
  keepAliveInitialDelayMillis: 10000,

  // SSL configuration for Supabase
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false // Required for Supabase
  } : false,
};

/**
 * Create the connection pool
 * 
 * This pool will be used by all database queries in the application.
 */
export const pool = new Pool(poolConfig);

/**
 * Pool Event Handlers
 * 
 * Listen to pool events for logging and debugging.
 */

// Log when a new client is created
pool.on('connect', (client) => {
  logger.debug('New database client connected to pool');
});

// Log when a client is acquired from the pool
pool.on('acquire', (client) => {
  logger.debug('Database client acquired from pool');
});

// Log when a client is released back to the pool
pool.on('release', (client) => {
  logger.debug('Database client released back to pool');
});

// Log when a client is removed from the pool
pool.on('remove', (client) => {
  logger.debug('Database client removed from pool');
});

/**
 * Error Handler
 * 
 * Handle unexpected errors on idle clients.
 * This prevents the app from crashing if a connection fails.
 */
pool.on('error', (err, client) => {
  logger.error('Unexpected database pool error', {
    error: err.message,
    stack: err.stack,
  });

  // Don't exit the process - the pool will create a new connection
  // The old client will be discarded and replaced
});

/**
 * Test Database Connection
 * 
 * This function tests the connection when the server starts.
 * It helps identify connection issues early.
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    // Try to connect and run a simple query
    const result = await pool.query('SELECT NOW()');

    logger.info('Database connection test successful', {
      timestamp: result.rows[0].now
    });

    return true;
  } catch (error) {
    logger.error('Database connection test failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });

    return false;
  }
}

/**
 * Graceful Shutdown
 * 
 * Close all connections in the pool when the app shuts down.
 * This prevents "connection terminated unexpectedly" errors.
 */
export async function closeDatabasePool(): Promise<void> {
  try {
    await pool.end();
    logger.info('Database pool closed successfully');
  } catch (error) {
    logger.error('Error closing database pool', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

// Export pool as default for convenience
export default pool;