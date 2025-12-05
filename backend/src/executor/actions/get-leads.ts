/**
 * Get Leads Action
 * 
 * This action queries leads from the database with optional filters.
 * It supports filtering by status, segments, email, phone, neighborhood, and text search.
 * 
 * DEPENDENCIES:
 * - backend/src/db/queries.ts: Database operations
 * - backend/src/executor/validators.ts: Parameter validation
 * - backend/src/middleware/logger.ts: Logging
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/executor/index.ts
 * - Used by: backend/src/routes/leads.ts (for REST API)
 * 
 * FEATURES:
 * - Filter by status (new, contacted, qualified, closed, lost)
 * - Filter by segments (e.g., 'High Net Worth', 'First Time Buyer')
 * - Filter by email (exact match)
 * - Filter by phone (exact match)
 * - Filter by neighborhood (exact match)
 * - Text search in name, email, phone (supports "John Smith" style queries)
 * - Pagination support (limit, offset)
 */

import { getLeadsByAgent, Lead } from '../../db/queries';
import { GetLeadsSchema } from '../validators';
import { logger } from '../../middleware/logger';

// ============================================================================
// Types
// ============================================================================

export interface GetLeadsParams {
  status?: string;
  segments?: string[];
  tags?: string[];
  email?: string;
  phone?: string;
  neighborhood?: string;
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
 * 1. Validates parameters
 * 2. Queries database with filters
 * 3. Returns matching leads
 * 
 * @param params - Query parameters (filters, pagination)
 * @param agentId - ID of agent querying leads
 * @returns Result with matching leads
 * 
 * @example
 * // Get leads by email
 * const result = await getLeadsAction(
 *   { email: 'john@example.com' },
 *   'agent-123'
 * );
 * 
 * @example
 * // Search for "John Smith"
 * const result = await getLeadsAction(
 *   { search: 'John Smith' },
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
    const leads = await getLeadsByAgent(agentId, {
      status: validatedParams.status,
      segments: validatedParams.segments,
      email: validatedParams.email,
      phone: validatedParams.phone,
      neighborhood: validatedParams.neighborhood,
      search: validatedParams.search,
      limit: validatedParams.limit || 50, // Default limit
      offset: validatedParams.offset || 0,
    });

    logger.info('Leads queried successfully', {
      agentId,
      count: leads.length,
      filters: validatedParams,
    });

    // Generate human-readable message
    const message = buildResultMessage(leads, validatedParams);

    return {
      success: true,
      leads,
      count: leads.length,
      message,
    };
  } catch (error) {
    logger.error('Failed to query leads', {
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
 * Build a human-readable message describing the query results
 * 
 * @param leads - Query results
 * @param params - Query parameters
 * @returns Human-readable message
 */
function buildResultMessage(leads: Lead[], params: GetLeadsParams): string {
  if (leads.length === 0) {
    if (Object.keys(params).length === 0) {
      return 'You have no leads yet';
    }
    return 'No leads found matching your criteria';
  }

  // Build description of filters
  const filterParts: string[] = [];

  if (params.status) {
    filterParts.push(`status: ${params.status}`);
  }

  if (params.segments && params.segments.length > 0) {
    filterParts.push(`segments: ${params.segments.join(', ')}`);
  }

  if (params.email) {
    filterParts.push(`email: ${params.email}`);
  }

  if (params.phone) {
    filterParts.push(`phone: ${params.phone}`);
  }

  if (params.neighborhood) {
    filterParts.push(`neighborhood: ${params.neighborhood}`);
  }

  if (params.search) {
    filterParts.push(`search: "${params.search}"`);
  }

  if (filterParts.length === 0) {
    return `Found ${leads.length} lead${leads.length === 1 ? '' : 's'}`;
  }

  return `Found ${leads.length} lead${leads.length === 1 ? '' : 's'} matching: ${filterParts.join(', ')}`;
}

/**
 * Get summary statistics for a set of leads
 * Useful for dashboard display
 * 
 * @param leads - Array of leads
 * @returns Summary statistics
 */
export function getLeadsSummary(leads: Lead[]): {
  total: number;
  byStatus: Record<string, number>;
  hnwCount: number;
  recentlyAdded: number; // Added in last 7 days
} {
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const summary = {
    total: leads.length,
    byStatus: {} as Record<string, number>,
    hnwCount: 0,
    recentlyAdded: 0,
  };

  leads.forEach((lead) => {
    // Count by status
    summary.byStatus[lead.status] = (summary.byStatus[lead.status] || 0) + 1;

    // Count HNW leads
    if (
      lead.segments?.includes('High Net Worth') ||
      (lead.budget_max && lead.budget_max > 3_000_000)
    ) {
      summary.hnwCount++;
    }

    // Count recently added
    if (new Date(lead.created_at) > sevenDaysAgo) {
      summary.recentlyAdded++;
    }
  });

  return summary;
}

// ============================================================================
// Export
// ============================================================================

export default getLeadsAction;

// Export helper for use in other modules
export { getLeadsSummary };
