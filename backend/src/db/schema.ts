/**
 * Database schema and shared types for RealLeads.ai
 *
 * This module provides TypeScript representations of our core
 * Postgres / Supabase tables. It is meant to be a single source
 * of truth for field names and meanings in the backend.
 *
 * Goals:
 * - Avoid confusion between runtime names (agentId) and DB columns
 *   (owner_agent_id, account_id, etc.).
 * - Make it easier to see what each table is for and how IDs relate.
 * - Give us strongly-typed input/output shapes for query helpers.
 */

export type UUID = string;

/**
 * AgentRow
 *
 * Represents a row in the `agents` table.
 *
 * This is the identity for a human user of the system (you, teammates, ISAs, etc.).
 * Other tables (like `leads`) reference this via `owner_agent_id`.
 */
export interface AgentRow {
  /** Primary key for the agent */
  id: UUID;

  /** Agent's display name */
  name: string;

  /** Unique email for login / contact */
  email: string;

  /** Optional phone number */
  phone: string | null;

  /**
   * Role within the system.
   * Examples: 'Owner', 'Agent', 'ISA', 'Admin'
   */
  role: string;

  /** Creation timestamp */
  created_at: string;
}

/**
 * LeadRow
 *
 * Represents a row in the `leads` table.
 *
 * This is an individual prospect / client, optionally tied to an owning agent
 * and an account/team. The lead can have search preferences, segments, and
 * communication metadata.
 */
export interface LeadRow {
  /** Primary key for the lead */
  id: UUID;

  /**
   * Account / team this lead belongs to.
   * For now we use a single default account, but this supports multi-tenant
   * separation in the future.
   */
  account_id: UUID;

  /**
   * Agent who owns this lead.
   * This should reference `agents.id`.
   */
  owner_agent_id: UUID | null;

  /** Source of the lead (e.g. 'Zillow', 'Open House', 'Referral') */
  source: string | null;

  /** When the lead was created (logical business timestamp) */
  created_date: string | null;

  /** Free-form initial property reference (address, MLS id, etc.) */
  init_property: string | null;

  /** Lead's first name (required in our business logic) */
  first_name: string;

  /** Lead's last name (optional) */
  last_name: string | null;

  /** Contact information */
  email: string | null;
  phone: string | null;
  linkedin: string | null;

  /** Budget information */
  budget_min: number | null;
  budget_max: number | null;
  price_range: string | null;

  /**
   * Property type preferences.
   * Examples: 'Condo', 'SFH', 'multifamily', '5+ units', 'Commercial/mixed use'
   */
  property_type: string[] | null;

  /** Timeline to transact: '0–3mo', '3–6mo', '6–12mo', '>12mo', 'Browsing' */
  timeline: string | null;

  /**
   * What the lead is interested in.
   * Examples: 'Buying', 'Selling', 'Investing', 'Leasing'
   */
  interested_in: string[] | null;

  /**
   * Whether they already have an agent.
   * Examples: 'Yes', 'No', 'Not sure'
   */
  have_agent: string | null;

  /** Name of their existing agent, if any */
  their_agent_name: string | null;

  /**
   * Segmentation tags.
   * Examples include: 'High Net Worth', 'Investor', 'Past Client', etc.
   */
  segments: string[] | null;

  /** Status in our pipeline: 'New', 'Nurture', 'Hot', 'Closed', 'Lost' */
  status: string | null;

  /** Subject / search preferences */
  property_address: string | null;
  neighborhood: string | null;
  beds: number | null;
  baths: number | null;

  /** Free-form notes from conversations or internal context */
  notes: string | null;

  /** Buyer broker agreement expiration date, if signed */
  buyer_broker_expiration: string | null;

  /** Communication tracking */
  last_communication_date: string | null;
  next_communication_date: string | null;

  /** Preferred communication channel: 'SMS', 'Email', 'Both', 'WhatsApp' */
  preferred_medium: string | null;

  /** Market area (e.g. 'San Francisco', 'Marin') */
  market_area: string | null;

  /**
   * Consent status for outreach.
   * Examples: 'Cold', 'Implied', 'Opted-In', 'Do Not Contact'
   */
  consent_status: string | null;

  /** System timestamps */
  created_at: string;
  updated_at: string;
}

/**
 * AuditLogRow
 *
 * Represents a row in the `audit_log` table.
 *
 * This captures who did what, for which account, to which entities,
 * and with which payload.
 *
 * DB columns (from Supabase):
 * - id            uuid
 * - account_id    uuid
 * - timestamp     timestamptz
 * - actor         text
 * - command_raw   text
 * - parsed_action text
 * - details       jsonb
 * - status        text
 */
export interface AuditLogRow {
  /** Primary key for the audit entry */
  id: UUID;

  /**
   * Account / team this audit entry belongs to.
   * Should match the `account_id` used on related entities (e.g., leads).
   */
  account_id: UUID;

  /** When the action occurred */
  timestamp: string;

  /**
   * Actor name or ID.
   * In many systems this is a string like 'System', 'David', or 'Agent Name'.
   * We may later switch this to a structured `actor_agent_id`.
   */
  actor: string;

  /** Raw command (if coming from NL interface) */
  command_raw: string | null;

  /** Parsed action name (e.g. 'create_lead', 'update_lead', 'approve_pending') */
  parsed_action: string | null;

  /**
   * JSON details with rich context.
   * Typically includes IDs touched and before/after snapshots.
   */
  details: unknown;

  /** Outcome status of the action: e.g. 'Success', 'Error', 'Pending' */
  status: string;
}

/**
 * Helper type for creating a new lead (insert payload).
 *
 * This is the shape your `createLead` query helper expects as input.
 * It may omit auto-generated fields like `id`, `created_at`, etc.
 */
export type NewLeadInput = Omit<
  LeadRow,
  | 'id'
  | 'created_at'
  | 'updated_at'
  | 'created_date'
  | 'last_communication_date'
  | 'next_communication_date'
> & {
  /** We still allow omitting some DB-managed timestamps when inserting */
  created_date?: string | null;
  last_communication_date?: string | null;
  next_communication_date?: string | null;
};
