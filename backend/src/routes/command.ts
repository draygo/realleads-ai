/**
 * Command Routes - Natural Language Command Processing
 * 
 * This file provides endpoints for processing natural language commands
 * from various channels (console, WhatsApp, web).
 * 
 * DEPENDENCIES:
 * - backend/src/orchestrator/index.ts: Orchestration logic
 * - backend/src/executor/index.ts: Action execution
 * - backend/src/middleware/logger.ts: Logging
 * 
 * ENDPOINTS:
 * - POST /command: Process a natural language command
 * - POST /api/command: Alternative path (for API consistency)
 */

import { Router, Request, Response } from 'express';
import { orchestrate, validateInput } from '../orchestrator';
import { executeActions, ExecutionContext } from '../executor';
import { logger } from '../middleware/logger';

export const commandRouter = Router();

/**
 * POST /command or POST /api/command
 * Process a natural language command
 * 
 * Request body:
 * {
 *   "input": "Create a lead for John...",
 *   "context": {
 *     "channel": "console",
 *     "leadId": "optional-lead-id"
 *   }
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "mode": "execute" | "clarification_needed",
 *   "explanation": "...",
 *   "results": [...] // if execute mode
 *   "follow_up_question": "..." // if clarification_needed
 * }
 */
commandRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { input, context = {} } = req.body;

    // Validate input
    const validation = validateInput(input);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid input',
        message: validation.error,
      });
    }

    // Get agent ID from context or use default
    const agentId = context.agentId || process.env.ACCOUNT_ID_DEFAULT;
    if (!agentId) {
      return res.status(400).json({
        success: false,
        error: 'Missing agent ID',
        message: 'No agent ID provided and no default configured',
      });
    }

    logger.info('Processing command', {
      inputLength: input.length,
      channel: context.channel || 'console',
      agentId,
    });

    // Orchestrate the command
    const orchestratorResponse = await orchestrate(input, {
      agentId,
      channel: context.channel,
      leadId: context.leadId,
      previousMessages: context.previousMessages,
    });

    // If clarification needed, return the question
    if (orchestratorResponse.mode === 'clarification_needed') {
      logger.info('Clarification needed', {
        missingFields: orchestratorResponse.missing_fields,
      });

      return res.json({
        success: true,
        mode: 'clarification_needed',
        explanation: orchestratorResponse.explanation,
        missing_fields: orchestratorResponse.missing_fields,
        follow_up_question: orchestratorResponse.follow_up_question,
      });
    }

    // Execute the actions
    const executionContext: ExecutionContext = {
      agentId,
      timezone: context.timezone || 'America/Los_Angeles',
    };

    const executionResult = await executeActions(
      orchestratorResponse.actions,
      executionContext
    );

    logger.info('Command processed successfully', {
      mode: 'execute',
      actionsExecuted: executionResult.results.length,
      allSucceeded: executionResult.success,
    });

    return res.json({
      success: executionResult.success,
      mode: 'execute',
      explanation: orchestratorResponse.explanation,
      ui: orchestratorResponse.ui,
      results: executionResult.results,
      summary: executionResult.summary,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Command processing error', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });

    return res.status(500).json({
      success: false,
      error: 'Command processing failed',
      message: errorMessage,
    });
  }
});

// Health check endpoint for commands
commandRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', source: 'command-route' });
});
