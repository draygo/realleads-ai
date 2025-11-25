/**
 * OpenAI Integration - API Client for Orchestrator
 * 
 * This file provides functions to interact with OpenAI's API for:
 * - Chat completions (GPT-4o for orchestration)
 * - Audio transcription (Whisper for voice notes)
 * 
 * DEPENDENCIES:
 * - openai: Official OpenAI Node.js library
 * - backend/src/middleware/logger.ts: For logging API calls
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/orchestrator/index.ts
 * - Used by: backend/src/routes/command.ts (for voice transcription)
 * 
 * ENVIRONMENT VARIABLES:
 * - OPENAI_API_KEY: OpenAI API key (required)
 * - ORCHESTRATOR_MODEL: Model to use (default: gpt-4o)
 */

import OpenAI from 'openai';
import { logger } from '../middleware/logger';
import { getRequiredEnv, getEnvWithDefault } from '../middleware/env-validator';

// ============================================================================
// Configuration
// ============================================================================

const OPENAI_API_KEY = getRequiredEnv('OPENAI_API_KEY');
const ORCHESTRATOR_MODEL = getEnvWithDefault('ORCHESTRATOR_MODEL', 'gpt-4o');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: OPENAI_API_KEY,
});

logger.info('OpenAI client initialized', {
  model: ORCHESTRATOR_MODEL,
});

// ============================================================================
// Chat Completion (for Orchestrator)
// ============================================================================

/**
 * Call OpenAI's chat completion API for orchestration
 * Takes natural language input and returns structured JSON
 * 
 * @param userMessage - Natural language input from user
 * @param systemPrompt - System prompt defining orchestrator behavior
 * @param temperature - Sampling temperature (0-2, lower = more deterministic)
 * @returns Raw text response from GPT (should be JSON)
 * 
 * @example
 * const response = await callOrchestrator(
 *   "Create a new lead for John Doe, email john@example.com",
 *   systemPrompt
 * );
 */
export async function callOrchestrator(
  userMessage: string,
  systemPrompt: string,
  temperature: number = 0.3 // Low temperature for more consistent JSON output
): Promise<string> {
  const startTime = Date.now();

  try {
    logger.debug('Calling OpenAI orchestrator', {
      model: ORCHESTRATOR_MODEL,
      userMessageLength: userMessage.length,
      systemPromptLength: systemPrompt.length,
    });

    const completion = await openai.chat.completions.create({
      model: ORCHESTRATOR_MODEL,
      temperature,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userMessage,
        },
      ],
      // Request JSON response format (helps with consistency)
      response_format: { type: 'json_object' },
    });

    const duration = Date.now() - startTime;

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('Empty response from OpenAI');
    }

    logger.info('OpenAI orchestrator completed', {
      duration,
      model: ORCHESTRATOR_MODEL,
      inputTokens: completion.usage?.prompt_tokens,
      outputTokens: completion.usage?.completion_tokens,
      totalTokens: completion.usage?.total_tokens,
      responseLength: responseText.length,
    });

    return responseText;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('OpenAI orchestrator call failed', {
      duration,
      error: error instanceof Error ? error.message : String(error),
      model: ORCHESTRATOR_MODEL,
    });
    throw new Error(
      `OpenAI orchestrator call failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// ============================================================================
// Audio Transcription (Whisper)
// ============================================================================

/**
 * Transcribe audio using OpenAI's Whisper model
 * Useful for voice notes from WhatsApp
 * 
 * @param audioFile - Audio file buffer or stream
 * @param fileName - File name (e.g., 'voice-note.ogg')
 * @param language - Optional language code (e.g., 'en', 'es')
 * @returns Transcribed text
 * 
 * @example
 * const transcript = await transcribeAudio(audioBuffer, 'voice-note.ogg');
 */
export async function transcribeAudio(
  audioFile: Buffer | ReadableStream,
  fileName: string,
  language?: string
): Promise<string> {
  const startTime = Date.now();

  try {
    logger.debug('Transcribing audio with Whisper', {
      fileName,
      language,
    });

    // Convert Buffer to File-like object if needed
    const file = new File([audioFile as any], fileName);

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language, // Optional language hint
      response_format: 'text',
    });

    const duration = Date.now() - startTime;

    logger.info('Audio transcription completed', {
      duration,
      fileName,
      transcriptLength: transcription.length,
    });

    return transcription;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Audio transcription failed', {
      duration,
      error: error instanceof Error ? error.message : String(error),
      fileName,
    });
    throw new Error(
      `Audio transcription failed: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

// ============================================================================
// Chat Completion (General Purpose)
// ============================================================================

/**
 * General purpose chat completion
 * Use this for non-orchestrator AI tasks (e.g., generating email content)
 * 
 * @param messages - Array of chat messages
 * @param options - Additional options (temperature, model, etc.)
 * @returns Assistant's response
 * 
 * @example
 * const response = await chatCompletion([
 *   { role: 'system', content: 'You are a helpful assistant.' },
 *   { role: 'user', content: 'Write a follow-up email.' }
 * ]);
 */
export async function chatCompletion(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  }
): Promise<string> {
  const startTime = Date.now();

  try {
    const completion = await openai.chat.completions.create({
      model: options?.model || ORCHESTRATOR_MODEL,
      temperature: options?.temperature || 0.7,
      max_tokens: options?.maxTokens,
      messages,
    });

    const duration = Date.now() - startTime;

    const responseText = completion.choices[0]?.message?.content;
    if (!responseText) {
      throw new Error('Empty response from OpenAI');
    }

    logger.debug('Chat completion completed', {
      duration,
      model: options?.model || ORCHESTRATOR_MODEL,
      responseLength: responseText.length,
    });

    return responseText;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Chat completion failed', {
      duration,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// ============================================================================
// Export
// ============================================================================

export default {
  callOrchestrator,
  transcribeAudio,
  chatCompletion,
};
