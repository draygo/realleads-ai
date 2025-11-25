/**
 * RealLeads.ai Orchestrator - Main Orchestration Logic
 * 
 * This file contains the core orchestration logic that processes natural language input
 * and returns structured actions. It coordinates between:
 * - OpenAI API (via integrations/openai.ts)
 * - System prompts (via prompts.ts)
 * - Response parsing (via parser.ts)
 * 
 * DEPENDENCIES:
 * - backend/src/integrations/openai.ts: OpenAI API client
 * - backend/src/orchestrator/prompts.ts: System prompts
 * - backend/src/orchestrator/parser.ts: Response parser and validator
 * - backend/src/middleware/logger.ts: Logging
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/routes/command.ts
 * - Used by: backend/src/routes/twilio-webhook.ts (for WhatsApp)
 * 
 * WORKFLOW:
 * 1. User provides natural language input
 * 2. Orchestrator adds context (channel, lead_id, previous messages)
 * 3. OpenAI processes input and returns JSON
 * 4. Parser validates and returns structured response
 * 5. Executor runs actions (in calling code)
 */

import { callOrchestrator } from '../integrations/openai';
import { getSystemPrompt } from './prompts';
import { parseOrchestratorResponse, OrchestratorResponse } from './parser';
import { logger } from '../middleware/logger';

// ============================================================================
// Types
// ============================================================================

/**
 * Context information for orchestration requests
 * Provides additional context to help the orchestrator understand the situation
 */
export interface OrchestrationContext {
  agentId: string; // Always required - identifies which agent is making the request
  channel?: string; // Where the request came from (e.g., 'whatsapp', 'console', 'web')
  leadId?: string; // If acting on a specific lead
  previousMessages?: string[]; // Previous messages in a conversation (for context)
}

// ============================================================================
// Main Orchestration Function
// ============================================================================

/**
 * Orchestrates a natural language input into structured actions
 * 
 * This is the main entry point for the orchestrator. It:
 * 1. Builds a prompt with user input and context
 * 2. Calls OpenAI to process the input
 * 3. Parses and validates the response
 * 4. Returns structured actions for execution
 * 
 * @param userInput - Natural language input from the user
 * @param context - Required context (agentId) and optional context (channel, leadId, etc.)
 * @returns Parsed and validated orchestrator response
 * @throws Error if orchestration or parsing fails
 * 
 * @example
 * const response = await orchestrate(
 *   "Create a new lead for John Doe, email john@example.com, budget $2M",
 *   { agentId: 'agent-123', channel: 'console' }
 * );
 * 
 * if (response.mode === 'execute') {
 *   // Execute actions
 *   for (const action of response.actions) {
 *     await executeAction(action, context.agentId);
 *   }
 * }
 */
export async function orchestrate(
  userInput: string,
  context: OrchestrationContext
): Promise<OrchestratorResponse> {
  // Validate context
  if (!context.agentId) {
    throw new Error('agentId is required in orchestration context');
  }

  // Build system prompt
  const systemPrompt = getSystemPrompt();

  // Build user message with context if provided
  let userMessage = userInput;
  if (context) {
    const contextParts: string[] = [];

    // Always include agent ID in context
    contextParts.push(`Agent ID: ${context.agentId}`);

    if (context.channel) {
      contextParts.push(`Channel: ${context.channel}`);
    }
    if (context.leadId) {
      contextParts.push(`Lead ID: ${context.leadId}`);
    }
    if (context.previousMessages && context.previousMessages.length > 0) {
      contextParts.push(
        `Previous messages:\n${context.previousMessages
          .map((msg, idx) => `${idx + 1}. ${msg}`)
          .join('\n')}`
      );
    }

    // Append context to user message
    if (contextParts.length > 0) {
      userMessage = `${userInput}\n\nContext:\n${contextParts.join('\n')}`;
    }
  }

  // Log the request
  logger.info('Orchestrator request', {
    inputLength: userInput.length,
    hasContext: true,
    channel: context.channel,
    leadId: context.leadId,
    agentId: context.agentId,
  });

  const startTime = Date.now();
  let rawResponse: string;
  let retryCount = 0;
  const maxRetries = 1;

  // Retry loop (in case of parsing errors)
  while (retryCount <= maxRetries) {
    try {
      // Call OpenAI orchestrator
      rawResponse = await callOrchestrator(userMessage, systemPrompt);

      // Log raw response (truncated for readability)
      logger.debug('Orchestrator raw response', {
        responseLength: rawResponse.length,
        preview: rawResponse.substring(0, 200),
      });

      // Parse and validate response
      const parsed = parseOrchestratorResponse(rawResponse);

      const duration = Date.now() - startTime;

      logger.info('Orchestrator success', {
        duration,
        mode: parsed.mode,
        actionCount: parsed.mode === 'execute' ? parsed.actions.length : 0,
        agentId: context.agentId,
      });

      return parsed;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // If parsing failed and we haven't retried, retry with clearer instructions
      if (
        retryCount < maxRetries &&
        (errorMessage.includes('parse') ||
          errorMessage.includes('validation') ||
          errorMessage.includes('JSON'))
      ) {
        retryCount++;
        logger.warn('Orchestrator parsing failed, retrying with clearer instructions', {
          attempt: retryCount,
          error: errorMessage,
        });

        // Add retry instruction to user message
        userMessage = `${userMessage}\n\nIMPORTANT: Please respond with valid JSON only, following the exact response format specified. Do not include any markdown code blocks or additional text outside the JSON.`;

        continue;
      }

      const duration = Date.now() - startTime;

      // Log error with context
      logger.error('Orchestrator error', {
        duration,
        error: errorMessage,
        input: userInput.substring(0, 100),
        context,
        retryCount,
      });

      // Re-throw with additional context
      throw new Error(
        `Orchestration failed: ${errorMessage}. Input: "${userInput.substring(0, 50)}..."`
      );
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new Error('Orchestration failed after retries');
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Quick validation of user input before orchestration
 * Catches obvious issues early
 * 
 * @param userInput - User's natural language input
 * @returns Validation result
 */
export function validateInput(userInput: string): {
  valid: boolean;
  error?: string;
} {
  if (!userInput || userInput.trim().length === 0) {
    return {
      valid: false,
      error: 'Input cannot be empty',
    };
  }

  if (userInput.length > 10000) {
    return {
      valid: false,
      error: 'Input too long (max 10,000 characters)',
    };
  }

  return { valid: true };
}

// ============================================================================
// Export
// ============================================================================

export default {
  orchestrate,
  validateInput,
};

// Export types
export type { OrchestratorResponse, OrchestrationContext };
