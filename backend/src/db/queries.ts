/**
 * Database Queries - Typed Query Helpers
 * 
 * This file provides typed helper functions for common database operations.
 * All queries use parameterized statements to prevent SQL injection.
 * 
 * DEPENDENCIES:
 * - backend/src/db/client.ts: Database connection
 * - shared/types.ts: TypeScript type definitions
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/executor/actions/*.ts
 * - Used by: backend/src/routes/*.ts
 * 
 * TABLE SCHEMA (matches actual Supabase schema):
 * - leads: id, account_id, owner_agent_id, first_name, last_name, email, phone,
 *          property_address, neighborhood, beds, baths, price_range, budget_max,
 *          source, status, segments, notes, consent_status, created_at, updated_at
 * - communications: id, account_id, lead_id, timestamp, medium, direction, body,
 *                   summary, trigger, related_campaign_id, performed_by, status_after
 * - pending_messages: For future use with approval workflows
 */

import { db } from './client';
import { logger } from '../middleware/logger';
import type { NewLeadInput, LeadRow } from './schema';

// ============================================================================
// Types (matching actual database schema)
// ============================================================================

// Re-export schema types for convenience
export type { LeadRow, NewLeadInput } from './schema';

export interface Communication {
  id: string;
  account_id: string;
  lead_id: string;
  timestamp: Date;
  medium: string; // 'email', 'sms', 'whatsapp', 'phone'
  direction: string; // 'inbound', 'outbound'
  body: string;
  summary?: string;
  trigger?: string;
  related_campaign_id?: string;
  performed_by: string;
  status_after?: string;
}

export interface PendingMessage {
  id: string;
  lead_id: string;
  owner_agent_id: string;
  channel: string;
  message_body: string;
  requires_approval: boolean;
  approved_by?: string;
  approved_at?: Date;
  sent_at?: Date;
  cancelled_at?: Date;
  status: string; // 'pending', 'approved', 'cancelled', 'sent'
  created_at: Date;
}

// ============================================================================
// Lead Queries
// ============================================================================

/**
 * Create a new lead
 * 
 * @param lead - Lead data (NewLeadInput type)
 * @returns Created lead with generated id and timestamps (LeadRow type)
 */
export async function createLead(
  lead: NewLeadInput
): Promise<LeadRow> {
  const query = `
    INSERT INTO leads (
      account_id, owner_agent_id, first_name, last_name, email, phone,
      property_address, neighborhood, beds, baths,
      price_range, budget_min, budget_max, source, status,
      segments, notes, consent_status
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10,
      $11, $12, $13, $14, $15,
      $16, $17, $18
    )
    RETURNING *
  `;

  const values = [
    lead.account_id,
    lead.owner_agent_id || null,
    lead.first_name,
    lead.last_name || null,
    lead.email || null,
    lead.phone || null,
    lead.property_address || null,
    lead.neighborhood || null,
    lead.beds || null,
    lead.baths || null,
    lead.price_range || null,
    lead.budget_min || null,
    lead.budget_max || null,
    lead.source || 'api',
    lead.status || 'new',
    lead.segments || [],
    lead.notes || null,
    lead.consent_status || 'pending',
  ];

  try {
    const result = await db.query<LeadRow>(query, values);
    logger.info('Lead created', { 
      leadId: result.rows[0].id, 
      accountId: lead.account_id,
      ownerAgentId: lead.owner_agent_id 
    });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create lead', {
      error: error instanceof Error ? error.message : String(error),
      accountId: lead.account_id,
      ownerAgentId: lead.owner_agent_id,
    });
    throw error;
  }
}

/**
 * Get leads by owner agent ID with optional filters
 * 
 * @param ownerAgentId - Owner Agent ID to filter by
 * @param filters - Optional filters (status, segments, search query)
 * @returns Array of matching leads
 */

