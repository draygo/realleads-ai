/**
 * Shared TypeScript types for RealLeads.ai
 * Used by both backend and frontend to ensure type safety
 */

// =====================================================================
// DATABASE ENTITY TYPES
// =====================================================================

export interface Agent {
  id: string;
  account_id: string;
  name: string;
  email: string;
  phone: string | null;
  role: 'Owner' | 'Agent' | 'ISA' | 'Admin';
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  account_id: string;
  source: string | null;
  owner_agent_id: string | null;
  created_date: string;
  init_property: string | null;
  first_name: string;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  linkedin: string | null;
  budget_min: number | null;
  budget_max: number | null;
  price_range: string | null;
  property_type: string[] | null;
  timeline: string | null;
  interested_in: string[] | null;
  have_agent: string | null;
  their_agent_name: string | null;
  buyer_broker_expiration: string | null;
  segments: string[] | null;
  status: 'New' | 'Nurture' | 'Hot' | 'Closed' | 'Lost';
  property_address: string | null;
  neighborhood: string | null;
  beds: number | null;
  baths: number | null;
  notes: string | null;
  last_communication_date: string | null;
  next_communication_date: string | null;
  preferred_medium: 'SMS' | 'Email' | 'Both' | 'WhatsApp';
  market_area: string | null;
  consent_status: 'Cold' | 'Implied' | 'Opted-In' | 'Do Not Contact';
  created_at: string;
  updated_at: string;
}

export interface Communication {
  id: string;
  account_id: string;
  lead_id: string;
  timestamp: string;
  medium: 'SMS' | 'Email' | 'WhatsApp' | 'Call' | 'Zenlist' | 'In-person';
  direction: 'Inbound' | 'Outbound';
  body: string;
  summary: string | null;
  trigger: string | null;
  related_campaign_id: string | null;
  performed_by: string;
  status_after: string | null;
}

export interface PendingMessage {
  id: string;
  account_id: string;
  lead_id: string;
  channel: 'SMS' | 'Email' | 'WhatsApp';
  reason: string;
  proposed_body: string;
  requires_approval: boolean;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
  approved_by: string | null;
  approved_at: string | null;
}

export interface Campaign {
  id: string;
  account_id: string;
  name: string;
  content_id: string | null;
  segments_targeted: string[] | null;
  channels: string[] | null;
  status: 'Draft' | 'Pending Approval' | 'Scheduled' | 'Sent' | 'Cancelled';
  scheduled_for: string | null;
  created_by: string | null;
  requires_approval: boolean;
  created_at: string;
  updated_at: string;
}

export interface CampaignRecipient {
  id: string;
  account_id: string;
  campaign_id: string;
  lead_id: string;
  channel: 'SMS' | 'Email';
  message_body: string;
  status: 'Pending Approval' | 'Queued' | 'Sent' | 'Failed';
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  replied_at: string | null;
  error_message: string | null;
}

export interface AuditLog {
  id: string;
  account_id: string;
  timestamp: string;
  actor: string;
  command_raw: string | null;
  parsed_action: string;
  details: Record<string, any> | null;
  status: 'Success' | 'Error' | 'Clarification Needed';
}

export interface ContentLibrary {
  id: string;
  account_id: string;
  title: string;
  content_type: 'Market Report' | 'Listing' | 'Template' | 'Newsletter';
  content_body: string;
  segments: string[] | null;
  market_area: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
}

// =====================================================================
// ORCHESTRATOR TYPES
// =====================================================================

export type OrchestratorMode = 'clarification_needed' | 'execute';

export interface ClarificationResponse {
  mode: 'clarification_needed';
  explanation: string;
  missing_fields: string[];
  follow_up_question: string;
}

export interface ExecuteResponse {
  mode: 'execute';
  explanation: string;
  actions: Action[];
  ui: {
    render: 'table' | 'cards' | 'graph' | 'notice';
    summary: string;
  };
}

export type OrchestratorResponse = ClarificationResponse | ExecuteResponse;

// =====================================================================
// ACTION TYPES
// =====================================================================

export type ActionType =
  | 'get_leads'
  | 'get_communications'
  | 'create_lead'
  | 'update_lead'
  | 'draft_initial_followup'
  | 'create_pending_message'
  | 'approve_pending_message'
  | 'reject_pending_message'
  | 'send_sms'
  | 'send_whatsapp'
  | 'send_email'
  | 'ingest_content'
  | 'summarize_content_for_segments'
  | 'stage_campaign_from_content'
  | 'create_mailchimp_campaign'
  | 'queue_mailchimp_recipients'
  | 'send_mailchimp_campaign';

