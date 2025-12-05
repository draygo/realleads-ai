/**
 * Audit Logging
 * 
 * Records all actions performed in the system for compliance and tracking
 * 
 * DEPENDENCIES:
 * - backend/src/db/client.ts (Supabase client)
 * - backend/src/utils/logger.ts
 * 
 * INTEGRATIONS:
 * - Called by action handlers after successful operations
 */

import { supabase } from './client';
import { logger } from '../middleware/logger';

// ============================================================================
// Types
// ============================================================================

export interface AuditLogEntry {
  account_id: string;
  actor: string; // owner_agent_id - the agent performing the action
  command_raw?: string; // Original natural language command
  parsed_action: string; // Action type (create_lead, update_lead, etc.)
  details?: Record<string, any>; // Additional context (lead_id, changes, etc.)
  status: 'success' | 'failure';
}

// ============================================================================
// Audit Logging Functions
// ============================================================================

/**
 * Log an action to the audit trail
 * 
 * @param entry - Audit log entry to record
 * @returns Success boolean
 */
export async function logAction(entry: AuditLogEntry): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('audit_log')
      .insert({
        account_id: entry.account_id,
        actor: entry.actor,
        command_raw: entry.command_raw || null,
        parsed_action: entry.parsed_action,
        details: entry.details || null,
        status: entry.status,
      });

    if (error) {
      logger.error('Failed to write audit log', {
        error: error.message,
        entry,
      });
      return false;
    }

    logger.debug('Audit log written', {
      action: entry.parsed_action,
      actor: entry.actor,
      status: entry.status,
    });

    return true;
  } catch (error) {
    logger.error('Audit logging error', {
      error: error instanceof Error ? error.message : String(error),
      entry,
    });
    return false;
  }
}

/**
 * Log a lead creation
 * 
 * @param ownerAgentId - ID of the agent who created the lead
 * @param accountId - Account ID
 * @param leadId - ID of the created lead
 * @param leadData - Lead details
 * @param commandRaw - Original command (optional)
 */
export async function logLeadCreated(
  ownerAgentId: string,
  accountId: string,
  leadId: string,
  leadData: Record<string, any>,
  commandRaw?: string
): Promise<void> {
  await logAction({
    account_id: accountId,
    actor: ownerAgentId,
    command_raw: commandRaw,
    parsed_action: 'create_lead',
    details: {
      lead_id: leadId,
      first_name: leadData.first_name,
      last_name: leadData.last_name,
      email: leadData.email,
      phone: leadData.phone,
      neighborhood: leadData.neighborhood,
      budget_max: leadData.budget_max,
      segments: leadData.segments,
    },
    status: 'success',
  });
}

/**
 * Log a lead update
 * 
 * @param ownerAgentId - ID of the agent who updated the lead
 * @param accountId - Account ID
 * @param leadId - ID of the updated lead
 * @param leadName - Full name of the lead
 * @param changes - Fields that were changed {field: {old: X, new: Y}}
 * @param commandRaw - Original command (optional)
 */
export async function logLeadUpdated(
  ownerAgentId: string,
  accountId: string,
  leadId: string,
  leadName: string,
  changes: Record<string, { old: any; new: any }>,
  commandRaw?: string
): Promise<void> {
  await logAction({
    account_id: accountId,
    actor: ownerAgentId,
    parsed_action: 'update_lead',
    command_raw: commandRaw,
    details: {
      lead_id: leadId,
      lead_name: leadName,
      changes,
      fields_updated: Object.keys(changes),
    },
    status: 'success',
  });
}

/**
 * Log a failed action
 * 
 * @param ownerAgentId - ID of the agent who attempted the action
 * @param accountId - Account ID
 * @param action - Action that failed
 * @param error - Error message
 * @param commandRaw - Original command (optional)
 */
export async function logActionFailed(
  ownerAgentId: string,
  accountId: string,
  action: string,
  error: string,
  commandRaw?: string
): Promise<void> {
  await logAction({
    account_id: accountId,
    actor: ownerAgentId,
    command_raw: commandRaw,
    parsed_action: action,
    details: {
      error,
    },
    status: 'failure',
  });
}

// ============================================================================
// Export
// ============================================================================

export default {
  logAction,
  logLeadCreated,
  logLeadUpdated,
  logActionFailed,
};
