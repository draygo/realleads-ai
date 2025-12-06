// Supabase client for the frontend.
// Reads the project URL and anon key from Vite env variables.
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("supabaseUrl is required.");
}
if (!supabaseAnonKey) {
  throw new Error("supabaseAnonKey is required.");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
