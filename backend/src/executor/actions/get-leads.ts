/**
 * Get Leads Action
 * 
 * This action retrieves leads from the database with optional filters.
 * It supports filtering by status, segments, and search text.
 * 
 * DEPENDENCIES:
 * - backend/src/db/queries.ts: Database operations
 * - backend/src/executor/validators.ts: Parameter validation
 * - backend/src/middleware/logger.ts: Logging
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/executor/index.ts
 * 
 * FILTERING:
 * - status: Filter by lead status (New, Nurture, Hot, Closed, Lost)
 * - segments: Filter by segments (e.g., 'High Net Worth', 'First-time buyer')
 * - search: Search in name, email, phone fields
 */

import { getLeads, Lead } from '../../db/queries';
import { GetLeadsSchema } from '../validators';
import { logger } from '../../middleware/logger';

// ============================================================================
// Types
// ============================================================================

export interface GetLeadsParams {
  status?: 'New' | 'Nurture' | 'Hot' | 'Closed' | 'Lost';
  segments?: string[];
  search?: string;
  limit?: number;
  offset?: number;
}

export interface GetLeadsResult {
  success: boolean;
  leads: Lead[];
  count: number;
  message: string;
}

// ============================================================================
// Main Action Function
// ============================================================================

/**
 * Execute get_leads action
 * 
 * This function:
 * 1. Validates filter parameters
 * 2. Queries database with filters
 * 3. Returns matching leads
 * 
 * @param params - Query filter parameters
 * @param agentId - ID of agent requesting leads
 * @returns Result with matching leads
 * 
 * @example
 * const result = await getLeadsAction(
 *   { status: 'active', segments: ['High Net Worth'] },
 *   'agent-123'
 * );
 */
export async function getLeadsAction(
  params: GetLeadsParams,
  agentId: string
): Promise<GetLeadsResult> {
  // Validate parameters with Zod schema
  const validatedParams = GetLeadsSchema.parse(params);

  try {
    // Query leads from database
    const leads = await getLeads(agentId, {
      status: validatedParams.status,
      segments: validatedParams.segments,
      search: validatedParams.search,
      limit: validatedParams.limit,
      offset: validatedParams.offset,
    });

    logger.info('Get leads successful', {
      agentId,
      count: leads.length,
      filters: validatedParams,
    });

    // Build descriptive message
    let message = `Found ${leads.length} lead${leads.length === 1 ? '' : 's'}`;
    if (validatedParams.status) {
      message += ` with status "${validatedParams.status}"`;
    }
    if (validatedParams.segments && validatedParams.segments.length > 0) {
      message += ` in segments: ${validatedParams.segments.join(', ')}`;
    }
    if (validatedParams.search) {
      message += ` matching "${validatedParams.search}"`;
    }

    return {
      success: true,
      leads,
      count: leads.length,
      message,
    };
  } catch (error) {
    logger.error('Failed to get leads', {
      error: error instanceof Error ? error.message : String(error),
      agentId,
      params: validatedParams,
    });
    throw error;
  }
}

// ============================================================================
// Export
// ============================================================================

export default getLeadsAction;
