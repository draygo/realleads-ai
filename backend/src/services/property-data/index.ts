/**
 * Property Data Service - Main Orchestration
 * 
 * This module provides the high-level property enrichment service that:
 * - Takes raw user input (address or URL)
 * - Tries multiple providers in priority order (Zenlist → Zillow → Attom)
 * - Upserts property data into the database
 * - Updates the lead with subject property information
 * - Returns enriched property and updated lead
 * 
 * DEPENDENCIES:
 * - backend/src/db/queries.ts: Database query helpers
 * - backend/src/db/schema.ts: PropertyRow, LeadRow, UUID types
 * - backend/src/services/property-data/providerClients.ts: External API clients
 * - backend/src/services/property-data/types.ts: Type definitions
 * - backend/src/middleware/logger.ts: Application logging
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/executor/actions/enrich-property-for-lead.ts
 */

import { logger } from '../../middleware/logger';
import type { UUID, PropertyRow, LeadRow, PropertyProvider } from '../../db/schema';
import {
  upsertPropertyFromEnrichment,
  updateLeadSubjectProperty,
} from '../../db/queries';
import { supabase } from '../../db/client';
import {
  callZenlistForProperty,
  callZillowForProperty,
  callAttomForProperty,
} from './providerClients';
import type {
  ParsedPropertyInput,
  ZenlistPropertyResult,
  ZillowPropertyResult,
  PropertyEnrichmentResult,
} from './types';

/**
 * Parse raw input into ParsedPropertyInput
 * 
 * Handles:
 * - Plain address strings: "322 Hill St, San Francisco, CA"
 * - Zillow URLs: extracts address and ZPID if available
 * - Zenlist URLs: extracts address and MLS ID if available
 * 
 * @param rawInput - Raw user input (address or URL)
 * @returns Parsed property input
 */
function parsePropertyInput(rawInput: string): ParsedPropertyInput {
  const trimmed = rawInput.trim();

  // Check if it's a URL
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    // Zillow URL pattern: https://www.zillow.com/homedetails/.../ZPID
    if (trimmed.includes('zillow.com')) {
      const zpidMatch = trimmed.match(/\/homedetails\/[^\/]+\/(\d+)/);
      return {
        address: trimmed, // Will need to extract from page or API
        url: trimmed,
        providerHint: 'zillow',
        zpid: zpidMatch ? zpidMatch[1] : undefined,
      };
    }

    // Zenlist URL pattern: https://zenlist.com/listing/... or similar
    if (trimmed.includes('zenlist.com')) {
      const mlsMatch = trimmed.match(/listing\/([^\/\?]+)/);
      return {
        address: trimmed, // Will need to extract from page or API
        url: trimmed,
        providerHint: 'zenlist',
        mlsId: mlsMatch ? mlsMatch[1] : undefined,
      };
    }
  }

  // Plain address string
  return {
    address: trimmed,
  };
}

/**
 * Map Zenlist result to PropertyRow shape
 * 
 * @param result - Zenlist API result
 * @param providerFallbacks - Array of providers we tried before this one
 * @returns PropertyRow-shaped object ready for upsert
 */
function mapZenlistToPropertyRow(
  result: ZenlistPropertyResult,
  providerFallbacks: PropertyProvider[] = []
): Omit<PropertyRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    address_full: result.address,
    street: null, // TODO: Parse from address if needed
    unit: null,
    city: result.city || null,
    state: result.state || null,
    postal_code: result.postalCode || null,
    latitude: result.latitude,
    longitude: result.longitude,
    beds: result.beds,
    baths: result.baths,
    sqft: result.sqft,
    lot_sqft: result.lotSqft,
    property_type: result.propertyType,
    year_built: result.yearBuilt,
    hoa_fees: null, // TODO: Extract from Zenlist API if available
    list_price: result.listPrice,
    list_price_source: 'zenlist',
    last_sold_price: result.lastSoldPrice,
    last_sold_date: result.lastSoldDate,
    tax_assessed_value: null,
    provider_primary: 'zenlist',
    provider_fallbacks: providerFallbacks.length > 0 ? providerFallbacks : null,
    zenlist_mls_id: result.mlsId,
    zillow_zpid: null,
    attom_property_id: null,
    provider_payload: result.rawResponse,
  };
}

/**
 * Map Zillow result to PropertyRow shape
 * 
 * @param result - Zillow API result
 * @param providerFallbacks - Array of providers we tried before this one
 * @returns PropertyRow-shaped object ready for upsert
 */
function mapZillowToPropertyRow(
  result: ZillowPropertyResult,
  providerFallbacks: PropertyProvider[] = []
): Omit<PropertyRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    address_full: result.address,
    street: null, // TODO: Parse from address if needed
    unit: null,
    city: result.city || null,
    state: result.state || null,
    postal_code: result.postalCode || null,
    latitude: result.latitude,
    longitude: result.longitude,
    beds: result.beds,
    baths: result.baths,
    sqft: result.sqft,
    lot_sqft: result.lotSqft,
    property_type: result.propertyType,
    year_built: result.yearBuilt,
    hoa_fees: null, // TODO: Extract from Zillow API if available
    list_price: result.listPrice || result.zestimate,
    list_price_source: result.listPrice ? 'zillow' : 'zillow_zestimate',
    last_sold_price: result.lastSoldPrice,
    last_sold_date: result.lastSoldDate,
    tax_assessed_value: null,
    provider_primary: 'zillow',
    provider_fallbacks: providerFallbacks.length > 0 ? providerFallbacks : null,
    zenlist_mls_id: null,
    zillow_zpid: result.zpid,
    attom_property_id: null,
    provider_payload: result.rawResponse,
  };
}

