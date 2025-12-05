/**
 * Error Handler Middleware - Centralized Error Handling
 * 
 * This file provides centralized error handling for Express routes.
 * All errors thrown in routes will be caught and formatted consistently.
 * 
 * DEPENDENCIES:
 * - backend/src/middleware/logger.ts: For error logging
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/server.ts (as final middleware)
 * 
 * ERROR TYPES:
 * - ValidationError: Bad request / invalid input (400)
 * - AuthError: Authentication failure (401)
 * - ForbiddenError: Authorization failure (403)
 * - NotFoundError: Resource not found (404)
 * - Error: Generic server error (500)
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

// ============================================================================
// Custom Error Classes
// ============================================================================

/**
 * Base application error
 */
export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true; // Distinguishes operational errors from programming errors
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Validation error (400)
 * Use for invalid input, missing required fields, etc.
 */
export class ValidationError extends AppError {
  fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>) {
    super(message, 400);
    this.name = 'ValidationError';
    this.fields = fields;
  }
}

/**
 * Authentication error (401)
 * Use when user is not authenticated
 */
export class AuthError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401);
    this.name = 'AuthError';
  }
}

/**
 * Authorization error (403)
 * Use when user is authenticated but not authorized
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * Not found error (404)
 * Use when a resource doesn't exist
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * Rate limit error (429)
 * Use when rate limit is exceeded
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

// ============================================================================
// Error Handler Middleware
// ============================================================================

/**
 * Express error handling middleware
 * This should be the last middleware in your Express app
 * 
 * @example
 * // In server.ts:
 * app.use(errorHandler);
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Default to 500 server error
  let statusCode = 500;
  let message = 'Internal server error';
  let errors: any = undefined;

  // Handle known error types
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;

    // Include validation field errors if present
    if (err instanceof ValidationError && err.fields) {
      errors = err.fields;
    }
  } else if (err.name === 'ValidationError') {
    // Handle Zod or other validation errors
    statusCode = 400;
    message = 'Validation failed';
    errors = (err as any).errors || err.message;
  } else if (err.name === 'UnauthorizedError') {
    // Handle JWT errors from express-jwt
    statusCode = 401;
    message = 'Invalid or expired token';
  } else if (err.message) {
    // Use error message for other known errors
    message = err.message;
  }

  // Log the error
  logger.error('Error handled', {
    statusCode,
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: (req as any).user?.id,
  });

  // Don't expose internal error details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  // Send error response
  res.status(statusCode).json({
    error: {
      message,
      ...(errors && { errors }),
      ...(isDevelopment && { stack: err.stack }), // Only in development
    },
  });
}

/**
 * Async route wrapper
 * Wraps async route handlers to catch errors automatically
 * 
 * @example
 * app.get('/api/leads', asyncHandler(async (req, res) => {
 *   const leads = await getLeads();
 *   res.json(leads);
 * }));
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 handler for unmatched routes
 * Add this before the error handler middleware
 * 
 * @example
 * // In server.ts:
 * app.use(notFoundHandler);
 * app.use(errorHandler);
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction) {
  const error = new NotFoundError(`Route not found: ${req.method} ${req.originalUrl}`);
  next(error);
}

// ============================================================================
// Export
// ============================================================================

export default {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  RateLimitError,
};
