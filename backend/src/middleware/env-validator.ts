/**
 * Environment Validator - Startup Configuration Check
 * 
 * This file validates that all required environment variables are present
 * at application startup. If any required variables are missing, the app
 * will exit with a clear error message.
 * 
 * DEPENDENCIES:
 * - backend/src/middleware/logger.ts: For logging validation results
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/server.ts (called at startup)
 * 
 * REQUIRED ENVIRONMENT VARIABLES:
 * - DATABASE_URL: Postgres connection string
 * - SUPABASE_JWT_SECRET: For verifying auth tokens
 * - OPENAI_API_KEY: For orchestrator
 * 
 * OPTIONAL ENVIRONMENT VARIABLES:
 * - TWILIO_* : For SMS/WhatsApp
 * - MANDRILL_* : For email
 * - And others...
 */
// Load environment variables from .env early in the lifecycle
import dotenv from 'dotenv';
dotenv.config();
import { logger } from './logger';

// ============================================================================
// Environment Variable Definitions
// ============================================================================

interface EnvVarDefinition {
  name: string;
  required: boolean;
  description: string;
  default?: string;
}

/**
 * List of all environment variables used by the application
 * Mark required=true for variables that MUST be present at startup
 */
const ENV_VARS: EnvVarDefinition[] = [
  // Database
  {
    name: 'DATABASE_URL',
    required: true,
    description: 'PostgreSQL connection string (Supabase)',
  },
  {
    name: 'SUPABASE_URL',
    required: false,
    description: 'Supabase project URL',
  },
  {
    name: 'SUPABASE_ANON_KEY',
    required: false,
    description: 'Supabase anonymous key (for auth verification)',
  },

  // Authentication
  {
    name: 'SUPABASE_JWT_SECRET',
    required: true,
    description: 'Supabase JWT secret for token verification',
  },

  // AI / Orchestration
  {
    name: 'OPENAI_API_KEY',
    required: true,
    description: 'OpenAI API key for orchestrator',
  },
  {
    name: 'ORCHESTRATOR_MODEL',
    required: false,
    description: 'OpenAI model to use',
    default: 'gpt-4o',
  },

  // Communications - Twilio (optional)
  {
    name: 'TWILIO_ACCOUNT_SID',
    required: false,
    description: 'Twilio account SID for SMS/WhatsApp',
  },
  {
    name: 'TWILIO_AUTH_TOKEN',
    required: false,
    description: 'Twilio auth token',
  },
  {
    name: 'TWILIO_WHATSAPP_NUMBER',
    required: false,
    description: 'Twilio WhatsApp number',
  },
  {
    name: 'TWILIO_SMS_NUMBER',
    required: false,
    description: 'Twilio SMS number',
  },

  // Communications - Mandrill (optional)
  {
    name: 'MANDRILL_API_KEY',
    required: false,
    description: 'Mandrill API key for email',
  },
  {
    name: 'MANDRILL_FROM_EMAIL',
    required: false,
    description: 'Default "from" email address',
  },
  {
    name: 'MANDRILL_REPLY_TO',
    required: false,
    description: 'Default "reply-to" email address',
  },

  // Application settings
  {
    name: 'PORT',
    required: false,
    description: 'Server port',
    default: '3001',
  },
  {
    name: 'NODE_ENV',
    required: false,
    description: 'Node environment (development, production, test)',
    default: 'development',
  },
  {
    name: 'APP_BASE_URL',
    required: false,
    description: 'Base URL for the application',
    default: 'http://localhost:3001',
  },
  {
    name: 'CORS_ORIGIN',
    required: false,
    description: 'Comma-separated list of allowed CORS origins',
    default: 'http://localhost:5173',
  },
  {
    name: 'TIMEZONE',
    required: false,
    description: 'Default timezone for scheduling',
    default: 'America/New_York',
  },

  // Logging
  {
    name: 'LOG_LEVEL',
    required: false,
    description: 'Logging level (error, warn, info, debug)',
    default: 'info',
  },
  {
    name: 'LOG_JSON',
    required: false,
    description: 'Output logs as JSON',
    default: 'false',
  },
];

// ============================================================================
// Validation Results
// ============================================================================

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    total: number;
    required: number;
    optional: number;
    missing: number;
    present: number;
  };
}

// ============================================================================
// Validator Function
// ============================================================================

/**
 * Validate all environment variables
 * 
 * @returns Validation result with errors and warnings
 */
export function validateEnv(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let missingCount = 0;
  let presentCount = 0;

  // Check each environment variable
  ENV_VARS.forEach((envVar) => {
    const value = process.env[envVar.name];
    const hasValue = value !== undefined && value !== '';

    if (hasValue) {
      presentCount++;
      // Apply default if not set but has default
    } else if (envVar.default) {
      process.env[envVar.name] = envVar.default;
      presentCount++;
      logger.debug(`Using default for ${envVar.name}: ${envVar.default}`);
    } else if (envVar.required) {
      // Required but missing
      errors.push(
        `Missing required environment variable: ${envVar.name} - ${envVar.description}`
      );
      missingCount++;
    } else {
      // Optional and missing
      warnings.push(
        `Optional environment variable not set: ${envVar.name} - ${envVar.description}`
      );
      missingCount++;
    }
  });

  const requiredCount = ENV_VARS.filter((v) => v.required).length;
  const optionalCount = ENV_VARS.length - requiredCount;

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    summary: {
      total: ENV_VARS.length,
      required: requiredCount,
      optional: optionalCount,
      missing: missingCount,
      present: presentCount,
    },
  };
}

/**
 * Validate environment and exit if invalid
 * Call this at application startup
 * 
 * @example
 * // In server.ts:
 * validateEnvOrExit();
 */
export function validateEnvOrExit(): void {
  logger.info('Validating environment configuration...');

  const result = validateEnv();

  // Log warnings (optional variables not set)
  if (result.warnings.length > 0) {
    logger.warn(`${result.warnings.length} optional environment variable(s) not set:`);
    result.warnings.forEach((warning) => {
      logger.warn(`  - ${warning}`);
    });
  }

  // Log errors (required variables not set)
  if (!result.valid) {
    logger.error(`Environment validation failed! ${result.errors.length} error(s):`);
    result.errors.forEach((error) => {
      logger.error(`  - ${error}`);
    });
    logger.error('\nPlease set the required environment variables and restart the application.');
    logger.error('See .env.example for a template of all required variables.\n');
    process.exit(1);
  }

  // Log success
  logger.info('Environment validation passed', {
    total: result.summary.total,
    required: result.summary.required,
    optional: result.summary.optional,
    present: result.summary.present,
    missing: result.summary.missing,
  });
}

/**
 * Get a required environment variable
 * Throws an error if not set
 * 
 * @param name - Environment variable name
 * @returns Variable value
 * @throws Error if variable is not set
 * 
 * @example
 * const apiKey = getRequiredEnv('OPENAI_API_KEY');
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Required environment variable not set: ${name}`);
  }
  return value;
}

/**
 * Get an optional environment variable with a default
 * 
 * @param name - Environment variable name
 * @param defaultValue - Default value if not set
 * @returns Variable value or default
 * 
 * @example
 * const port = getEnvWithDefault('PORT', '3001');
 */
export function getEnvWithDefault(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

// ============================================================================
// Export
// ============================================================================

export default {
  validateEnv,
  validateEnvOrExit,
  getRequiredEnv,
  getEnvWithDefault,
};
