/**
 * Create Lead Action
 *
 * PURPOSE:
 * --------
 * This module defines the `createLeadAction` function used by the executor
 * to create a new lead in the database.
 *
 * It:
 *  - Validates incoming parameters with Zod (`CreateLeadSchema`)
 *  - Enforces basic business rules (must have at least one contact method)
 *  - Auto-detects High Net Worth (HNW) status from budget_max
 *  - Persists the lead via the `createLead` DB helper
 *  - Writes an audit log entry with `logLeadCreated`
 *
 * IMPORTANT:
 * ----------
 * - `agentId` (the caller) becomes `owner_agent_id` on the lead.
 * - `DEFAULT_ACCOUNT_ID` is a temporary stand-in until we wire true multi-account.
 *
 * USED BY:
 * --------
 * - backend/src/executor/index.ts (executor dispatches to this action)
 */

import { createLead } from '../../db/queries';
import type { NewLeadInput, LeadRow } from '../../db/schema';
import { CreateLeadSchema } from '../validators';
import { logger } from '../../middleware/logger';
import { logLeadCreated } from '../../db/audit';
import { ValidationError } from '../../middleware/error-handler';

// ============================================================================
// Constants
// ============================================================================

/**
 * Threshold for automatic High Net Worth (HNW) tagging.
 * Any lead with budget_max > HNW_THRESHOLD is tagged as 'High Net Worth'.
 */
const HNW_THRESHOLD = 3_000_000; // $3M

/**
 * TEMPORARY DEFAULT ACCOUNT ID
 * ----------------------------
 * For now, all leads are associated with a single default account.
 * In a true multi-tenant setup, the executor will pass `accountId` explicitly.
 */
const DEFAULT_ACCOUNT_ID = 'b0cf6a25-ec83-4c6b-b7c2-2df452fee61f';

// ============================================================================
// Types
// ============================================================================

/**
 * Parameters accepted by the create_lead action.
 * These should align with the Zod `CreateLeadSchema`.
 */
export interface CreateLeadParams {
  first_name: string;
  last_name?: string;
  email?: string;
  phone?: string;
  property_address?: string;
  neighborhood?: string;
  beds?: number;
  baths?: number;
  price_range?: string;
  budget_min?: number;
  budget_max?: number;
  source?: string;
  status?: string;
  segments?: string[];
  notes?: string;
}

/**
 * Return shape for the create_lead action.
 */
export interface CreateLeadResult {
  success: boolean;
  lead: LeadRow;
  message: string;
}

// ============================================================================
// Main Action Function
// ============================================================================

/**
 * createLeadAction
 * ----------------
 * Main entry point for the `create_lead` executor action.
 *
 * STEPS:
 * 1. Validate params with Zod (`CreateLeadSchema`)
 * 2. Enforce required business rules (name, contact info)
 * 3. Detect segments (e.g., High Net Worth)
 * 4. Persist the new lead in the database
 * 5. Write an audit log entry
 * 6. Return the created lead and a human-readable message
 *
 * @param params  - Lead creation parameters from the orchestrator/executor
 * @param agentId - ID of the agent creating the lead (used as owner_agent_id)
 */
