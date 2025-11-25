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
 * TABLE SCHEMA (must match migrations):
 * - leads: id, agent_id, first_name, last_name, email, phone, property_address, 
 *          neighborhood, beds, baths, price_range, budget_max, source, status, 
 *          segments, tags, last_contacted_at, next_followup_at, notes, created_at, updated_at
 * - communications: id, lead_id, agent_id, channel, direction, message_body, 
 *                   sent_at, delivered_at, failed_at, failure_reason, status, metadata
 * - pending_messages: id, lead_id, agent_id, channel, message_body, requires_approval,
 *                     approved_by, approved_at, sent_at, cancelled_at, status
 */

import { db } from './client';
import { logger } from '../middleware/logger';

// ============================================================================
// Types (matching database schema)
// ============================================================================

export interface Lead {
  id: string;
  agent_id: string;
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
  status: string; // 'new', 'contacted', 'qualified', 'closed', 'lost'
  segments?: string[]; // ['High Net Worth', 'First Time Buyer', etc.]
  tags?: string[]; // ['hot', 'needs-follow-up', etc.]
  last_contacted_at?: Date;
  next_followup_at?: Date;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

export interface Communication {
  id: string;
  lead_id: string;
  agent_id: string;
  channel: string; // 'email', 'sms', 'whatsapp', 'phone'
  direction: string; // 'inbound', 'outbound'
  message_body: string;
  sent_at?: Date;
  delivered_at?: Date;
  failed_at?: Date;
  failure_reason?: string;
  status: string; // 'pending', 'sent', 'delivered', 'failed'
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface PendingMessage {
  id: string;
  lead_id: string;
  agent_id: string;
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
 * @param lead - Lead data (without id, created_at, updated_at)
 * @returns Created lead with generated id and timestamps
 */
export async function createLead(
  lead: Omit<Lead, 'id' | 'created_at' | 'updated_at'>
): Promise<Lead> {
  const query = `
    INSERT INTO leads (
      agent_id, first_name, last_name, email, phone,
      property_address, neighborhood, beds, baths,
      price_range, budget_max, source, status,
      segments, tags, last_contacted_at, next_followup_at, notes
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12, $13,
      $14, $15, $16, $17, $18
    )
    RETURNING *
  `;

  const values = [
    lead.agent_id,
    lead.first_name,
    lead.last_name || null,
    lead.email || null,
    lead.phone || null,
    lead.property_address || null,
    lead.neighborhood || null,
    lead.beds || null,
    lead.baths || null,
    lead.price_range || null,
    lead.budget_max || null,
    lead.source || null,
    lead.status || 'new',
    lead.segments || null,
    lead.tags || null,
    lead.last_contacted_at || null,
    lead.next_followup_at || null,
    lead.notes || null,
  ];

  try {
    const result = await db.query<Lead>(query, values);
    logger.info('Lead created', { leadId: result.rows[0].id, agentId: lead.agent_id });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create lead', {
      error: error instanceof Error ? error.message : String(error),
      agentId: lead.agent_id,
    });
    throw error;
  }
}

/**
 * Get leads by agent ID with optional filters
 * 
 * @param agentId - Agent ID to filter by
 * @param filters - Optional filters (status, segments, tags, search query)
 * @returns Array of matching leads
 */
export async function getLeadsByAgent(
  agentId: string,
  filters?: {
    status?: string;
    segments?: string[];
    tags?: string[];
    search?: string; // Search in name, email, phone
    limit?: number;
    offset?: number;
  }
): Promise<Lead[]> {
  let query = `
    SELECT * FROM leads
    WHERE agent_id = $1
  `;

  const params: any[] = [agentId];
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

  // Add tags filter (array overlap)
  if (filters?.tags && filters.tags.length > 0) {
    query += ` AND tags && $${paramIndex}`;
    params.push(filters.tags);
    paramIndex++;
  }

  // Add search filter (name, email, phone)
  if (filters?.search) {
    query += ` AND (
      first_name ILIKE $${paramIndex} OR
      last_name ILIKE $${paramIndex} OR
      email ILIKE $${paramIndex} OR
      phone ILIKE $${paramIndex}
    )`;
    params.push(`%${filters.search}%`);
    paramIndex++;
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
    const result = await db.query<Lead>(query, params);
    logger.debug('Leads fetched', {
      agentId,
      count: result.rowCount,
      filters,
    });
    return result.rows;
  } catch (error) {
    logger.error('Failed to fetch leads', {
      error: error instanceof Error ? error.message : String(error),
      agentId,
      filters,
    });
    throw error;
  }
}

/**
 * Get a single lead by ID (with agent_id check for security)
 * 
 * @param leadId - Lead ID
 * @param agentId - Agent ID (for security check)
 * @returns Lead if found and belongs to agent, null otherwise
 */
export async function getLeadById(
  leadId: string,
  agentId: string
): Promise<Lead | null> {
  const query = `
    SELECT * FROM leads
    WHERE id = $1 AND agent_id = $2
  `;

  try {
    const result = await db.query<Lead>(query, [leadId, agentId]);
    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to fetch lead by ID', {
      error: error instanceof Error ? error.message : String(error),
      leadId,
      agentId,
    });
    throw error;
  }
}

