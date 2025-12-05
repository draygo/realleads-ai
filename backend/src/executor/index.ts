/**
 * Executor - Action Execution Coordinator
 * 
 * This file provides the main executor that takes structured actions from the
 * orchestrator and executes them. It:
 * - Validates action parameters
 * - Routes actions to the correct action handler
 * - Handles errors and logging
 * - Returns results in a consistent format
 * 
 * DEPENDENCIES:
 * - backend/src/executor/actions/*.ts: Individual action handlers
 * - backend/src/executor/validators.ts: Parameter validation
 * - backend/src/middleware/logger.ts: Logging
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/routes/command.ts
 * - Uses: backend/src/orchestrator/parser.ts (Action type)
 * 
 * ARCHITECTURE:
 * The executor is the bridge between the orchestrator (AI brain) and the
 * database/integrations. It takes high-level actions and translates them
 * into actual operations.
 */

import createLeadAction from './actions/create-lead';
import getLeadsAction from './actions/get-leads';
import updateLeadAction from './actions/update-lead';
import { validateActionParams } from './validators';
import { logger } from '../middleware/logger';
import { Action } from '../orchestrator/parser';

// ============================================================================
// Types
// ============================================================================

/**
 * Context for action execution
 * Provides necessary context that all actions need
 */
export interface ExecutionContext {
  agentId: string; // Required: which agent is executing the action
  userId?: string; // Optional: internal user ID (from Supabase auth)
  timezone?: string; // Optional: agent's timezone for scheduling
}

/**
 * Result of an action execution
 */
export interface ActionResult {
  success: boolean;
  actionType: string;
  data?: any; // Action-specific data (e.g., created lead, list of leads)
  message: string; // Human-readable message
  error?: string; // Error message if failed
}

/**
 * Result of executing multiple actions
 */
export interface ExecutionResult {
  success: boolean;
  results: ActionResult[];
  summary: string;
}

// ============================================================================
// Main Execution Function
// ============================================================================

/**
 * Execute an array of actions from the orchestrator
 * 
 * This function:
 * 1. Validates each action's parameters
 * 2. Executes actions in sequence
 * 3. Collects results
 * 4. Returns summary
 * 
 * @param actions - Array of actions from orchestrator
 * @param context - Execution context (agentId, timezone, etc.)
 * @returns Execution result with all action results
 * 
 * @example
 * const result = await executeActions(
 *   [
 *     { type: 'create_lead', params: { ... } },
 *     { type: 'draft_initial_followup', params: { ... } }
 *   ],
 *   { agentId: 'agent-123', timezone: 'America/Los_Angeles' }
 * );
 */
export async function executeActions(
  actions: Action[],
  context: ExecutionContext
): Promise<ExecutionResult> {
  logger.info('Executing actions', {
    count: actions.length,
    agentId: context.agentId,
    actionTypes: actions.map((a) => a.type),
  });

  const results: ActionResult[] = [];
  let allSucceeded = true;

  // Execute each action in sequence
  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    
    try {
      // CHAINING: Inject results from previous actions
      // If params contain placeholder for lead_id, replace with actual value from previous get_leads
      if (action.type === 'update_lead' && i > 0) {
        const previousResult = results[i - 1];
        
        // Check if previous action was get_leads and returned leads
        if (previousResult.actionType === 'get_leads' && previousResult.data?.leads?.length > 0) {
          // If lead_id is missing or is a placeholder, use the first lead from search
          if (!action.params.lead_id || action.params.lead_id.includes('{{') || action.params.lead_id.includes('from_')) {
            action.params.lead_id = previousResult.data.leads[0].id;
            logger.info('Chained action: injected lead_id from previous get_leads', {
              leadId: action.params.lead_id,
              agentId: context.agentId,
            });
          }
        }
      }
      
      const result = await executeSingleAction(action, context);
      results.push(result);
      
      if (!result.success) {
        allSucceeded = false;
      }
    } catch (error) {
      // If an action fails, log it and continue with remaining actions
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      logger.error('Action execution failed', {
        actionType: action.type,
        error: errorMessage,
        agentId: context.agentId,
      });
      
      results.push({
        success: false,
        actionType: action.type,
        message: `Failed to execute ${action.type}`,
        error: errorMessage,
      });
      
      allSucceeded = false;
    }
  }

  // Generate summary
  const successCount = results.filter((r) => r.success).length;
  const summary =
    allSucceeded
      ? `Successfully executed ${results.length} action${results.length === 1 ? '' : 's'}`
      : `Executed ${results.length} actions: ${successCount} succeeded, ${results.length - successCount} failed`;

  logger.info('Action execution completed', {
    total: results.length,
    succeeded: successCount,
    failed: results.length - successCount,
    agentId: context.agentId,
  });

  return {
    success: allSucceeded,
    results,
    summary,
  };
}

