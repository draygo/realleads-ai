/**
 * Property Data Provider Clients
 * 
 * This module provides thin wrappers around external property data APIs
 * (Zenlist, Zillow, Attom). Each provider client:
 * - Logs all API calls to external_api_logs table
 * - Handles errors gracefully
 * - Returns typed results or null
 * 
 * CURRENT STATUS:
 * - All functions are stubbed with proper signatures
 * - Logging infrastructure is in place
 * - TODO: Implement actual HTTP calls when API credentials are available
 * 
 * DEPENDENCIES:
 * - backend/src/db/client.ts: Database connection for logging
 * - backend/src/db/schema.ts: ExternalApiLogRow type
 * - backend/src/middleware/logger.ts: Application logging
 * - backend/src/services/property-data/types.ts: Type definitions
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/services/property-data/index.ts
 */

import { supabase } from '../../db/client';
import { logger } from '../../middleware/logger';
import type { UUID } from '../../db/schema';
import type {
  ParsedPropertyInput,
  ZenlistPropertyResult,
  ZillowPropertyResult,
} from './types';

/**
 * Call Zenlist API for property data
 * 
 * Priority: 1 (highest)
 * 
 * TODO: Implement actual HTTP call to Zenlist API
 * - Endpoint: TBD (check Zenlist API docs)
 * - Auth: API key from process.env.ZENLIST_API_KEY
 * - Request: MLS ID or address lookup
 * - Response: Map to ZenlistPropertyResult
 * 
 * @param input - Parsed property input (address or MLS ID)
 * @param leadId - Optional lead ID for logging context
 * @returns Property data from Zenlist or null if not found/error
 */
export async function callZenlistForProperty(
  input: ParsedPropertyInput,
  leadId?: UUID
): Promise<ZenlistPropertyResult | null> {
  const startTime = Date.now();
  const endpoint = '/api/properties/lookup'; // TODO: Update with actual endpoint
  const requestPayload = {
    address: input.address,
    mlsId: input.mlsId,
  };

  try {
    // Log API call start
    logger.debug('Calling Zenlist API', {
      endpoint,
      input: requestPayload,
      leadId,
    });

    // TODO: Implement actual HTTP call
    // Example structure:
    // const response = await fetch(`${ZENLIST_API_URL}${endpoint}`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.ZENLIST_API_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(requestPayload),
    // });
    // const data = await response.json();
    // const result = mapZenlistResponseToResult(data);

    // For now, return null (stub)
    const responseTime = Date.now() - startTime;
    const result: ZenlistPropertyResult | null = null;

    // Log to external_api_logs table
    await logExternalApiCall({
      leadId: leadId || null,
      propertyId: null,
      provider: 'zenlist',
      endpoint,
      requestPayload,
      responseStatus: result ? 200 : 404,
      responseTimeMs: responseTime,
      errorMessage: result ? null : 'Stub implementation - not yet implemented',
    });

    if (!result) {
      logger.debug('Zenlist API returned no result', { input: requestPayload });
      return null;
    }

    logger.info('Zenlist API call successful', {
      mlsId: result.mlsId,
      address: result.address,
      responseTime,
    });

    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Zenlist API call failed', {
      error: errorMessage,
      input: requestPayload,
      leadId,
    });

    // Log error to external_api_logs
    await logExternalApiCall({
      leadId: leadId || null,
      propertyId: null,
      provider: 'zenlist',
      endpoint,
      requestPayload,
      responseStatus: null,
      responseTimeMs: responseTime,
      errorMessage,
    });

    return null;
  }
}

/**
 * Call Zillow API for property data
 * 
 * Priority: 2
 * 
 * TODO: Implement actual HTTP call to Zillow API
 * - Endpoint: TBD (check Zillow API docs - use official APIs only, no scraping)
 * - Auth: API key from process.env.ZILLOW_API_KEY
 * - Request: Address or ZPID lookup
 * - Response: Map to ZillowPropertyResult
 * 
 * @param input - Parsed property input (address or ZPID)
 * @param leadId - Optional lead ID for logging context
 * @returns Property data from Zillow or null if not found/error
 */
