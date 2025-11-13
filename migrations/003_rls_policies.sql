-- =====================================================================
-- RealLeads.ai Row-Level Security Policies (DISABLED FOR NOW)
-- =====================================================================
-- These policies enforce multi-tenant data isolation once enabled.
-- 
-- DO NOT ENABLE RLS YET - it can break webhooks and schedulers until
-- auth is fully wired. This file documents the policies for when you're
-- ready to enable multi-tenancy.
--
-- To enable later:
-- 1. Ensure all application code sets account_id on inserts
-- 2. Configure Supabase Auth to set account_id claims in JWT
-- 3. Uncomment policies below and run: ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
-- 4. Test thoroughly with different user accounts
-- =====================================================================

-- =====================================================================
-- HOW RLS WORKS WITH SUPABASE
-- =====================================================================
-- Supabase Auth JWTs include claims. We'll add a custom claim:
--   { "app_metadata": { "account_id": "uuid-here" } }
--
-- Functions to extract this claim:
-- CREATE OR REPLACE FUNCTION auth.account_id() RETURNS UUID AS $$
--   SELECT COALESCE(
--     current_setting('request.jwt.claims', true)::json->>'account_id',
--     current_setting('request.jwt.claims', true)::json->'app_metadata'->>'account_id'
--   )::UUID
-- $$ LANGUAGE SQL STABLE;

-- =====================================================================
-- AGENTS TABLE RLS
-- =====================================================================
-- ALTER TABLE agents ENABLE ROW LEVEL SECURITY;

-- -- Users can only see agents in their account
-- CREATE POLICY agents_select_policy ON agents
--   FOR SELECT
--   USING (account_id = auth.account_id());

-- -- Only admins can insert/update agents (implement role check)
-- CREATE POLICY agents_insert_policy ON agents
--   FOR INSERT
--   WITH CHECK (account_id = auth.account_id() AND auth.role() = 'Admin');

-- CREATE POLICY agents_update_policy ON agents
--   FOR UPDATE
--   USING (account_id = auth.account_id() AND auth.role() = 'Admin');

-- =====================================================================
-- LEADS TABLE RLS
-- =====================================================================
-- ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- -- Users can see leads in their account
-- CREATE POLICY leads_select_policy ON leads
--   FOR SELECT
--   USING (account_id = auth.account_id());

-- -- Users can insert leads into their account
-- CREATE POLICY leads_insert_policy ON leads
--   FOR INSERT
--   WITH CHECK (account_id = auth.account_id());

-- -- Users can update leads in their account
-- -- Optional: restrict to owner_agent_id or allow all agents in account
-- CREATE POLICY leads_update_policy ON leads
--   FOR UPDATE
--   USING (account_id = auth.account_id());

-- -- Deletes restricted to admins only
-- CREATE POLICY leads_delete_policy ON leads
--   FOR DELETE
--   USING (account_id = auth.account_id() AND auth.role() = 'Admin');

-- =====================================================================
-- COMMUNICATIONS TABLE RLS
-- =====================================================================
-- ALTER TABLE communications ENABLE ROW LEVEL SECURITY;

-- -- Users can see comms for leads in their account
-- -- This is a JOIN policy - checks via the lead's account_id
-- CREATE POLICY communications_select_policy ON communications
--   FOR SELECT
--   USING (
--     account_id = auth.account_id()
--     OR EXISTS (
--       SELECT 1 FROM leads WHERE leads.id = communications.lead_id AND leads.account_id = auth.account_id()
--     )
--   );

-- -- Users can insert comms for their account's leads
-- CREATE POLICY communications_insert_policy ON communications
--   FOR INSERT
--   WITH CHECK (account_id = auth.account_id());

-- =====================================================================
-- PENDING_MESSAGES TABLE RLS
-- =====================================================================
-- ALTER TABLE pending_messages ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY pending_messages_select_policy ON pending_messages
--   FOR SELECT
--   USING (account_id = auth.account_id());

-- CREATE POLICY pending_messages_insert_policy ON pending_messages
--   FOR INSERT
--   WITH CHECK (account_id = auth.account_id());

-- -- Only owner or admin can approve/reject
-- CREATE POLICY pending_messages_update_policy ON pending_messages
--   FOR UPDATE
--   USING (account_id = auth.account_id());

-- =====================================================================
-- CAMPAIGNS TABLE RLS
-- =====================================================================
-- ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY campaigns_select_policy ON campaigns
--   FOR SELECT
--   USING (account_id = auth.account_id());

-- CREATE POLICY campaigns_insert_policy ON campaigns
--   FOR INSERT
--   WITH CHECK (account_id = auth.account_id());

-- CREATE POLICY campaigns_update_policy ON campaigns
--   FOR UPDATE
--   USING (account_id = auth.account_id());

-- =====================================================================
-- CAMPAIGN_RECIPIENTS TABLE RLS
-- =====================================================================
-- ALTER TABLE campaign_recipients ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY campaign_recipients_select_policy ON campaign_recipients
--   FOR SELECT
--   USING (account_id = auth.account_id());

-- CREATE POLICY campaign_recipients_insert_policy ON campaign_recipients
--   FOR INSERT
--   WITH CHECK (account_id = auth.account_id());

-- CREATE POLICY campaign_recipients_update_policy ON campaign_recipients
--   FOR UPDATE
--   USING (account_id = auth.account_id());

-- =====================================================================
-- AUDIT_LOG TABLE RLS
-- =====================================================================
-- ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- -- All users can read audit log for their account
-- CREATE POLICY audit_log_select_policy ON audit_log
--   FOR SELECT
--   USING (account_id = auth.account_id());

-- -- System can always insert (use service role key)
-- CREATE POLICY audit_log_insert_policy ON audit_log
--   FOR INSERT
--   WITH CHECK (true); -- Service role bypasses RLS anyway

-- =====================================================================
-- CONTENT_LIBRARY TABLE RLS
-- =====================================================================
-- ALTER TABLE content_library ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY content_library_select_policy ON content_library
--   FOR SELECT
--   USING (account_id = auth.account_id());

-- CREATE POLICY content_library_insert_policy ON content_library
--   FOR INSERT
--   WITH CHECK (account_id = auth.account_id());

-- CREATE POLICY content_library_update_policy ON content_library
--   FOR UPDATE
--   USING (account_id = auth.account_id());

-- CREATE POLICY content_library_delete_policy ON content_library
--   FOR DELETE
--   USING (account_id = auth.account_id());

-- =====================================================================
-- SERVICE ROLE BYPASS
-- =====================================================================
-- When using Supabase service role key (backend operations), RLS is
-- automatically bypassed. This allows:
-- - Twilio webhooks to insert communications
-- - Internal scheduler to create pending_messages
-- - System actions to write to audit_log
--
-- When using anon key (future: direct frontend queries), RLS is enforced.

-- =====================================================================
-- TESTING RLS POLICIES
-- =====================================================================
-- Before enabling in production:
--
-- 1. Create test accounts with different account_id values
-- 2. Verify queries return only account-scoped data:
--    SET request.jwt.claims = '{"account_id": "test-uuid"}';
--    SELECT * FROM leads; -- Should only return this account's leads
-- 3. Test webhooks still work (they use service role, bypass RLS)
-- 4. Test scheduler cron jobs (they also use service role)
--
-- Once confident, enable RLS table by table, testing after each one.
