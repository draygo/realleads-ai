// ANSI color helper functions
const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`;
const blue = (text: string) => `\x1b[34m${text}\x1b[0m`;
const gray = (text: string) => `\x1b[90m${text}\x1b[0m`;
const green = (text: string) => `\x1b[32m${text}\x1b[0m`;

// Express types for middleware
import type { Request, Response, NextFunction } from 'express';

// Utility to get current ISO timestamp in blue
const getTimestamp = () => blue(new Date().toISOString());

// Utility to log messages with optional meta
function logWithMeta(
  colorFunc: (t: string) => string,
  prefix: string,
  message: string,
  meta?: any
) {
  const ts = getTimestamp();
  const msg = prefix ? `[${prefix}] ${message}` : message;
  if (meta !== undefined) {
    try {
      // Print meta object as indented JSON in gray
      console.log(`${ts} ${colorFunc(msg)} ${gray(JSON.stringify(meta, null, 2))}`);
    } catch (_) {
      // fallback if meta cannot be stringified
      console.log(`${ts} ${colorFunc(msg)} ${gray(String(meta))}`);
    }
  } else {
    console.log(`${ts} ${colorFunc(msg)}`);
  }
}

// Logger object with required methods
export const logger = {
  /**
   * Info logger - blue timestamp + message
   */
  info(message: string, meta?: any) {
    logWithMeta(blue, '', message, meta);
  },

  /**
   * Error logger - red text, ERROR prefix
   */
  error(message: string, meta?: any) {
    logWithMeta(red, 'ERROR', message, meta);
  },

  /**
   * Warn logger - yellow text, WARN prefix
   */
  warn(message: string, meta?: any) {
    logWithMeta(yellow, 'WARN', message, meta);
  },

  /**
   * Debug logger - gray text, DEBUG prefix
   */
  debug(message: string, meta?: any) {
    logWithMeta(gray, 'DEBUG', message, meta);
  },
};

/**
 * Express middleware to log HTTP requests.
 * Logs: METHOD URL STATUS TIME, colored by status code.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const started = Date.now();

  // Called when response is finished
  function logRequest() {
    const ms = Date.now() - started;
    const { method, originalUrl } = req;
    const status = res.statusCode;

    // Color status code based on type
    let color: (s: string) => string;
    if (status >= 500) {
      color = red;
    } else if (status >= 400) {
      color = red;
    } else if (status >= 300) {
      color = yellow;
    } else if (status >= 200) {
      color = green;
    } else {
      color = gray;
    }

    const statusStr = color(String(status));
    const timeStr = gray(`${ms}ms`);

    // Example: GET /api/leads 200 45ms
    console.log(
      `${getTimestamp()} ${method} ${originalUrl} ${statusStr} ${timeStr}`
    );
  }

  // Use both finish and close events to ensure logging
  res.on('finish', logRequest);
  res.on('close', logRequest);

  next();
}
