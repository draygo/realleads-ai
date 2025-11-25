/**
 * Create Lead Action
 * 
 * This action creates a new lead in the database with the provided information.
 * It validates required fields, auto-detects HNW status, and sets default values.
 * 
 * DEPENDENCIES:
 * - backend/src/db/queries.ts: Database operations
 * - backend/src/executor/validators.ts: Parameter validation
 * - backend/src/middleware/logger.ts: Logging
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/executor/index.ts
 * 
 * HNW DETECTION:
 * - Automatically adds 'High Net Worth' segment if budget_max > $3,000,000
 * - This triggers approval requirements for outbound messages
 */

import { createLead, Lead } from '../../db/queries';
import { CreateLeadSchema } from '../validators';
import { logger } from '../../middleware/logger';
import { ValidationError } from '../../middleware/error-handler';

// ============================================================================
// Types
// ============================================================================

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
  budget_max?: number;
  source?: string;
  status?: string;
  segments?: string[];
  tags?: string[];
  notes?: string;
}

export interface CreateLeadResult {
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
 * Execute create_lead action
 * 
 * This function:
 * 1. Validates parameters
 * 2. Checks required fields (must have name, contact, and property info)
 * 3. Auto-detects HNW status based on budget
 * 4. Creates lead in database
 * 5. Returns created lead
 * 
 * @param params - Lead creation parameters
 * @param agentId - ID of agent creating the lead
 * @returns Result with created lead
 * @throws ValidationError if required fields are missing
 * 
 * @example
 * const result = await createLeadAction(
 *   {
 *     first_name: 'Sarah',
 *     last_name: 'Lee',
 *     email: 'sarah@example.com',
 *     budget_max: 1500000,
 *     neighborhood: 'SOMA',
 *     beds: 2,
 *     baths: 2
 *   },
 *   'agent-123'
 * );
 */
export async function createLeadAction(
  params: CreateLeadParams,
  agentId: string
): Promise<CreateLeadResult> {
  // Validate parameters with Zod schema
  const validatedParams = CreateLeadSchema.parse(params);

  // Additional business logic validation
  validateRequiredFields(validatedParams);

  // Auto-detect HNW status
  const segments = validatedParams.segments || [];
  if (validatedParams.budget_max && validatedParams.budget_max > HNW_THRESHOLD) {
    if (!segments.includes('High Net Worth')) {
      segments.push('High Net Worth');
      logger.info('Auto-detected HNW lead', {
        first_name: validatedParams.first_name,
        budget_max: validatedParams.budget_max,
      });
    }
  }

  // Set default status if not provided
  const status = validatedParams.status || 'new';

  try {
    // Create lead in database
    const lead = await createLead({
      agent_id: agentId,
      first_name: validatedParams.first_name,
      last_name: validatedParams.last_name,
      email: validatedParams.email,
      phone: validatedParams.phone,
      property_address: validatedParams.property_address,
      neighborhood: validatedParams.neighborhood,
      beds: validatedParams.beds,
      baths: validatedParams.baths,
      price_range: validatedParams.price_range,
      budget_max: validatedParams.budget_max,
      source: validatedParams.source,
      status,
      segments,
      tags: validatedParams.tags,
      notes: validatedParams.notes,
    });

    logger.info('Lead created successfully', {
      leadId: lead.id,
      agentId,
      first_name: lead.first_name,
      isHNW: segments.includes('High Net Worth'),
    });

    return {
      success: true,
      lead,
      message: `Lead created for ${lead.first_name}${
        lead.last_name ? ' ' + lead.last_name : ''
      }${segments.includes('High Net Worth') ? ' (HNW)' : ''}`,
    };
  } catch (error) {
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
 * Validate that required fields are present
 * The orchestrator should handle this, but we double-check here
 * 
 * Required fields:
 * - first_name
 * - At least one of: {email, phone}
 * - At least one of: {property_address, (neighborhood + beds + baths)}
 * - At least one of: {budget_max, price_range}
 * 
 * @param params - Validated parameters
 * @throws ValidationError if required fields are missing
 */
function validateRequiredFields(params: CreateLeadParams): void {
  const errors: string[] = [];

  // Check contact info
  if (!params.email && !params.phone) {
    errors.push('Either email or phone is required');
  }

  // Check property info
  const hasPropertyAddress = !!params.property_address;
  const hasNeighborhoodInfo =
    !!params.neighborhood && params.beds !== undefined && params.baths !== undefined;

  if (!hasPropertyAddress && !hasNeighborhoodInfo) {
    errors.push(
      'Either property_address or (neighborhood + beds + baths) is required'
    );
  }

  // Check budget info
  if (!params.budget_max && !params.price_range) {
    errors.push('Either budget_max or price_range is required');
  }

  if (errors.length > 0) {
    throw new ValidationError(
      `Cannot create lead - missing required fields: ${errors.join(', ')}`
    );
  }
}

/**
 * Check if a lead is HNW
 * 
 * @param lead - Lead object or params
 * @returns true if HNW
 */
export function isHNWLead(lead: {
  budget_max?: number;
  segments?: string[];
}): boolean {
  // Check explicit HNW segment
  if (lead.segments?.includes('High Net Worth')) {
    return true;
  }

  // Check budget threshold
  if (lead.budget_max && lead.budget_max > HNW_THRESHOLD) {
    return true;
  }

  return false;
}

// ============================================================================
// Export
// ============================================================================

export default createLeadAction;

// Export helper for use in other actions
export { isHNWLead };
