// Import the createClient function from the Supabase JS library
import { createClient } from '@supabase/supabase-js';

// Retrieve required environment variables for Supabase
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Validate that both environment variables are present
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  // Throw an error with a helpful message if missing
  throw new Error(
    'Missing required environment variables for Supabase client: SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY'
  );
}

/**
 * Supabase client using the Service Role key.
 * 
 * 📢 This client is initialized with the Supabase Service Role key, which bypasses Row Level Security (RLS).
 * Use with caution: It has elevated privileges and should only be used in trusted, server-side environments.
 */
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Export the Supabase client as a named export
export { supabase };