/**
 * Create minimal PropertyRow from raw address (fallback)
 * 
 * @param input - Parsed property input
 * @param providerFallbacks - Array of providers we tried
 * @returns Minimal PropertyRow-shaped object
 */
function createMinimalPropertyRow(
  input: ParsedPropertyInput,
  providerFallbacks: PropertyProvider[] = []
): Omit<PropertyRow, 'id' | 'created_at' | 'updated_at'> {
  return {
    address_full: input.address,
    street: null,
    unit: null,
    city: null,
    state: null,
    postal_code: null,
    latitude: null,
    longitude: null,
    beds: null,
    baths: null,
    sqft: null,
    lot_sqft: null,
    property_type: null,
    year_built: null,
    hoa_fees: null,
    list_price: input.hintPrice || null,
    list_price_source: input.hintPrice ? 'user_hint' : null,
    last_sold_price: null,
    last_sold_date: null,
    tax_assessed_value: null,
    provider_primary: 'unknown',
    provider_fallbacks: providerFallbacks.length > 0 ? providerFallbacks : null,
    zenlist_mls_id: null,
    zillow_zpid: null,
    attom_property_id: null,
    provider_payload: { rawInput: input.address },
  };
}

/**
 * Enriches a subject property for a lead based on a raw user input
 * (address string or Zillow/Zenlist URL).
 * 
 * Priority:
 *  1) Zenlist
 *  2) Zillow
 *  3) Attom (stubbed for now)
 * 
 * @param options - Enrichment options
 * @returns Enriched property and updated lead
 */
export async function enrichPropertyForLead(options: {
  leadId: UUID;
  rawInput: string;
}): Promise<PropertyEnrichmentResult> {
  const { leadId, rawInput } = options;

  logger.info('Starting property enrichment', {
    leadId,
    rawInputLength: rawInput.length,
  });

  // Verify lead exists
  const { data: leadCheck, error: leadError } = await supabase
    .from('leads')
    .select('id')
    .eq('id', leadId)
    .single();

  if (leadError || !leadCheck) {
    throw new Error(`Lead not found: ${leadId}`);
  }

  // Step 1: Parse raw input into ParsedPropertyInput
  const parsedInput = parsePropertyInput(rawInput);
  logger.debug('Parsed property input', {
    address: parsedInput.address,
    providerHint: parsedInput.providerHint,
    hasMlsId: !!parsedInput.mlsId,
    hasZpid: !!parsedInput.zpid,
  });

  // Step 2: Try providers in priority order
  let propertyData: Omit<PropertyRow, 'id' | 'created_at' | 'updated_at'> | null = null;
  let providerUsed: PropertyProvider = 'unknown';
  const providersTried: PropertyProvider[] = [];

  // Try Zenlist first
  logger.debug('Trying Zenlist provider', { leadId });
  const zenlistResult = await callZenlistForProperty(parsedInput, leadId);
  if (zenlistResult) {
    propertyData = mapZenlistToPropertyRow(zenlistResult, providersTried);
    providerUsed = 'zenlist';
    logger.info('Zenlist enrichment successful', {
      leadId,
      mlsId: zenlistResult.mlsId,
      address: zenlistResult.address,
    });
  } else {
    providersTried.push('zenlist');
  }

  // Try Zillow if Zenlist failed
  if (!propertyData) {
    logger.debug('Trying Zillow provider', { leadId });
    const zillowResult = await callZillowForProperty(parsedInput, leadId);
    if (zillowResult) {
      propertyData = mapZillowToPropertyRow(zillowResult, providersTried);
      providerUsed = 'zillow';
      logger.info('Zillow enrichment successful', {
        leadId,
        zpid: zillowResult.zpid,
        address: zillowResult.address,
      });
    } else {
      providersTried.push('zillow');
    }
  }

  // Try Attom if both failed (stub for now)
  if (!propertyData) {
    logger.debug('Trying Attom provider (stub)', { leadId });
    await callAttomForProperty(parsedInput, leadId);
    providersTried.push('attom');
  }

  // Step 3: Fallback to minimal property if all providers failed
  if (!propertyData) {
    logger.warn('All providers failed, creating minimal property from address', {
      leadId,
      address: parsedInput.address,
      providersTried,
    });
    propertyData = createMinimalPropertyRow(parsedInput, providersTried);
  }

  // Step 4: Upsert property into database
  logger.debug('Upserting property', {
    leadId,
    provider: providerUsed,
    address: propertyData.address_full,
  });

  const property = await upsertPropertyFromEnrichment(propertyData);

  logger.info('Property upserted', {
    propertyId: property.id,
    leadId,
    provider: providerUsed,
  });

  // Step 5: Update lead with subject property information
  logger.debug('Updating lead with subject property', {
    leadId,
    propertyId: property.id,
  });

  const lead = await updateLeadSubjectProperty(leadId, {
    subject_property_id: property.id,
    subject_beds: property.beds,
    subject_baths: property.baths,
    subject_sqft: property.sqft,
    subject_list_price: property.list_price,
    subject_list_price_source: property.list_price_source,
  });

  logger.info('Property enrichment completed', {
    leadId,
    propertyId: property.id,
    provider: providerUsed,
    hasBeds: property.beds !== null,
    hasBaths: property.baths !== null,
    hasPrice: property.list_price !== null,
  });

  // Step 6: Return enriched property and updated lead
  return {
    property,
    lead,
  };
}

