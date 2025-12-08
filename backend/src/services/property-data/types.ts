/**
 * Property Data Service - Type Definitions
 * 
 * This module defines TypeScript types used throughout the property enrichment
 * service layer. These types bridge between raw user input, external API responses,
 * and our internal PropertyRow / LeadRow schema.
 * 
 * DEPENDENCIES:
 * - backend/src/db/schema.ts: PropertyRow, LeadRow, UUID
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/services/property-data/providerClients.ts
 * - Used by: backend/src/services/property-data/index.ts
 */

import type { UUID, PropertyRow, LeadRow } from '../../db/schema';

/**
 * ParsedPropertyInput
 * 
 * Represents a parsed property input from user (address string or URL).
 * This is the normalized shape we pass to provider clients.
 */
export interface ParsedPropertyInput {
  /** Normalized address string (e.g., "322 Hill St, San Francisco, CA 94110") */
  address: string;
  
  /** Optional URL if input was a Zillow/Zenlist link */
  url?: string;
  
  /** Provider hint if URL was detected ('zenlist' | 'zillow') */
  providerHint?: 'zenlist' | 'zillow';
  
  /** Optional price hint if user mentioned it in the input */
  hintPrice?: number;
  
  /** Optional MLS ID if extracted from URL */
  mlsId?: string;
  
  /** Optional ZPID if extracted from Zillow URL */
  zpid?: string;
}

/**
 * EnrichedPropertySummary
 * 
 * Compact summary of enriched property data, suitable for SMS/display.
 * This is what downstream actions (like Twilio SMS) will use.
 */
export interface EnrichedPropertySummary {
  /** Property ID */
  id: string;
  
  /** Full address */
  address_full: string;
  
  /** Bedrooms */
  beds: number | null;
  
  /** Bathrooms */
  baths: number | null;
  
  /** Square footage */
  sqft: number | null;
  
  /** List price */
  list_price: number | null;
  
  /** Source of list price */
  list_price_source: string | null;
  
  /** Property type */
  property_type: string | null;
  
  /** Year built */
  year_built: number | null;
  
  /** Primary provider that enriched this property */
  provider_primary: string;
}

/**
 * ZenlistPropertyResult
 * 
 * Expected response shape from Zenlist API.
 * This is what we expect after calling their property lookup endpoint.
 */
export interface ZenlistPropertyResult {
  /** MLS ID (primary identifier) */
  mlsId: string;
  
  /** Full address */
  address: string;
  
  /** Property details */
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  propertyType: string | null;
  yearBuilt: number | null;
  
  /** Pricing */
  listPrice: number | null;
  lastSoldPrice: number | null;
  lastSoldDate: string | null;
  
  /** Location */
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  
  /** Raw API response for debugging */
  rawResponse: unknown;
}

/**
 * ZillowPropertyResult
 * 
 * Expected response shape from Zillow API.
 * This is what we expect after calling their property lookup endpoint.
 */
export interface ZillowPropertyResult {
  /** Zillow Property ID (ZPID) */
  zpid: string;
  
  /** Full address */
  address: string;
  
  /** Property details */
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  propertyType: string | null;
  yearBuilt: number | null;
  
  /** Pricing */
  listPrice: number | null;
  zestimate: number | null;
  lastSoldPrice: number | null;
  lastSoldDate: string | null;
  
  /** Location */
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  
  /** Raw API response for debugging */
  rawResponse: unknown;
}

/**
 * PropertyEnrichmentResult
 * 
 * Result of enriching a property for a lead.
 * Returned by the main enrichPropertyForLead function.
 */
export interface PropertyEnrichmentResult {
  /** Enriched property row */
  property: PropertyRow;
  
  /** Updated lead row with subject_property_id and denormalized fields */
  lead: LeadRow;
}