// ============================================================================
// Single Action Execution
// ============================================================================

/**
 * Execute a single action
 * Routes to the appropriate action handler based on action type
 * 
 * @param action - Action to execute
 * @param context - Execution context
 * @returns Action result
 */
async function executeSingleAction(
  action: Action,
  context: ExecutionContext
): Promise<ActionResult> {
  const startTime = Date.now();

  logger.debug('Executing action', {
    type: action.type,
    agentId: context.agentId,
  });

  // Validate parameters
  const validatedParams = validateActionParams(action.type, action.params);

  try {
    // Route to appropriate action handler
    let result: any;

    switch (action.type) {
      // ====================================================================
      // Lead Management Actions
      // ====================================================================
      case 'create_lead':
        result = await createLeadAction(validatedParams, context.agentId);
        break;

      case 'get_leads':
        result = await getLeadsAction(validatedParams, context.agentId);
        break;
      case 'update_lead':
        result = await updateLeadAction(validatedParams, context.agentId);
        break;

      // ====================================================================
      // Communication Query Actions
      // ====================================================================
      case 'get_communications':
        // TODO: Implement get_communications action
        throw new Error('get_communications action not yet implemented');

      // ====================================================================
      // Follow-up Drafting Actions
      // ====================================================================
      case 'draft_initial_followup':
        // TODO: Implement draft_initial_followup action
        throw new Error('draft_initial_followup action not yet implemented');

      // ====================================================================
      // Message Actions
      // ====================================================================
      case 'create_pending_message':
        // TODO: Implement create_pending_message action
        throw new Error('create_pending_message action not yet implemented');

      case 'send_sms':
        // TODO: Implement send_sms action
        throw new Error('send_sms action not yet implemented');

      case 'send_whatsapp':
        // TODO: Implement send_whatsapp action
        throw new Error('send_whatsapp action not yet implemented');

      case 'send_email':
        // TODO: Implement send_email action
        throw new Error('send_email action not yet implemented');

      // ====================================================================
      // Content & Campaign Actions
      // ====================================================================
      case 'ingest_content':
        // TODO: Implement ingest_content action
        throw new Error('ingest_content action not yet implemented');

      case 'summarize_content_for_segments':
        // TODO: Implement summarize_content_for_segments action
        throw new Error('summarize_content_for_segments action not yet implemented');

      case 'stage_campaign_from_content':
        // TODO: Implement stage_campaign_from_content action
        throw new Error('stage_campaign_from_content action not yet implemented');

      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }

    const duration = Date.now() - startTime;

    logger.debug('Action executed successfully', {
      type: action.type,
      duration,
      agentId: context.agentId,
    });

    // Return standardized result
    return {
      success: result.success !== false,
      actionType: action.type,
      data: result,
      message: result.message || `${action.type} completed successfully`,
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Action execution error', {
      type: action.type,
      duration,
      error: errorMessage,
      agentId: context.agentId,
    });

    throw error; // Re-throw for handling in executeActions
  }
}

// ============================================================================
// Export
// ============================================================================

export default {
  executeActions,
};

// Export types
export type { ExecutionContext, ActionResult, ExecutionResult };