export async function getLeadsByAgent(
  ownerAgentId: string,
  filters?: {
    status?: string;
    segments?: string[];
    email?: string; // Exact email match
    phone?: string; // Exact phone match
    neighborhood?: string; // Exact neighborhood match
    search?: string; // Search in name, email, phone
    limit?: number;
    offset?: number;
  }
): Promise<LeadRow[]> {
  let query = `
    SELECT * FROM leads
    WHERE owner_agent_id = $1
  `;

  const params: any[] = [ownerAgentId];
  let paramIndex = 2;

  // Add status filter
  if (filters?.status) {
    query += ` AND status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  // Add segments filter (array overlap)
  if (filters?.segments && filters.segments.length > 0) {
    query += ` AND segments && $${paramIndex}`;
    params.push(filters.segments);
    paramIndex++;
  }

  // Add exact email filter
  if (filters?.email) {
    query += ` AND email ILIKE $${paramIndex}`;
    params.push(filters.email);
    paramIndex++;
  }

  // Add exact phone filter
  if (filters?.phone) {
    query += ` AND phone ILIKE $${paramIndex}`;
    params.push(filters.phone);
    paramIndex++;
  }

  // Add exact neighborhood filter
  if (filters?.neighborhood) {
    query += ` AND neighborhood ILIKE $${paramIndex}`;
    params.push(filters.neighborhood);
    paramIndex++;
  }

  // Add search filter (name, email, phone)
  // Split search term to handle "John Smith" style queries
  if (filters?.search) {
    const searchTerms = filters.search.trim().split(/\s+/);
    
    if (searchTerms.length === 1) {
      // Single term: search all fields
      query += ` AND (
        first_name ILIKE $${paramIndex} OR
        last_name ILIKE $${paramIndex} OR
        email ILIKE $${paramIndex} OR
        phone ILIKE $${paramIndex}
      )`;
      params.push(`%${searchTerms[0]}%`);
      paramIndex++;
    } else {
      // Multiple terms: search first_name for first term, last_name for last term
      query += ` AND (
        (first_name ILIKE $${paramIndex} AND last_name ILIKE $${paramIndex + 1}) OR
        first_name ILIKE $${paramIndex + 2} OR
        last_name ILIKE $${paramIndex + 2} OR
        email ILIKE $${paramIndex + 2} OR
        phone ILIKE $${paramIndex + 2}
      )`;
      params.push(`%${searchTerms[0]}%`);
      params.push(`%${searchTerms[searchTerms.length - 1]}%`);
      params.push(`%${filters.search}%`);
      paramIndex += 3;
    }
  }

  // Order by most recent first
  query += ` ORDER BY created_at DESC`;

  // Add pagination
  if (filters?.limit) {
    query += ` LIMIT $${paramIndex}`;
    params.push(filters.limit);
    paramIndex++;
  }

  if (filters?.offset) {
    query += ` OFFSET $${paramIndex}`;
    params.push(filters.offset);
    paramIndex++;
  }

  try {
    const result = await db.query<LeadRow>(query, params);
    logger.debug('Leads fetched', {
      ownerAgentId,
      count: result.rowCount,
      filters,
    });
    return result.rows;
  } catch (error) {
    logger.error('Failed to fetch leads', {
      error: error instanceof Error ? error.message : String(error),
      ownerAgentId,
      filters,
    });
    throw error;
  }
}

/**
 * Get a single lead by ID (with owner_agent_id check for security)
 * 
 * @param leadId - Lead ID
 * @param ownerAgentId - Owner Agent ID (for security check)
 * @returns Lead if found and belongs to agent, null otherwise
 */
export async function getLeadById(
  leadId: string,
  ownerAgentId: string
): Promise<LeadRow | null> {
  const query = `
    SELECT * FROM leads
    WHERE id = $1 AND owner_agent_id = $2
  `;

  try {
    const result = await db.query<LeadRow>(query, [leadId, ownerAgentId]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to fetch lead by ID', {
      error: error instanceof Error ? error.message : String(error),
      leadId,
      ownerAgentId,
    });
    throw error;
  }
}

/**
 * Update a lead
 * 
 * @param leadId - Lead ID
 * @param ownerAgentId - Owner Agent ID (for security check)
 * @param updates - Partial lead data to update
 * @returns Updated lead
 */
export async function updateLead(
  leadId: string,
  ownerAgentId: string,
  updates: Partial<Omit<LeadRow, 'id' | 'account_id' | 'owner_agent_id' | 'created_at' | 'updated_at' | 'created_date'>>
): Promise<LeadRow> {
  // Build dynamic UPDATE query based on provided fields
  const fields: string[] = [];
  const values: any[] = [];
  let paramIndex = 1;

  Object.entries(updates).forEach(([key, value]) => {
    fields.push(`${key} = $${paramIndex}`);
    values.push(value);
    paramIndex++;
  });

  // Always update updated_at
  fields.push(`updated_at = NOW()`);

  // Add WHERE clause parameters
  values.push(leadId, ownerAgentId);

  const query = `
    UPDATE leads
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex} AND owner_agent_id = $${paramIndex + 1}
    RETURNING *
  `;

  try {
    const result = await db.query<LeadRow>(query, values);
    if (result.rowCount === 0) {
      throw new Error(`Lead not found or access denied: ${leadId}`);
    }
    logger.info('Lead updated', { leadId, ownerAgentId, updates });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to update lead', {
      error: error instanceof Error ? error.message : String(error),
      leadId,
      ownerAgentId,
    });
    throw error;
  }
}

// ============================================================================
// Communication Queries
// ============================================================================

/**
 * Create a new communication record
 * 
 * @param communication - Communication data (without id)
 * @returns Created communication with generated id
 */
export async function createCommunication(
  communication: Omit<Communication, 'id'>
): Promise<Communication> {
  const query = `
    INSERT INTO communications (
      account_id, lead_id, timestamp, medium, direction, body,
      summary, trigger, related_campaign_id, performed_by, status_after
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, $8, $9, $10, $11
    )
    RETURNING *
  `;

  const values = [
    communication.account_id,
    communication.lead_id,
    communication.timestamp || new Date(),
    communication.medium,
    communication.direction,
    communication.body,
    communication.summary || null,
    communication.trigger || null,
    communication.related_campaign_id || null,
    communication.performed_by,
    communication.status_after || null,
  ];

  try {
    const result = await db.query<Communication>(query, values);
    logger.info('Communication created', {
      communicationId: result.rows[0].id,
      leadId: communication.lead_id,
      medium: communication.medium,
    });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create communication', {
      error: error instanceof Error ? error.message : String(error),
      leadId: communication.lead_id,
    });
    throw error;
  }
}

/**
 * Get communications for a lead
 * 
 * @param leadId - Lead ID
 * @param accountId - Account ID (for security check)
 * @returns Array of communications
 */
export async function getCommunicationsByLead(
  leadId: string,
  accountId: string
): Promise<Communication[]> {
  const query = `
    SELECT * FROM communications
    WHERE lead_id = $1 AND account_id = $2
    ORDER BY timestamp DESC
  `;

  try {
    const result = await db.query<Communication>(query, [leadId, accountId]);
    return result.rows;
  } catch (error) {
    logger.error('Failed to fetch communications', {
      error: error instanceof Error ? error.message : String(error),
      leadId,
      accountId,
    });
    throw error;
  }
}

// ============================================================================
// Export all query functions
// ============================================================================

export default {
  // Lead queries
  createLead,
  getLeadsByAgent,
  getLeadById,
  updateLead,
  // Communication queries
  createCommunication,
  getCommunicationsByLead,
};
