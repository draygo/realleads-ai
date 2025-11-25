/**
 * Orchestrator Response Parser
 * 
 * This file validates and parses orchestrator responses from OpenAI using Zod schemas.
 * It ensures that the JSON response matches our expected structure before execution.
 * 
 * DEPENDENCIES:
 * - zod: Schema validation library
 * - shared/types.ts: TypeScript type definitions
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/orchestrator/index.ts
 * 
 * RESPONSE TYPES:
 * - ClarificationResponse: When more info is needed from user
 * - ExecuteResponse: When ready to execute actions
 */

import { z } from 'zod';

// ============================================================================
// Zod Schemas for Validation
// ============================================================================

/**
 * Action type enum - defines all valid action types
 * These correspond to executor action functions
 */
const ActionTypeSchema = z.enum([
  'create_lead',
  'get_leads',
  'update_lead',
  'get_communications',
  'draft_initial_followup',
  'create_pending_message',
  'send_sms',
  'send_whatsapp',
  'send_email',
  'ingest_content',
  'summarize_content_for_segments',
  'stage_campaign_from_content',
]);

/**
 * Action schema - defines structure of a single action
 * Each action has a type, parameters, and optional UI hints
 */
const ActionSchema = z.object({
  type: ActionTypeSchema,
  params: z.record(z.any()), // Flexible params object (validated by executor)
  ui: z
    .object({
      render: z.enum(['table', 'cards', 'graph', 'notice']).optional(),
      summary: z.string().optional(),
    })
    .optional(),
});

/**
 * Clarification response schema
 * Used when orchestrator needs more information from the user
 */
const ClarificationResponseSchema = z.object({
  mode: z.literal('clarification_needed'),
  explanation: z.string(),
  missing_fields: z.array(z.string()),
  follow_up_question: z.string(),
  actions: z.array(z.never()).default([]), // No actions in clarification mode
});

/**
 * Execute response schema
 * Used when orchestrator is ready to execute actions
 */
const ExecuteResponseSchema = z.object({
  mode: z.literal('execute'),
  explanation: z.string(),
  actions: z.array(ActionSchema).min(1), // Must have at least one action
  ui: z.object({
    render: z.enum(['table', 'cards', 'graph', 'notice']),
    summary: z.string(),
  }),
});

/**
 * Discriminated union for orchestrator response
 * Response can be either clarification or execute, determined by mode field
 */
const OrchestratorResponseSchema = z.discriminatedUnion('mode', [
  ClarificationResponseSchema,
  ExecuteResponseSchema,
]);

// ============================================================================
// TypeScript Types (exported from schemas)
// ============================================================================

export type ActionType = z.infer<typeof ActionTypeSchema>;
export type Action = z.infer<typeof ActionSchema>;
export type ClarificationResponse = z.infer<typeof ClarificationResponseSchema>;
export type ExecuteResponse = z.infer<typeof ExecuteResponseSchema>;
export type OrchestratorResponse = z.infer<typeof OrchestratorResponseSchema>;

// ============================================================================
// Parser Function
// ============================================================================

/**
 * Parses and validates an orchestrator response string
 * 
 * This function:
 * 1. Strips markdown code blocks (```json ... ```)
 * 2. Parses JSON
 * 3. Validates against Zod schema
 * 4. Returns typed OrchestratorResponse
 * 
 * @param responseText - Raw response text from OpenAI (may include markdown)
 * @returns Validated OrchestratorResponse
 * @throws Error if parsing or validation fails
 * 
 * @example
 * const response = parseOrchestratorResponse(gptOutput);
 * if (response.mode === 'execute') {
 *   // Execute actions
 *   for (const action of response.actions) {
 *     await executeAction(action);
 *   }
 * } else {
 *   // Ask user for clarification
 *   console.log(response.follow_up_question);
 * }
 */
export function parseOrchestratorResponse(
  responseText: string
): OrchestratorResponse {
  try {
    // Strip markdown code blocks if present
    // GPT sometimes wraps JSON in ```json ... ``` even when asked not to
    let cleaned = responseText.trim();
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/i, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '');
    }
    if (cleaned.endsWith('```')) {
      cleaned = cleaned.replace(/\s*```$/, '');
    }
    cleaned = cleaned.trim();

    // Parse JSON
    const parsed = JSON.parse(cleaned);

    // Validate with Zod schema
    const validated = OrchestratorResponseSchema.parse(parsed);

    return validated as OrchestratorResponse;
  } catch (error) {
    // Handle specific error types with helpful messages
    if (error instanceof z.ZodError) {
      const errorMessages = error.errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join(', ');
      throw new Error(
        `Orchestrator response validation failed: ${errorMessages}`
      );
    }

    if (error instanceof SyntaxError) {
      throw new Error(
        `Failed to parse orchestrator response as JSON: ${error.message}`
      );
    }

    throw new Error(
      `Unexpected error parsing orchestrator response: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if a response is a clarification request
 * 
 * @param response - Orchestrator response
 * @returns true if clarification is needed
 */
export function isClarificationNeeded(
  response: OrchestratorResponse
): response is ClarificationResponse {
  return response.mode === 'clarification_needed';
}

/**
 * Check if a response is an execute request
 * 
 * @param response - Orchestrator response
 * @returns true if ready to execute
 */
export function isExecuteResponse(
  response: OrchestratorResponse
): response is ExecuteResponse {
  return response.mode === 'execute';
}

// ============================================================================
// Export schemas for use in tests or other modules
// ============================================================================

export {
  ActionTypeSchema,
  ActionSchema,
  ClarificationResponseSchema,
  ExecuteResponseSchema,
  OrchestratorResponseSchema,
};

// ============================================================================
// Default Export
// ============================================================================

export default {
  parseOrchestratorResponse,
  isClarificationNeeded,
  isExecuteResponse,
};
