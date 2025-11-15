// Global Express error handler middleware for centralized error management.

import { Request, Response, NextFunction } from 'express';
// Logger utility for logging errors with stack trace detail.
import { logger } from './logger';

/**
 * Global error handler for Express applications.
 * Catches all errors and sends consistent JSON error responses.
 * 
 * @param err - Error thrown in the application
 * @param req - Express request object
 * @param res - Express response object
 * @param next - Express next function (unused)
 */
export function errorHandler(
  err: Error & { statusCode?: number },
  req: Request,
  res: Response,
  next: NextFunction
) {
  // Log the error and its stack trace for debugging
  logger.error(err.stack ?? err.message, { error: err });

  // Determine HTTP status code based on error type/properties
  let statusCode = 500; // Default to Internal Server Error

  // Use explicit statusCode property if present
  if ('statusCode' in err && typeof err.statusCode === 'number') {
    statusCode = err.statusCode;
  } else if (err.name === 'ValidationError') {
    // Set specific status codes based on common error types
    statusCode = 400;
  } else if (err.name === 'UnauthorizedError') {
    statusCode = 401;
  } else if (err.name === 'NotFoundError') {
    statusCode = 404;
  }

  // Build response object, conditionally including stack trace in development
  res.status(statusCode).json({
    error: {
      message: err.message,
      status: statusCode,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
  });
}