/**
 * Update a lead
 * 
 * @param leadId - Lead ID
 * @param agentId - Agent ID (for security check)
 * @param updates - Partial lead data to update
 * @returns Updated lead
 */
export async function updateLead(
  leadId: string,
  agentId: string,
  updates: Partial<Omit<Lead, 'id' | 'agent_id' | 'created_at' | 'updated_at'>>
): Promise<Lead> {
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
  values.push(leadId, agentId);

  const query = `
    UPDATE leads
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex} AND agent_id = $${paramIndex + 1}
    RETURNING *
  `;

  try {
    const result = await db.query<Lead>(query, values);
    if (result.rowCount === 0) {
      throw new Error(`Lead not found or access denied: ${leadId}`);
    }
    logger.info('Lead updated', { leadId, agentId, updates });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to update lead', {
      error: error instanceof Error ? error.message : String(error),
      leadId,
      agentId,
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
 * @param communication - Communication data (without id, created_at)
 * @returns Created communication with generated id and timestamp
 */
export async function createCommunication(
  communication: Omit<Communication, 'id' | 'created_at'>
): Promise<Communication> {
  const query = `
    INSERT INTO communications (
      lead_id, agent_id, channel, direction, message_body,
      sent_at, delivered_at, failed_at, failure_reason, status, metadata
    ) VALUES (
      $1, $2, $3, $4, $5,
      $6, $7, $8, $9, $10, $11
    )
    RETURNING *
  `;

  const values = [
    communication.lead_id,
    communication.agent_id,
    communication.channel,
    communication.direction,
    communication.message_body,
    communication.sent_at || null,
    communication.delivered_at || null,
    communication.failed_at || null,
    communication.failure_reason || null,
    communication.status || 'pending',
    communication.metadata ? JSON.stringify(communication.metadata) : null,
  ];

  try {
    const result = await db.query<Communication>(query, values);
    logger.info('Communication created', {
      communicationId: result.rows[0].id,
      leadId: communication.lead_id,
      channel: communication.channel,
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
 * @param agentId - Agent ID (for security check)
 * @returns Array of communications
 */
export async function getCommunicationsByLead(
  leadId: string,
  agentId: string
): Promise<Communication[]> {
  const query = `
    SELECT * FROM communications
    WHERE lead_id = $1 AND agent_id = $2
    ORDER BY created_at DESC
  `;

  try {
    const result = await db.query<Communication>(query, [leadId, agentId]);
    return result.rows;
  } catch (error) {
    logger.error('Failed to fetch communications', {
      error: error instanceof Error ? error.message : String(error),
      leadId,
      agentId,
    });
    throw error;
  }
}

// ============================================================================
// Pending Message Queries
// ============================================================================

/**
 * Create a pending message (requires approval for HNW leads)
 * 
 * @param message - Pending message data (without id, created_at)
 * @returns Created pending message
 */
export async function createPendingMessage(
  message: Omit<PendingMessage, 'id' | 'created_at'>
): Promise<PendingMessage> {
  const query = `
    INSERT INTO pending_messages (
      lead_id, agent_id, channel, message_body, requires_approval, status
    ) VALUES (
      $1, $2, $3, $4, $5, $6
    )
    RETURNING *
  `;

  const values = [
    message.lead_id,
    message.agent_id,
    message.channel,
    message.message_body,
    message.requires_approval,
    message.status || 'pending',
  ];

  try {
    const result = await db.query<PendingMessage>(query, values);
    logger.info('Pending message created', {
      messageId: result.rows[0].id,
      leadId: message.lead_id,
      requiresApproval: message.requires_approval,
    });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to create pending message', {
      error: error instanceof Error ? error.message : String(error),
      leadId: message.lead_id,
    });
    throw error;
  }
}

/**
 * Get pending messages for an agent
 * 
 * @param agentId - Agent ID
 * @param filters - Optional filters (status)
 * @returns Array of pending messages
 */
export async function getPendingMessagesByAgent(
  agentId: string,
  filters?: { status?: string }
): Promise<PendingMessage[]> {
  let query = `
    SELECT * FROM pending_messages
    WHERE agent_id = $1
  `;

  const params: any[] = [agentId];

  if (filters?.status) {
    query += ` AND status = $2`;
    params.push(filters.status);
  }

  query += ` ORDER BY created_at DESC`;

  try {
    const result = await db.query<PendingMessage>(query, params);
    return result.rows;
  } catch (error) {
    logger.error('Failed to fetch pending messages', {
      error: error instanceof Error ? error.message : String(error),
      agentId,
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

  // Pending message queries
  createPendingMessage,
  getPendingMessagesByAgent,
};
