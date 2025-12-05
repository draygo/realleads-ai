/**
 * Update Lead Action
 * 
 * This action updates an existing lead in the database.
 * It validates parameters and ensures the lead belongs to the requesting agent.
 * 
 * DEPENDENCIES:
 * - backend/src/db/queries.ts: Database operations
 * - backend/src/executor/validators.ts: Parameter validation
 * - backend/src/middleware/logger.ts: Logging
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/executor/index.ts
 * 
 * FEATURES:
 * - Update any lead field (email, phone, status, notes, etc.)
 * - Auto-detects HNW status when budget_max is updated
 * - Security: Only owner can update their leads
 */

import { updateLead, getLeadById, Lead } from '../../db/queries';
import { UpdateLeadSchema } from '../validators';
import { logger } from '../../middleware/logger';
import { logLeadUpdated } from '../../db/audit';
import { ValidationError } from '../../middleware/error-handler';

// ============================================================================
// Types
// ============================================================================

export interface UpdateLeadParams {
  lead_id: string;
  first_name?: string;
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

export interface UpdateLeadResult {
  success: boolean;
  lead: Lead;
  message: string;
}

// ============================================================================
// Constants
// ============================================================================

const HNW_THRESHOLD = 3_000_000; // $3M

// ============================================================================
// Main Action Function
// ============================================================================

/**
 * Execute update_lead action
 * 
 * This function:
 * 1. Validates parameters
 * 2. Auto-detects HNW status if budget is updated
 * 3. Updates lead in database
 * 4. Returns updated lead
 * 
 * @param params - Update parameters (must include lead_id)
 * @param agentId - ID of agent updating the lead (must be owner)
 * @returns Result with updated lead
 * @throws ValidationError if lead not found or access denied
 * 
 * @example
 * const result = await updateLeadAction(
 *   {
 *     lead_id: '123-456',
 *     email: 'newemail@example.com',
 *     status: 'contacted'
 *   },
 *   'agent-123'
 * );
 */
export async function updateLeadAction(
  params: UpdateLeadParams,
  agentId: string
): Promise<UpdateLeadResult> {
  // Validate parameters with Zod schema
  const validatedParams = UpdateLeadSchema.parse(params);

  const { lead_id, ...updates } = validatedParams;

  // Auto-detect HNW status if budget is being updated
  if (updates.budget_max !== undefined) {
    const segments = updates.segments || [];
    if (updates.budget_max > HNW_THRESHOLD && !segments.includes('High Net Worth')) {
      updates.segments = [...segments, 'High Net Worth'];
      logger.debug('Auto-added High Net Worth segment', {
        leadId: lead_id,
        budget: updates.budget_max,
      });
    } else if (updates.budget_max <= HNW_THRESHOLD && segments.includes('High Net Worth')) {
      // Remove HNW if budget drops below threshold
      updates.segments = segments.filter(s => s !== 'High Net Worth');
      logger.debug('Removed High Net Worth segment', {
        leadId: lead_id,
        budget: updates.budget_max,
      });
    }
  }

  // Log update attempt
  logger.info('Updating lead', {
    agentId,
    leadId: lead_id,
    fieldsToUpdate: Object.keys(updates),
  });
  try {
    // Fetch existing lead for audit trail
    const existingLead = await getLeadById(lead_id, agentId);
    const lead = await updateLead(lead_id, agentId, updates);

    logger.info('Lead updated successfully', {
      leadId: lead.id,
      agentId,
      updatedFields: Object.keys(updates),
    });

    // Build human-readable message
    const updatedFieldsList = Object.keys(updates).join(', ');
    const message = `Successfully updated ${lead.first_name}${lead.last_name ? ' ' + lead.last_name : ''} (${updatedFieldsList})`;

    // Audit log - track what changed
    const changes: Record<string, { old: any; new: any }> = {};
    for (const key of Object.keys(updates)) {
      changes[key] = {
        old: existingLead[key as keyof typeof existingLead],
        new: updates[key as keyof typeof updates],
      };
    }
    
    await logLeadUpdated(
      agentId,
      existingLead.account_id,
      lead.id,
      `${lead.first_name}${lead.last_name ? " " + lead.last_name : ""}`,
      changes
    );
    return {
      success: true,
      lead,
      message,
    };
  } catch (error) {
    logger.error('Failed to update lead', {
      error: error instanceof Error ? error.message : String(error),
      agentId,
      leadId: lead_id,
      params: updates,
    });

    // Check if it's an access denied error
    if (error instanceof Error && error.message.includes('not found or access denied')) {
      throw new ValidationError(
        'Lead not found or you do not have permission to update it'
      );
    }

    throw error;
  }
}

// ============================================================================
// Export
// ============================================================================

export default updateLeadAction;
