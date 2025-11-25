/**
 * Logger Middleware - Structured Logging
 * 
 * This file provides a centralized logging utility using Winston.
 * All application logging should use this logger for consistency.
 * 
 * DEPENDENCIES:
 * - winston: Logging library
 * 
 * INTEGRATIONS:
 * - Used by: All backend files
 * 
 * LOG LEVELS:
 * - error: Critical errors that need immediate attention
 * - warn: Warning messages for potentially problematic situations
 * - info: General informational messages about application progress
 * - debug: Detailed debugging information (only in development)
 * 
 * ENVIRONMENT VARIABLES:
 * - LOG_LEVEL: Logging level (default: 'info')
 * - LOG_JSON: Whether to output JSON logs (default: false in dev, true in prod)
 * - NODE_ENV: Environment (development, production, test)
 */

import winston from 'winston';

// ============================================================================
// Configuration
// ============================================================================

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const NODE_ENV = process.env.NODE_ENV || 'development';
const LOG_JSON = process.env.LOG_JSON === 'true' || NODE_ENV === 'production';

// ============================================================================
// Custom Log Format
// ============================================================================

// Format for development (human-readable)
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}] ${message}`;
    
    // Add metadata if present
    const metaKeys = Object.keys(metadata);
    if (metaKeys.length > 0 && metaKeys[0] !== 'Symbol(level)') {
      msg += ` ${JSON.stringify(metadata, null, 2)}`;
    }
    
    return msg;
  })
);

// Format for production (JSON)
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// ============================================================================
// Create Logger
// ============================================================================

export const logger = winston.createLogger({
  level: LOG_LEVEL,
  format: LOG_JSON ? prodFormat : devFormat,
  defaultMeta: {
    service: 'realleads-backend',
    environment: NODE_ENV,
  },
  transports: [
    // Console output
    new winston.transports.Console({
      handleExceptions: true,
      handleRejections: true,
    }),
  ],
  exitOnError: false,
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Log an HTTP request
 * Use this in Express middleware to log incoming requests
 * 
 * @param method - HTTP method (GET, POST, etc.)
 * @param url - Request URL
 * @param statusCode - Response status code
 * @param duration - Request duration in milliseconds
 * @param metadata - Additional metadata (user ID, IP, etc.)
 */
export function logRequest(
  method: string,
  url: string,
  statusCode: number,
  duration: number,
  metadata?: Record<string, any>
) {
  const logData = {
    method,
    url,
    statusCode,
    duration,
    ...metadata,
  };

  if (statusCode >= 500) {
    logger.error('HTTP request failed', logData);
  } else if (statusCode >= 400) {
    logger.warn('HTTP request error', logData);
  } else {
    logger.info('HTTP request completed', logData);
  }
}

/**
 * Log database operations
 * 
 * @param operation - Operation name (e.g., 'create_lead', 'get_leads')
 * @param duration - Operation duration in milliseconds
 * @param metadata - Additional metadata (table, rowCount, etc.)
 */
export function logDbOperation(
  operation: string,
  duration: number,
  metadata?: Record<string, any>
) {
  logger.debug('Database operation', {
    operation,
    duration,
    ...metadata,
  });
}

/**
 * Log orchestrator operations
 * 
 * @param input - User input
 * @param output - Orchestrator output
 * @param duration - Operation duration in milliseconds
 */
export function logOrchestrator(
  input: string,
  output: any,
  duration: number
) {
  logger.info('Orchestrator completed', {
    inputLength: input.length,
    inputPreview: input.substring(0, 100),
    outputMode: output.mode,
    actionCount: output.actions?.length || 0,
    duration,
  });
}

// ============================================================================
// Express Middleware
// ============================================================================

/**
 * Express middleware for request logging
 * Add this to your Express app to automatically log all requests
 * 
 * @example
 * app.use(requestLogger);
 */
export function requestLogger(req: any, res: any, next: any) {
  const startTime = Date.now();

  // Log when response is finished
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    logRequest(
      req.method,
      req.originalUrl || req.url,
      res.statusCode,
      duration,
      {
        userAgent: req.get('user-agent'),
        ip: req.ip,
        userId: req.user?.id, // If you have auth middleware
      }
    );
  });

  next();
}

// ============================================================================
// Startup Log
// ============================================================================

logger.info('Logger initialized', {
  level: LOG_LEVEL,
  format: LOG_JSON ? 'json' : 'pretty',
  environment: NODE_ENV,
});

// ============================================================================
// Export
// ============================================================================

export default logger;