export async function callZillowForProperty(
  input: ParsedPropertyInput,
  leadId?: UUID
): Promise<ZillowPropertyResult | null> {
  const startTime = Date.now();
  const endpoint = '/api/properties/lookup'; // TODO: Update with actual endpoint
  const requestPayload = {
    address: input.address,
    zpid: input.zpid,
  };

  try {
    // Log API call start
    logger.debug('Calling Zillow API', {
      endpoint,
      input: requestPayload,
      leadId,
    });

    // TODO: Implement actual HTTP call
    // Example structure:
    // const response = await fetch(`${ZILLOW_API_URL}${endpoint}`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${process.env.ZILLOW_API_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(requestPayload),
    // });
    // const data = await response.json();
    // const result = mapZillowResponseToResult(data);

    // For now, return null (stub)
    const responseTime = Date.now() - startTime;
    const result: ZillowPropertyResult | null = null;

    // Log to external_api_logs table
    await logExternalApiCall({
      leadId: leadId || null,
      propertyId: null,
      provider: 'zillow',
      endpoint,
      requestPayload,
      responseStatus: result ? 200 : 404,
      responseTimeMs: responseTime,
      errorMessage: result ? null : 'Stub implementation - not yet implemented',
    });

    if (!result) {
      logger.debug('Zillow API returned no result', { input: requestPayload });
      return null;
    }

    logger.info('Zillow API call successful', {
      zpid: result.zpid,
      address: result.address,
      responseTime,
    });

    return result;
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Zillow API call failed', {
      error: errorMessage,
      input: requestPayload,
      leadId,
    });

    // Log error to external_api_logs
    await logExternalApiCall({
      leadId: leadId || null,
      propertyId: null,
      provider: 'zillow',
      endpoint,
      requestPayload,
      responseStatus: null,
      responseTimeMs: responseTime,
      errorMessage,
    });

    return null;
  }
}

/**
 * Call Attom API for property data
 * 
 * Priority: 3 (future)
 * 
 * Currently stubbed - returns null
 * 
 * TODO: Implement when Attom API credentials are available
 * 
 * @param input - Parsed property input
 * @param leadId - Optional lead ID for logging context
 * @returns Property data from Attom or null (stub always returns null)
 */
export async function callAttomForProperty(
  input: ParsedPropertyInput,
  leadId?: UUID
): Promise<null> {
  const startTime = Date.now();
  const endpoint = '/api/properties/lookup'; // TODO: Update with actual endpoint
  const requestPayload = {
    address: input.address,
  };

  logger.debug('Attom API call (stubbed)', {
    endpoint,
    input: requestPayload,
    leadId,
  });

  const responseTime = Date.now() - startTime;

  // Log to external_api_logs
  await logExternalApiCall({
    leadId: leadId || null,
    propertyId: null,
    provider: 'attom',
    endpoint,
    requestPayload,
    responseStatus: null,
    responseTimeMs: responseTime,
    errorMessage: 'Attom API not yet implemented',
  });

  // Stub always returns null
  return null;
}

/**
 * Helper function to log external API calls to the database
 * 
 * @param logData - API call log data
 */
async function logExternalApiCall(logData: {
  leadId: UUID | null;
  propertyId: UUID | null;
  provider: string;
  endpoint: string;
  requestPayload: unknown;
  responseStatus: number | null;
  responseTimeMs: number;
  errorMessage: string | null;
}): Promise<void> {
  try {
    const { error } = await supabase.from('external_api_logs').insert({
      lead_id: logData.leadId,
      property_id: logData.propertyId,
      provider: logData.provider,
      endpoint: logData.endpoint,
      direction: 'outbound',
      request_payload: logData.requestPayload,
      response_status: logData.responseStatus,
      response_time_ms: logData.responseTimeMs,
      error_message: logData.errorMessage,
    });

    if (error) {
      logger.error('Failed to log external API call', {
        error: error.message,
        provider: logData.provider,
      });
    }
  } catch (error) {
    // Don't throw - logging failures shouldn't break the main flow
    logger.error('Error logging external API call', {
      error: error instanceof Error ? error.message : String(error),
      provider: logData.provider,
    });
  }
}

