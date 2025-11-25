// backend/src/db/index.ts
// -----------------------------------------------------------------------------
// Central Postgres connection pool used by all backend routes.
// This is what `import { pool } from '../db'` is referring to.
// -----------------------------------------------------------------------------

import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables from .env / Replit Secrets
dotenv.config();

// We try a few common env vars for the connection string.
// Use whichever you actually have set in Replit Secrets.
const connectionString =
  process.env.DATABASE_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.SUPABASE_POSTGRES_URL ||
  '';

if (!connectionString) {
  console.warn(
    '[db] No DATABASE_URL / SUPABASE_DB_URL / SUPABASE_POSTGRES_URL set. ' +
      'Database queries will fail until you add one of these env vars.'
  );
}

// Create a connection pool. For Supabase, SSL is required.
export const pool = new Pool({
  connectionString,
  ssl: connectionString.includes('supabase')
    ? { rejectUnauthorized: false }
    : undefined,
});

// Optional: simple helper to log that the pool is alive.
pool
  .connect()
  .then(client => {
    console.log('[db] Connected to Postgres successfully');
    client.release();
  })
  .catch(err => {
    console.error('[db] Error connecting to Postgres:', err.message);
  });
