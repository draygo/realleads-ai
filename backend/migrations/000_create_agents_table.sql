-- ============================================================================
-- Migration: Add agents table for internal user management
-- 
-- This table bridges Supabase auth.users with our internal system.
-- After a user logs in with Google via Supabase, we create an internal
-- agent record that links to their Supabase user_id.
-- ============================================================================

-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  display_name TEXT,
  role TEXT NOT NULL DEFAULT 'agent', -- 'agent', 'admin', 'viewer'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on supabase_user_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_agents_supabase_user_id ON agents(supabase_user_id);

-- Create index on email for lookups
CREATE INDEX IF NOT EXISTS idx_agents_email ON agents(email);

-- Add comment to table
COMMENT ON TABLE agents IS 'Internal agent/user records linked to Supabase auth';

-- Add comments to columns
COMMENT ON COLUMN agents.id IS 'Internal agent ID (UUID)';
COMMENT ON COLUMN agents.supabase_user_id IS 'Links to auth.users.id in Supabase';
COMMENT ON COLUMN agents.email IS 'Agent email address (from Supabase auth)';
COMMENT ON COLUMN agents.display_name IS 'Display name for UI';
COMMENT ON COLUMN agents.role IS 'Agent role: agent, admin, or viewer';

-- ============================================================================
-- Row Level Security (RLS) Policies
-- ============================================================================

-- Enable RLS on agents table
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Policy: Agents can read their own record
CREATE POLICY "Agents can read own record" ON agents
  FOR SELECT
  USING (supabase_user_id = auth.uid());

-- Policy: Agents can update their own record
CREATE POLICY "Agents can update own record" ON agents
  FOR UPDATE
  USING (supabase_user_id = auth.uid());

-- Policy: Service role can do anything (for backend API)
CREATE POLICY "Service role has full access" ON agents
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- Function: Update updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger: Automatically update updated_at on row update
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- Done!
-- ============================================================================