export async function createLeadAction(
  params: CreateLeadParams,
  agentId: string
): Promise<CreateLeadResult> {
  // 1) Validate parameters using the Zod schema.
  //    This ensures types and basic constraints are correct.
  const validatedParams = CreateLeadSchema.parse(params);

  // 2) Enforce additional business rules beyond the schema.
  validateRequiredFields(validatedParams);

  // 3) Auto-detect segments (e.g., High Net Worth) based on budget and other info.
  const segments = detectSegments(validatedParams);

  // 4) Log that we’re about to create a lead (for debugging/observability).
  logger.info('Creating lead', {
    agentId,
    firstName: validatedParams.first_name,
    email: validatedParams.email,
    phone: validatedParams.phone,
    isHNW: segments.includes('High Net Worth'),
  });

  try {
    // 5) Persist the lead in the database via the query helper.
    // Build NewLeadInput with account_id and owner_agent_id from provided input
    const newLeadInput: NewLeadInput = {
      account_id: DEFAULT_ACCOUNT_ID,
      owner_agent_id: agentId,
      first_name: validatedParams.first_name,
      last_name: validatedParams.last_name || null,
      email: validatedParams.email || null,
      phone: validatedParams.phone || null,
      property_address: validatedParams.property_address || null,
      neighborhood: validatedParams.neighborhood || null,
      beds: validatedParams.beds || null,
      baths: validatedParams.baths || null,
      price_range: validatedParams.price_range || null,
      budget_min: validatedParams.budget_min || null,
      budget_max: validatedParams.budget_max || null,
      source: validatedParams.source || 'api',
      status: validatedParams.status || 'New',
      segments: segments.length > 0 ? segments : null,
      notes: validatedParams.notes || null,
      consent_status: 'Cold',
      property_type: null,
      timeline: null,
      interested_in: null,
      have_agent: null,
      their_agent_name: null,
      buyer_broker_expiration: null,
      linkedin: null,
      init_property: null,
      preferred_medium: null,
      market_area: null,
      last_communication_date: null,
      next_communication_date: null,
      subject_property_id: null,
      subject_beds: null,
      subject_baths: null,
      subject_sqft: null,
      subject_list_price: null,
      subject_list_price_source: null,
      zenlist_collab_link: null,
    };

    const lead = await createLead(newLeadInput);

    // 6) Log successful creation with the new lead id.
    logger.info('Lead created successfully', {
      leadId: lead.id,
      agentId,
      isHNW: segments.includes('High Net Worth'),
    });

    // 7) Write an audit log entry capturing who created what and with which data.
    // Audit logging: record the agent who created the lead, account, lead ID, and validated params
    await logLeadCreated(
      agentId,            // agent's ID (who created the lead)
      DEFAULT_ACCOUNT_ID, // account ID used
      lead.id,            // created lead's id
      validatedParams     // validated params payload
    );

    // 8) Return a typed success response back to the executor/orchestrator.
    return {
      success: true,
      lead,
      message: `Lead created successfully for ${lead.first_name}${
        lead.last_name ? ' ' + lead.last_name : ''
      }`,
    };
  } catch (error) {
    // 9) On failure, log error details and rethrow so higher layers can handle it.
    logger.error('Failed to create lead', {
      error: error instanceof Error ? error.message : String(error),
      agentId,
      params: validatedParams,
    });
    throw error;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * validateRequiredFields
 * ----------------------
 * Enforces business rules that are not strictly type-related.
 *
 * Rules:
 * - first_name must be present (Zod should already enforce this, but we double-check)
 * - At least one contact method (email OR phone) must be provided
 *
 * @param params - Validated parameters (already passed through Zod)
 * @throws ValidationError if requirements are not met
 */
function validateRequiredFields(params: CreateLeadParams): void {
  // Ensure first_name is present as a sanity check
  if (!params.first_name || params.first_name.trim().length === 0) {
    throw new ValidationError('Lead must have a first name');
  }

  // Ensure we have at least one way to contact the lead
  if (!params.email && !params.phone) {
    throw new ValidationError(
      'Lead must have at least one contact method (email or phone)'
    );
  }
}

/**
 * detectSegments
 * --------------
 * Computes segment tags for the lead based on its attributes.
 *
 * Current rules:
 * - High Net Worth: budget_max > HNW_THRESHOLD
 *
 * @param params - Lead parameters (validated)
 * @returns An array of segment tags (including existing ones passed in)
 */
function detectSegments(params: CreateLeadParams): string[] {
  // Start with any segments the caller already provided
  const segments: string[] = [...(params.segments || [])];

  // Auto-tag High Net Worth if budget_max exceeds the configured threshold
  if (params.budget_max && params.budget_max > HNW_THRESHOLD) {
    if (!segments.includes('High Net Worth')) {
      segments.push('High Net Worth');
      logger.debug('Auto-detected High Net Worth segment', {
        budget: params.budget_max,
        threshold: HNW_THRESHOLD,
      });
    }
  }

  return segments;
}

// ============================================================================
// Default Export
// ============================================================================

/**
 * Default export so the executor can import this module as:
 *   import createLeadAction from './actions/create-lead';
 */
export default createLeadAction;
