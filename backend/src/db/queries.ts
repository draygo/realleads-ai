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
import type { NewLeadInput, LeadRow, PropertyRow, UUID } from './schema';

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
    lead.status || 'New',
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
// Property Queries
// ============================================================================

/**
 * Upsert a property from enrichment data
 * 
 * Matches by:
 * - Normalized address_full (case-insensitive)
 * - zenlist_mls_id (if present)
 * - zillow_zpid (if present)
 * 
 * If match found: updates existing property
 * If no match: creates new property
 * 
 * @param propertyData - Property data from enrichment
 * @returns Upserted property row
 */
export async function upsertPropertyFromEnrichment(
  propertyData: Omit<PropertyRow, 'id' | 'created_at' | 'updated_at'>
): Promise<PropertyRow> {
  // Try to find existing property by address_full, mls_id, or zpid
  let existingProperty: PropertyRow | null = null;

  // First try by MLS ID if present
  if (propertyData.zenlist_mls_id) {
    const mlsQuery = `
      SELECT * FROM properties
      WHERE zenlist_mls_id = $1
      LIMIT 1
    `;
    const mlsResult = await db.query<PropertyRow>(mlsQuery, [propertyData.zenlist_mls_id]);
    if (mlsResult.rows.length > 0) {
      existingProperty = mlsResult.rows[0];
    }
  }

  // Try by ZPID if not found and ZPID present
  if (!existingProperty && propertyData.zillow_zpid) {
    const zpidQuery = `
      SELECT * FROM properties
      WHERE zillow_zpid = $1
      LIMIT 1
    `;
    const zpidResult = await db.query<PropertyRow>(zpidQuery, [propertyData.zillow_zpid]);
    if (zpidResult.rows.length > 0) {
      existingProperty = zpidResult.rows[0];
    }
  }

  // Try by normalized address if still not found
  if (!existingProperty) {
    const addressQuery = `
      SELECT * FROM properties
      WHERE LOWER(address_full) = LOWER($1)
      LIMIT 1
    `;
    const addressResult = await db.query<PropertyRow>(addressQuery, [propertyData.address_full]);
    if (addressResult.rows.length > 0) {
      existingProperty = addressResult.rows[0];
    }
  }

  if (existingProperty) {
    // Update existing property
    const updateQuery = `
      UPDATE properties
      SET
        address_full = $1,
        street = $2,
        unit = $3,
        city = $4,
        state = $5,
        postal_code = $6,
        latitude = $7,
        longitude = $8,
        beds = $9,
        baths = $10,
        sqft = $11,
        lot_sqft = $12,
        property_type = $13,
        year_built = $14,
        hoa_fees = $15,
        list_price = $16,
        list_price_source = $17,
        last_sold_price = $18,
        last_sold_date = $19,
        tax_assessed_value = $20,
        provider_primary = $21,
        provider_fallbacks = $22,
        zenlist_mls_id = COALESCE($23, zenlist_mls_id),
        zillow_zpid = COALESCE($24, zillow_zpid),
        attom_property_id = COALESCE($25, attom_property_id),
        provider_payload = $26,
        updated_at = NOW()
      WHERE id = $27
      RETURNING *
    `;

    const values = [
      propertyData.address_full,
      propertyData.street,
      propertyData.unit,
      propertyData.city,
      propertyData.state,
      propertyData.postal_code,
      propertyData.latitude,
      propertyData.longitude,
      propertyData.beds,
      propertyData.baths,
      propertyData.sqft,
      propertyData.lot_sqft,
      propertyData.property_type,
      propertyData.year_built,
      propertyData.hoa_fees,
      propertyData.list_price,
      propertyData.list_price_source,
      propertyData.last_sold_price,
      propertyData.last_sold_date,
      propertyData.tax_assessed_value,
      propertyData.provider_primary,
      propertyData.provider_fallbacks,
      propertyData.zenlist_mls_id,
      propertyData.zillow_zpid,
      propertyData.attom_property_id,
      propertyData.provider_payload,
      existingProperty.id,
    ];

    const result = await db.query<PropertyRow>(updateQuery, values);
    logger.info('Property updated', { propertyId: result.rows[0].id });
    return result.rows[0];
  } else {
    // Insert new property
    const insertQuery = `
      INSERT INTO properties (
        address_full, street, unit, city, state, postal_code,
        latitude, longitude, beds, baths, sqft, lot_sqft,
        property_type, year_built, hoa_fees,
        list_price, list_price_source, last_sold_price, last_sold_date,
        tax_assessed_value,
        provider_primary, provider_fallbacks,
        zenlist_mls_id, zillow_zpid, attom_property_id,
        provider_payload
      ) VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10, $11, $12,
        $13, $14, $15,
        $16, $17, $18, $19,
        $20,
        $21, $22,
        $23, $24, $25,
        $26
      )
      RETURNING *
    `;

    const values = [
      propertyData.address_full,
      propertyData.street,
      propertyData.unit,
      propertyData.city,
      propertyData.state,
      propertyData.postal_code,
      propertyData.latitude,
      propertyData.longitude,
      propertyData.beds,
      propertyData.baths,
      propertyData.sqft,
      propertyData.lot_sqft,
      propertyData.property_type,
      propertyData.year_built,
      propertyData.hoa_fees,
      propertyData.list_price,
      propertyData.list_price_source,
      propertyData.last_sold_price,
      propertyData.last_sold_date,
      propertyData.tax_assessed_value,
      propertyData.provider_primary,
      propertyData.provider_fallbacks,
      propertyData.zenlist_mls_id,
      propertyData.zillow_zpid,
      propertyData.attom_property_id,
      propertyData.provider_payload,
    ];

    const result = await db.query<PropertyRow>(insertQuery, values);
    logger.info('Property created', { propertyId: result.rows[0].id });
    return result.rows[0];
  }
}

/**
 * Update lead with subject property information
 * 
 * Updates the denormalized subject_property_* fields on the lead
 * for quick access without joins.
 * 
 * @param leadId - Lead ID to update
 * @param updates - Subject property fields to update
 * @returns Updated lead row
 */
export async function updateLeadSubjectProperty(
  leadId: UUID,
  updates: {
    subject_property_id: UUID | null;
    subject_beds: number | null;
    subject_baths: number | null;
    subject_sqft: number | null;
    subject_list_price: number | null;
    subject_list_price_source: string | null;
  }
): Promise<LeadRow> {
  const query = `
    UPDATE leads
    SET
      subject_property_id = $1,
      subject_beds = $2,
      subject_baths = $3,
      subject_sqft = $4,
      subject_list_price = $5,
      subject_list_price_source = $6,
      updated_at = NOW()
    WHERE id = $7
    RETURNING *
  `;

  const values = [
    updates.subject_property_id,
    updates.subject_beds,
    updates.subject_baths,
    updates.subject_sqft,
    updates.subject_list_price,
    updates.subject_list_price_source,
    leadId,
  ];

  try {
    const result = await db.query<LeadRow>(query, values);
    if (result.rowCount === 0) {
      throw new Error(`Lead not found: ${leadId}`);
    }
    logger.info('Lead subject property updated', { leadId, propertyId: updates.subject_property_id });
    return result.rows[0];
  } catch (error) {
    logger.error('Failed to update lead subject property', {
      error: error instanceof Error ? error.message : String(error),
      leadId,
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
  // Property queries
  upsertPropertyFromEnrichment,
  updateLeadSubjectProperty,
};
