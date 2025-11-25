/**
 * Command Route - Natural Language Command Processing
 * 
 * This route accepts natural language commands and processes them using:
 * 1. Orchestrator: Interprets command → structured actions
 * 2. Executor: Executes actions → database/API operations
 * 
 * DEPENDENCIES:
 * - backend/src/orchestrator/index.ts: Natural language processing
 * - backend/src/executor/index.ts: Action execution
 * - backend/src/db/client.ts: Supabase token verification
 * - backend/src/middleware/logger.ts: Logging
 * - backend/src/middleware/error-handler.ts: Error handling
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/server.ts
 * - Called by: Frontend dashboard, WhatsApp webhook
 * 
 * WORKFLOW:
 * 1. Client sends natural language command with auth token
 * 2. Verify auth token → get agent ID
 * 3. Orchestrator processes command → structured actions
 * 4. If clarification needed → return follow-up question
 * 5. If ready to execute → Executor runs actions
 * 6. Return results to client
 */

import { Router, Request, Response } from 'express';
import { orchestrate, validateInput } from '../orchestrator';
import { executeActions } from '../executor';
import { verifySupabaseToken } from '../db/client';
import { logger } from '../middleware/logger';
import {
  asyncHandler,
  AuthError,
  ValidationError,
} from '../middleware/error-handler';
import { isClarificationNeeded } from '../orchestrator/parser';

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface CommandRequest {
  input: string;
  context?: {
    channel?: string;
    leadId?: string;
    previousMessages?: string[];
  };
}

interface CommandResponse {
  mode: 'clarification_needed' | 'execute';
  explanation: string;
  followUpQuestion?: string;
  missingFields?: string[];
  actions?: any[];
  results?: any[];
  summary?: string;
}

// ============================================================================
// Auth Middleware
// ============================================================================

/**
 * Middleware to verify Supabase token and attach agent info to request
 * This runs before the command route handler
 */
async function authMiddleware(req: Request, res: Response, next: any) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AuthError('Authorization header missing or invalid');
    }

    const accessToken = authHeader.substring(7);

    // Verify Supabase token
    const authResult = await verifySupabaseToken(accessToken);

    if (!authResult || !authResult.isValid) {
      throw new AuthError('Invalid or expired token');
    }

    // Get internal agent ID from database
    const { db } = await import('../db/client');
    const agentQuery = `
      SELECT id, email, display_name, role
      FROM agents
      WHERE supabase_user_id = $1
    `;

    const agentResult = await db.query(agentQuery, [authResult.userId]);

    if (agentResult.rows.length === 0) {
      throw new AuthError('User not found - please sign in again');
    }

    // Attach agent info to request
    (req as any).agent = agentResult.rows[0];

    next();
  } catch (error) {
    next(error);
  }
}

// ============================================================================
// Routes
// ============================================================================

/**
 * POST /command
 * 
 * Process a natural language command
 * 
 * HEADERS:
 * - Authorization: Bearer <supabase_access_token>
 * 
 * BODY:
 * - input: string (required) - Natural language command
 * - context: object (optional) - Additional context
 *   - channel: string - Where the command came from
 *   - leadId: string - If acting on specific lead
 *   - previousMessages: string[] - Previous messages for context
 * 
 * RETURNS:
 * - 200: Command processed successfully
 *   - mode: "clarification_needed" | "execute"
 *   - explanation: string
 *   - followUpQuestion?: string (if clarification needed)
 *   - results?: any[] (if executed)
 * - 400: Invalid input
 * - 401: Authentication failed
 * - 500: Internal server error
 * 
 * @example
 * POST /command
 * Headers: { Authorization: "Bearer <token>" }
 * Body: {
 *   "input": "Create a new lead for Sarah Lee, email sarah@example.com, budget $2M, looking at condos in SOMA"
 * }
 */
router.post(
  '/',
  authMiddleware,
  asyncHandler(async (req: Request, res: Response) => {
    const startTime = Date.now();
    const agent = (req as any).agent;

    // Validate request body
    const { input, context } = req.body as CommandRequest;

    if (!input) {
      throw new ValidationError('Input is required');
    }

    // Validate input
    const validation = validateInput(input);
    if (!validation.valid) {
      throw new ValidationError(validation.error || 'Invalid input');
    }

    logger.info('Command received', {
      agentId: agent.id,
      inputLength: input.length,
      inputPreview: input.substring(0, 100),
      channel: context?.channel,
      leadId: context?.leadId,
    });

    // Build orchestration context
    const orchestrationContext = {
      agentId: agent.id,
      channel: context?.channel || 'api',
      leadId: context?.leadId,
      previousMessages: context?.previousMessages,
    };

    // Step 1: Orchestrate (interpret natural language)
    const orchestratorResponse = await orchestrate(input, orchestrationContext);

    logger.info('Orchestration completed', {
      mode: orchestratorResponse.mode,
      agentId: agent.id,
    });

    // Step 2: Check if clarification is needed
    if (isClarificationNeeded(orchestratorResponse)) {
      const duration = Date.now() - startTime;

      logger.info('Clarification needed', {
        missingFields: orchestratorResponse.missing_fields,
        agentId: agent.id,
        duration,
      });

      const response: CommandResponse = {
        mode: 'clarification_needed',
        explanation: orchestratorResponse.explanation,
        followUpQuestion: orchestratorResponse.follow_up_question,
        missingFields: orchestratorResponse.missing_fields,
      };

      return res.json(response);
    }

    // Step 3: Execute actions
    const executionContext = {
      agentId: agent.id,
      timezone: 'America/New_York', // TODO: Get from agent preferences
    };

    const executionResult = await executeActions(
      orchestratorResponse.actions,
      executionContext
    );

    const duration = Date.now() - startTime;

    logger.info('Command executed', {
      success: executionResult.success,
      actionCount: orchestratorResponse.actions.length,
      agentId: agent.id,
      duration,
    });

    // Step 4: Return results
    const response: CommandResponse = {
      mode: 'execute',
      explanation: orchestratorResponse.explanation,
      actions: orchestratorResponse.actions,
      results: executionResult.results,
      summary: executionResult.summary,
    };

    res.json(response);
  })
);

// ============================================================================
// Export Router
// ============================================================================

export default router;
