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
import { logLeadCreated } from '../../db/audit';
import { ValidationError } from '../../middleware/error-handler';

// ============================================================================
// Constants
// ============================================================================

const HNW_THRESHOLD = 3_000_000; // $3M

// TODO: This should be looked up from the agents table in the future
// For now, using the default account for all leads
const DEFAULT_ACCOUNT_ID = 'b0cf6a25-ec83-4c6b-b7c2-2df452fee61f';

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
  budget_min?: number;
  budget_max?: number;
  source?: string;
  status?: string;
  segments?: string[];
  notes?: string;
}

export interface CreateLeadResult {
  success: boolean;
  lead: Lead;
  message: string;
}

// ============================================================================
// Main Action Function
// ============================================================================

/**
 * Execute create_lead action
 * 
 * This function:
 * 1. Validates parameters
 * 2. Checks required fields (must have name and contact info)
 * 3. Auto-detects HNW status based on budget
 * 4. Creates lead in database
 * 5. Returns created lead
 * 
 * @param params - Lead creation parameters
 * @param agentId - ID of agent creating the lead (becomes owner_agent_id)
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
  const segments = detectSegments(validatedParams);

  // Log lead creation attempt
  logger.info('Creating lead', {
    agentId,
    firstName: validatedParams.first_name,
    email: validatedParams.email,
    phone: validatedParams.phone,
    isHNW: segments.includes('High Net Worth'),
  });

  // Create lead in database
  try {
    const lead = await createLead({
      account_id: DEFAULT_ACCOUNT_ID, // Use default account for now
      owner_agent_id: agentId, // Agent creating the lead becomes the owner
      first_name: validatedParams.first_name,
      last_name: validatedParams.last_name,
      email: validatedParams.email,
      phone: validatedParams.phone,
      property_address: validatedParams.property_address,
      neighborhood: validatedParams.neighborhood,
      beds: validatedParams.beds,
      baths: validatedParams.baths,
      price_range: validatedParams.price_range,
      budget_min: validatedParams.budget_min,
      budget_max: validatedParams.budget_max,
      source: validatedParams.source || 'api',
      status: validatedParams.status || 'new',
      segments,
      notes: validatedParams.notes,
      consent_status: 'pending', // Default consent status
    });

    logger.info('Lead created successfully', {
      leadId: lead.id,
      agentId,
      isHNW: segments.includes('High Net Worth'),
    });

  // Audit log
  await logLeadCreated(
    ownerAgentId,
    DEFAULT_ACCOUNT_ID,
    newLead.id,
    params
  );
    return {
      success: true,
      lead,
      message: `Lead created successfully for ${lead.first_name}${lead.last_name ? ' ' + lead.last_name : ''}`,
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
 * 
 * A lead must have:
 * - Name (first_name is required)
 * - At least one contact method (email OR phone)
 * 
 * @param params - Validated parameters
 * @throws ValidationError if required fields are missing
 */
function validateRequiredFields(params: CreateLeadParams): void {
  // Check for contact information
  if (!params.email && !params.phone) {
    throw new ValidationError(
      'Lead must have at least one contact method (email or phone)'
    );
  }
}

/**
 * Detect lead segments based on provided information
 * 
 * Current detection rules:
 * - High Net Worth: budget_max > $3,000,000
 * - (Future: First Time Buyer, Investor, etc.)
 * 
 * @param params - Lead parameters
 * @returns Array of segment tags
 */
function detectSegments(params: CreateLeadParams): string[] {
  const segments: string[] = [...(params.segments || [])];

  // Auto-detect HNW status
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
// Export
// ============================================================================

export default createLeadAction;
