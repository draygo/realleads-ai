-- Migration: Create agents table
-- This table links Supabase auth users to the internal RealLeads.ai agent system

-- Create agents table
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'agent',
  timezone TEXT DEFAULT 'America/Los_Angeles',
  preferences JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on supabase_user_id for quick lookups
CREATE INDEX IF NOT EXISTS idx_agents_supabase_user_id ON agents(supabase_user_id);

-- Create index on account_id for multi-tenant queries
CREATE INDEX IF NOT EXISTS idx_agents_account_id ON agents(account_id);

-- Create index on email for lookups
CREATE INDEX IF NOT EXISTS idx_agents_email ON agents(email);

-- Create trigger to update updated_at on row changes
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_agents_updated_at ON agents;
CREATE TRIGGER update_agents_updated_at
  BEFORE UPDATE ON agents
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- Policy: Agents can read their own data
CREATE POLICY agents_read_own ON agents
  FOR SELECT
  USING (supabase_user_id = auth.uid());

-- Policy: Agents can update their own data
CREATE POLICY agents_update_own ON agents
  FOR UPDATE
  USING (supabase_user_id = auth.uid());

-- Policy: Service role can do everything (for backend operations)
CREATE POLICY agents_service_role ON agents
  FOR ALL
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON agents TO authenticated;
GRANT ALL ON agents TO service_role;