export interface BaseAction {
  type: ActionType;
}

export interface GetLeadsAction extends BaseAction {
  type: 'get_leads';
  filters?: {
    segment?: string | string[];
    market_area?: string;
    status?: string;
    last_contacted_days_gt?: number;
    owner_agent_email?: string;
    next_comm_due?: boolean;
  };
  fields?: string[];
  limit?: number;
  offset?: number;
}

export interface GetCommunicationsAction extends BaseAction {
  type: 'get_communications';
  filters?: {
    lead_id?: string;
    medium?: string;
    direction?: string;
    date_from?: string;
    date_to?: string;
  };
  limit?: number;
}

export interface CreateLeadAction extends BaseAction {
  type: 'create_lead';
  payload: {
    first_name: string;
    last_name?: string;
    email?: string;
    phone?: string;
    source: string;
    segments?: string[];
    subject?: {
      property_address?: string;
      neighborhood?: string;
      beds?: number;
      baths?: number;
    };
    preferences?: {
      neighborhood?: string;
      beds?: number;
      baths?: number;
      budget_max?: number;
      budget_min?: number;
      price_range_hint?: string;
      property_type?: string[];
      timeline?: string;
      interested_in?: string[];
    };
    consent_status?: string;
    owner_agent_email?: string;
    market_area?: string;
    notes?: string;
  };
}

export interface UpdateLeadAction extends BaseAction {
  type: 'update_lead';
  lead_id: string;
  updates: Partial<Lead>;
}

export interface DraftInitialFollowupAction extends BaseAction {
  type: 'draft_initial_followup';
  payload: {
    lead_id: string;
    channel: 'SMS' | 'Email' | 'WhatsApp';
    context: string;
    listing_selection?: {
      strategy: 'by_subject_or_preferences' | 'manual';
      limit?: number;
      zenlist_urls?: string[];
    };
  };
}

export interface CreatePendingMessageAction extends BaseAction {
  type: 'create_pending_message';
  payload: {
    lead_id: string;
    channel: 'SMS' | 'Email' | 'WhatsApp';
    reason: string;
    proposed_body: string;
    requires_approval?: boolean;
  };
}

export interface ApprovePendingMessageAction extends BaseAction {
  type: 'approve_pending_message';
  pending_message_id: string;
  approved_by_email: string;
}

export interface SendMessageAction extends BaseAction {
  type: 'send_sms' | 'send_whatsapp' | 'send_email';
  payload: {
    lead_id: string;
    body: string;
    subject?: string; // For email
  };
}

export type Action =
  | GetLeadsAction
  | GetCommunicationsAction
  | CreateLeadAction
  | UpdateLeadAction
  | DraftInitialFollowupAction
  | CreatePendingMessageAction
  | ApprovePendingMessageAction
  | SendMessageAction;

// =====================================================================
// API REQUEST/RESPONSE TYPES
// =====================================================================

export interface CommandRequest {
  input: string;
  actor?: string;
}

export interface CommandResponse {
  explanation: string;
  follow_up_question?: string;
  missing_fields?: string[];
  ui?: {
    render: 'table' | 'cards' | 'graph' | 'notice';
    summary: string;
  };
  data?: any;
  error?: string;
}

export interface HealthIntegration {
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  message?: string;
  required: boolean;
}

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  integrations: HealthIntegration[];
}

// =====================================================================
// LEAD CONTEXT (for tone adaptation)
// =====================================================================

export interface LeadContext {
  segment: string[];
  price_band: string;
  property_type: string[];
  timeline: string;
  market_area: string;
}

// =====================================================================
// DIGEST TYPES
// =====================================================================

export interface DailyDigestData {
  date: string;
  new_leads: {
    total: number;
    by_source: Record<string, number>;
    by_segment: Record<string, number>;
  };
  outbound_messages: {
    by_channel: Record<string, number>;
  };
  hnw_pending: {
    count: number;
    approved: number;
    rejected: number;
  };
  reply_rate: number;
  top_opportunities: Array<{
    lead_name: string;
    lead_id: string;
    reason: string;
  }>;
  due_followups_today: number;
}

export interface WeeklyDigestData extends DailyDigestData {
  week_start: string;
  week_end: string;
  week_over_week_delta: {
    leads: number;
    messages: number;
    reply_rate: number;
  };
  best_performing_segment: string;
  top_message_templates: Array<{
    template: string;
    reply_rate: number;
  }>;
  delivery_issues: string[];
}
