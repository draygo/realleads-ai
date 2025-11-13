-- =====================================================================
-- RealLeads.ai Database Schema - Initial Migration
-- =====================================================================
-- This migration creates all core tables with account_id for future
-- multi-tenancy support. RLS is NOT enabled yet (see 003_rls_policies.sql)
-- 
-- Tables created:
-- 1. agents - User accounts (realtors, ISAs, admins)
-- 2. leads - Contact/prospect records with enrichment fields
-- 3. communications - All interactions log (SMS, email, WhatsApp, calls)
-- 4. pending_messages - HNW approval queue & guarded sends
-- 5. campaigns - Bulk message campaigns (email, SMS)
-- 6. campaign_recipients - Per-lead campaign delivery tracking
-- 7. audit_log - System actions audit trail
-- 8. content_library - Market reports, listings, templates for campaigns
-- =====================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- 1. AGENTS TABLE
-- =====================================================================
-- Stores user accounts. In multi-tenant mode, each agent belongs to an account.
CREATE TABLE agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL, -- Future multi-tenancy support
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT,
    role TEXT NOT NULL DEFAULT 'Agent', -- 'Owner', 'Agent', 'ISA', 'Admin'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE agents IS 'User accounts for realtors, ISAs, and admins';
COMMENT ON COLUMN agents.account_id IS 'Tenant identifier for multi-tenant mode (not enforced yet)';
COMMENT ON COLUMN agents.role IS 'User role: Owner, Agent, ISA (Inside Sales Agent), or Admin';

-- =====================================================================
-- 2. LEADS TABLE
-- =====================================================================
-- Core CRM entity. Each lead represents a prospect/client with rich metadata.
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL, -- Future multi-tenancy support
    
    -- Source & ownership
    source TEXT, -- e.g., 'Zillow', 'Open House', 'Referral', 'Website'
    owner_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
    created_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    init_property TEXT, -- Initial property reference (MLS ID, address, Zenlist URL)
    
    -- Required contact fields (enforced in application)
    first_name TEXT NOT NULL,
    last_name TEXT,
    phone TEXT,
    email TEXT,
    linkedin TEXT,
    
    -- Budget & preferences
    budget_min NUMERIC,
    budget_max NUMERIC,
    price_range TEXT, -- e.g., "±$200k", "Flexible"
    property_type TEXT[], -- e.g., {'Condo', 'SFH', 'Multi-family'}
    timeline TEXT, -- '0-3mo', '3-6mo', '6-12mo', '>12mo', 'Browsing'
    interested_in TEXT[], -- {'Buying', 'Selling', 'Investing', 'Leasing'}
    
    -- Agent relationship
    have_agent TEXT, -- 'Yes', 'No', 'Not sure'
    their_agent_name TEXT,
    buyer_broker_expiration DATE,
    
    -- Segmentation
    segments TEXT[], -- e.g., {'High Net Worth', 'First-Time Buyer', 'Investor'}
    status TEXT NOT NULL DEFAULT 'New', -- 'New', 'Nurture', 'Hot', 'Closed', 'Lost'
    
    -- Subject property / search criteria
    property_address TEXT,
    neighborhood TEXT,
    beds INTEGER,
    baths INTEGER,
    
    -- Notes & communication preferences
    notes TEXT,
    last_communication_date TIMESTAMPTZ,
    next_communication_date TIMESTAMPTZ,
    preferred_medium TEXT DEFAULT 'SMS', -- 'SMS', 'Email', 'Both', 'WhatsApp'
    market_area TEXT, -- e.g., 'San Francisco', 'Marin', 'Peninsula'
    consent_status TEXT NOT NULL DEFAULT 'Cold', -- 'Cold', 'Implied', 'Opted-In', 'Do Not Contact'
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE leads IS 'Core CRM prospect/client records with enrichment and segmentation';
COMMENT ON COLUMN leads.segments IS 'Array of segment tags including "High Net Worth" for special handling';
COMMENT ON COLUMN leads.init_property IS 'The property that triggered initial contact (address, MLS ID, or Zenlist URL)';
COMMENT ON COLUMN leads.consent_status IS 'Communication consent level: Cold (no contact), Implied, Opted-In, Do Not Contact';

-- Constraint: At least one contact method required (enforced in application layer)
-- We don't add a CHECK constraint because it would prevent partial updates
-- Application code enforces: first_name AND (email OR phone) before any write

-- =====================================================================
-- 3. COMMUNICATIONS TABLE
-- =====================================================================
-- Append-only log of all interactions with leads
CREATE TABLE communications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL, -- Future multi-tenancy support
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    
    -- Interaction metadata
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    medium TEXT NOT NULL, -- 'SMS', 'Email', 'WhatsApp', 'Call', 'Zenlist', 'In-person'
    direction TEXT NOT NULL, -- 'Inbound', 'Outbound'
    
    -- Content
    body TEXT NOT NULL, -- Raw message content or call notes
    summary TEXT, -- AI-generated summary (for long interactions)
    
    -- Automation tracking
    trigger TEXT, -- e.g., 'Auto Cadence #3', 'Manual', 'Campaign XYZ'
    related_campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    performed_by TEXT NOT NULL, -- 'System', 'David', agent name, or 'AI'
    
    -- State snapshot
    status_after TEXT -- Snapshot of lead.status after this interaction
);

COMMENT ON TABLE communications IS 'Append-only log of all lead interactions across channels';
COMMENT ON COLUMN communications.trigger IS 'What initiated this communication (cadence step, campaign, manual)';
COMMENT ON COLUMN communications.status_after IS 'Lead status immediately after this interaction (for timeline view)';

