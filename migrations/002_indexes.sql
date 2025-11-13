-- =====================================================================
-- RealLeads.ai Database Indexes - Performance Optimization
-- =====================================================================
-- This migration adds indexes for common query patterns and filters.
-- Run this after 001_initial_schema.sql
-- =====================================================================

-- =====================================================================
-- AGENTS TABLE INDEXES
-- =====================================================================
CREATE INDEX idx_agents_account_id ON agents(account_id);
CREATE INDEX idx_agents_email ON agents(email);

-- =====================================================================
-- LEADS TABLE INDEXES
-- =====================================================================
-- Multi-tenancy & ownership
CREATE INDEX idx_leads_account_id ON leads(account_id);
CREATE INDEX idx_leads_owner_agent_id ON leads(owner_agent_id);

-- Array fields (use GIN for containment queries)
CREATE INDEX idx_leads_segments ON leads USING GIN(segments);
CREATE INDEX idx_leads_property_type ON leads USING GIN(property_type);
CREATE INDEX idx_leads_interested_in ON leads USING GIN(interested_in);

-- Common filters
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_market_area ON leads(market_area);
CREATE INDEX idx_leads_source ON leads(source);
CREATE INDEX idx_leads_consent_status ON leads(consent_status);

-- Date-based queries (follow-ups, last contact)
CREATE INDEX idx_leads_next_communication_date ON leads(next_communication_date);
CREATE INDEX idx_leads_last_communication_date ON leads(last_communication_date);
CREATE INDEX idx_leads_created_at ON leads(created_at);

-- Composite index for common "find stale leads" query
-- Example: "Show me HNW leads in San Francisco not contacted in 14+ days"
CREATE INDEX idx_leads_market_status_next_comm 
    ON leads(market_area, status, next_communication_date);

-- Full-text search on names (for Command Console queries)
CREATE INDEX idx_leads_first_name_trgm ON leads USING gin(first_name gin_trgm_ops);
CREATE INDEX idx_leads_last_name_trgm ON leads USING gin(last_name gin_trgm_ops);
-- Note: Requires pg_trgm extension (uncomment below if not enabled)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- =====================================================================
-- COMMUNICATIONS TABLE INDEXES
-- =====================================================================
CREATE INDEX idx_communications_account_id ON communications(account_id);
CREATE INDEX idx_communications_lead_id ON communications(lead_id);
CREATE INDEX idx_communications_timestamp ON communications(timestamp DESC); -- DESC for recent-first
CREATE INDEX idx_communications_medium ON communications(medium);
CREATE INDEX idx_communications_direction ON communications(direction);
CREATE INDEX idx_communications_related_campaign_id ON communications(related_campaign_id);

-- Composite for "show recent comms for this lead"
CREATE INDEX idx_communications_lead_timestamp 
    ON communications(lead_id, timestamp DESC);

-- =====================================================================
-- PENDING_MESSAGES TABLE INDEXES
-- =====================================================================
CREATE INDEX idx_pending_messages_account_id ON pending_messages(account_id);
CREATE INDEX idx_pending_messages_lead_id ON pending_messages(lead_id);
CREATE INDEX idx_pending_messages_status ON pending_messages(status);
CREATE INDEX idx_pending_messages_created_at ON pending_messages(created_at DESC);

-- Composite for "show pending approvals for HNW leads"
CREATE INDEX idx_pending_messages_status_created 
    ON pending_messages(status, created_at DESC)
    WHERE status = 'Pending'; -- Partial index for efficiency

-- =====================================================================
-- CAMPAIGNS TABLE INDEXES
-- =====================================================================
CREATE INDEX idx_campaigns_account_id ON campaigns(account_id);
CREATE INDEX idx_campaigns_status ON campaigns(status);
CREATE INDEX idx_campaigns_created_by ON campaigns(created_by);
CREATE INDEX idx_campaigns_scheduled_for ON campaigns(scheduled_for);
CREATE INDEX idx_campaigns_segments_targeted ON campaigns USING GIN(segments_targeted);

-- =====================================================================
-- CAMPAIGN_RECIPIENTS TABLE INDEXES
-- =====================================================================
CREATE INDEX idx_campaign_recipients_account_id ON campaign_recipients(account_id);
CREATE INDEX idx_campaign_recipients_campaign_id ON campaign_recipients(campaign_id);
CREATE INDEX idx_campaign_recipients_lead_id ON campaign_recipients(lead_id);
CREATE INDEX idx_campaign_recipients_status ON campaign_recipients(status);

-- Composite for "show campaign delivery status"
CREATE INDEX idx_campaign_recipients_campaign_status 
    ON campaign_recipients(campaign_id, status);

-- =====================================================================
-- AUDIT_LOG TABLE INDEXES
-- =====================================================================
CREATE INDEX idx_audit_log_account_id ON audit_log(account_id);
CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_log_actor ON audit_log(actor);
CREATE INDEX idx_audit_log_parsed_action ON audit_log(parsed_action);
CREATE INDEX idx_audit_log_status ON audit_log(status);

-- GIN index for JSONB details (for filtering by specific fields in details)
CREATE INDEX idx_audit_log_details ON audit_log USING GIN(details);

-- =====================================================================
-- CONTENT_LIBRARY TABLE INDEXES
-- =====================================================================
CREATE INDEX idx_content_library_account_id ON content_library(account_id);
CREATE INDEX idx_content_library_content_type ON content_library(content_type);
CREATE INDEX idx_content_library_market_area ON content_library(market_area);
CREATE INDEX idx_content_library_segments ON content_library USING GIN(segments);
CREATE INDEX idx_content_library_created_at ON content_library(created_at DESC);
CREATE INDEX idx_content_library_expires_at ON content_library(expires_at)
    WHERE expires_at IS NOT NULL; -- Partial index for time-sensitive content

-- =====================================================================
-- QUERY OPTIMIZATION NOTES
-- =====================================================================
-- These indexes support common queries like:
--
-- 1. "Find all HNW leads in San Francisco not contacted in 14+ days"
--    -> Uses idx_leads_market_status_next_comm + idx_leads_segments
--
-- 2. "Show recent communications for lead X"
--    -> Uses idx_communications_lead_timestamp
--
-- 3. "List all pending HNW approvals"
--    -> Uses idx_pending_messages_status_created (partial index)
--
-- 4. "Audit log for today's actions"
--    -> Uses idx_audit_log_timestamp
--
-- 5. "Campaign delivery stats"
--    -> Uses idx_campaign_recipients_campaign_status
--
-- Monitor query performance with:
--   EXPLAIN ANALYZE SELECT ...
-- Add additional indexes based on actual usage patterns.
