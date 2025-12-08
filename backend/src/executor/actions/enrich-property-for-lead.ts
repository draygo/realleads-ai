/**
 * Enrich Property For Lead Action
 *
 * PURPOSE:
 * --------
 * This module defines the `enrichPropertyForLeadAction` function used by the executor
 * to enrich a subject property for a lead based on raw user input (address or URL).
 *
 * It:
 *  - Validates lead_id and raw_input parameters
 *  - Calls the property-data service to enrich the property
 *  - Returns a compact summary suitable for downstream actions (e.g., Twilio SMS)
 *
 * USED BY:
 * --------
 * - backend/src/executor/index.ts (executor dispatches to this action)
 * - Orchestrator when user provides property address/URL
 *
 * DOWNSTREAM USAGE:
 * -----------------
 * The returned property summary is used by:
 * - find_similar_listings (uses subject_property_id + budget_max)
 * - send_sms_followup (uses property details for Mika-style messages)
 */

import { enrichPropertyForLead } from '../../services/property-data';
import { logger } from '../../middleware/logger';
import type { UUID } from '../../db/schema';

// ============================================================================
// Types
// ============================================================================

/**
 * Parameters accepted by the enrich_property_for_lead action
 */
export interface EnrichPropertyForLeadParams {
  lead_id: string;
  raw_input: string;
}

/**
 * Return shape for the enrich_property_for_lead action
 */
export interface EnrichPropertyForLeadResult {
  success: boolean;
  property: {
    id: string;
    address_full: string;
    beds: number | null;
    baths: number | null;
    sqft: number | null;
    list_price: number | null;
  };
  lead: {
    id: string;
    subject_property_id: string | null;
  };
  message: string;
}

// ============================================================================
// Main Action Function
// ============================================================================

/**
 * enrichPropertyForLeadAction
 * ---------------------------
 * Main entry point for the `enrich_property_for_lead` executor action.
 *
 * STEPS:
 * 1. Validate input (lead_id must be UUID, raw_input must be non-empty)
 * 2. Call property-data service to enrich the property
 * 3. Map full PropertyRow to compact summary
 * 4. Return result suitable for downstream actions
 *
 * @param params - Action parameters (lead_id, raw_input)
 * @returns Compact property summary and updated lead info
 */
export async function enrichPropertyForLeadAction(
  params: EnrichPropertyForLeadParams
): Promise<EnrichPropertyForLeadResult> {
  // Validate input
  if (!params.lead_id || typeof params.lead_id !== 'string') {
    throw new Error('lead_id is required and must be a string');
  }

  if (!params.raw_input || typeof params.raw_input !== 'string' || params.raw_input.trim().length === 0) {
    throw new Error('raw_input is required and must be a non-empty string');
  }

  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(params.lead_id)) {
    throw new Error('lead_id must be a valid UUID');
  }

  logger.info('Enriching property for lead', {
    leadId: params.lead_id,
    rawInputLength: params.raw_input.length,
    rawInputPreview: params.raw_input.substring(0, 50),
  });

  try {
    // Call property-data service
    const enrichmentResult = await enrichPropertyForLead({
      leadId: params.lead_id as UUID,
      rawInput: params.raw_input.trim(),
    });

    // Map full PropertyRow to compact summary for orchestrator
    const propertySummary = {
      id: enrichmentResult.property.id,
      address_full: enrichmentResult.property.address_full,
      beds: enrichmentResult.property.beds,
      baths: enrichmentResult.property.baths,
      sqft: enrichmentResult.property.sqft,
      list_price: enrichmentResult.property.list_price,
    };

    const leadSummary = {
      id: enrichmentResult.lead.id,
      subject_property_id: enrichmentResult.lead.subject_property_id,
    };

    // Generate human-readable message
    const address = enrichmentResult.property.address_full;
    const beds = enrichmentResult.property.beds;
    const baths = enrichmentResult.property.baths;
    const price = enrichmentResult.property.list_price;

    let message = `Property enriched: ${address}`;
    if (beds || baths || price) {
      const details: string[] = [];
      if (beds) details.push(`${beds} bed${beds !== 1 ? 's' : ''}`);
      if (baths) details.push(`${baths} bath${baths !== 1 ? 's' : ''}`);
      if (price) details.push(`$${price.toLocaleString()}`);
      if (details.length > 0) {
        message += ` (${details.join(', ')})`;
      }
    }

    logger.info('Property enrichment completed successfully', {
      leadId: params.lead_id,
      propertyId: enrichmentResult.property.id,
      provider: enrichmentResult.property.provider_primary,
    });

    return {
      success: true,
      property: propertySummary,
      lead: leadSummary,
      message,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Failed to enrich property for lead', {
      error: errorMessage,
      leadId: params.lead_id,
      rawInput: params.raw_input,
    });
    throw error;
  }
}

// ============================================================================
// Default Export
// ============================================================================

/**
 * Default export so the executor can import this module as:
 *   import enrichPropertyForLeadAction from './actions/enrich-property-for-lead';
 */
export default enrichPropertyForLeadAction;