-- =====================================================================
-- 4. PENDING_MESSAGES TABLE
-- =====================================================================
-- Queue for messages requiring approval before send (HNW leads, policy checks)
CREATE TABLE pending_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL, -- Future multi-tenancy support
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    
    -- Message details
    channel TEXT NOT NULL, -- 'SMS', 'Email', 'WhatsApp'
    reason TEXT NOT NULL, -- e.g., 'Auto Cadence Step 1', 'Market Report Q4'
    proposed_body TEXT NOT NULL, -- The message awaiting approval
    
    -- Approval workflow
    requires_approval BOOLEAN NOT NULL DEFAULT TRUE,
    status TEXT NOT NULL DEFAULT 'Pending', -- 'Pending', 'Approved', 'Rejected'
    
    -- Audit trail
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_by UUID REFERENCES agents(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ
);

COMMENT ON TABLE pending_messages IS 'Approval queue for HNW and policy-gated outbound messages';
COMMENT ON COLUMN pending_messages.reason IS 'Why this message was created (cadence step, campaign, market update)';

-- =====================================================================
-- 5. CAMPAIGNS TABLE
-- =====================================================================
-- Bulk messaging campaigns (email via Mailchimp, SMS via Twilio)
CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL, -- Future multi-tenancy support
    
    -- Campaign metadata
    name TEXT NOT NULL,
    content_id UUID REFERENCES content_library(id) ON DELETE SET NULL, -- Optional content source
    
    -- Targeting
    segments_targeted TEXT[], -- e.g., {'Investor', 'HNW', 'Condo-Buyer'}
    channels TEXT[], -- {'SMS', 'Email'}
    
    -- Lifecycle
    status TEXT NOT NULL DEFAULT 'Draft', -- 'Draft', 'Pending Approval', 'Scheduled', 'Sent', 'Cancelled'
    scheduled_for TIMESTAMPTZ,
    
    -- Attribution
    created_by UUID REFERENCES agents(id) ON DELETE SET NULL,
    requires_approval BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE campaigns IS 'Bulk message campaigns with segment targeting and approval workflow';
COMMENT ON COLUMN campaigns.content_id IS 'Optional link to content_library for market reports, etc.';

-- =====================================================================
-- 6. CAMPAIGN_RECIPIENTS TABLE
-- =====================================================================
-- Per-lead tracking for campaign delivery status
CREATE TABLE campaign_recipients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL, -- Future multi-tenancy support
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    
    -- Delivery details
    channel TEXT NOT NULL, -- 'SMS' or 'Email'
    message_body TEXT NOT NULL, -- Personalized message for this recipient
    
    -- Status tracking
    status TEXT NOT NULL DEFAULT 'Pending Approval', -- 'Pending Approval', 'Queued', 'Sent', 'Failed'
    sent_at TIMESTAMPTZ,
    
    -- Engagement (populated by webhooks from Mailchimp, Twilio)
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    replied_at TIMESTAMPTZ,
    
    -- Error tracking
    error_message TEXT
);

COMMENT ON TABLE campaign_recipients IS 'Per-lead delivery tracking for campaigns with engagement metrics';
COMMENT ON COLUMN campaign_recipients.message_body IS 'Personalized version of campaign message for this lead';

-- =====================================================================
-- 7. AUDIT_LOG TABLE
-- =====================================================================
-- System-wide audit trail for all actions (reads, writes, approvals)
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL, -- Future multi-tenancy support
    
    -- Event metadata
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actor TEXT NOT NULL, -- 'System', 'David', agent name, 'AI Orchestrator'
    
    -- Action details
    command_raw TEXT, -- Original natural language input (from voice/text)
    parsed_action TEXT NOT NULL, -- e.g., 'create_lead', 'get_leads', 'approve_pending'
    details JSONB, -- Before/after state, IDs touched, filters used
    
    -- Outcome
    status TEXT NOT NULL -- 'Success', 'Error', 'Clarification Needed'
);

COMMENT ON TABLE audit_log IS 'Append-only system audit log for compliance and debugging';
COMMENT ON COLUMN audit_log.command_raw IS 'Original user input (voice transcript or text command)';
COMMENT ON COLUMN audit_log.details IS 'Structured data: before/after values, IDs modified, error details';

-- =====================================================================
-- 8. CONTENT_LIBRARY TABLE
-- =====================================================================
-- Stores reusable content (market reports, listing info, templates)
CREATE TABLE content_library (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL, -- Future multi-tenancy support
    
    -- Content metadata
    title TEXT NOT NULL,
    content_type TEXT NOT NULL, -- 'Market Report', 'Listing', 'Template', 'Newsletter'
    content_body TEXT NOT NULL, -- Raw content (markdown, HTML, or plain text)
    
    -- Targeting & personalization
    segments TEXT[], -- Which segments this content is relevant for
    market_area TEXT, -- e.g., 'San Francisco', 'Marin'
    
    -- Lifecycle
    created_by UUID REFERENCES agents(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ -- For time-sensitive content (price changes, open houses)
);

COMMENT ON TABLE content_library IS 'Reusable content for campaigns: market reports, templates, listing info';
COMMENT ON COLUMN content_library.content_type IS 'Market Report, Listing, Template, or Newsletter';

-- =====================================================================
-- TRIGGERS FOR UPDATED_AT
-- =====================================================================
-- Auto-update updated_at timestamps on row modifications

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_content_library_updated_at BEFORE UPDATE ON content_library
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================================
-- INITIAL DATA SEED
-- =====================================================================
-- Insert a default agent (will be replaced by real auth flow)
-- Use the ACCOUNT_ID_DEFAULT from your .env file here

-- Example (uncomment and replace with your actual default account ID):
-- INSERT INTO agents (account_id, name, email, role)
-- VALUES ('00000000-0000-0000-0000-000000000000', 'David Raygorodsky', 'david.raygorodsky@vanguardproperties.com', 'Owner');
