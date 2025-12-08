/**
 * RealLeads.ai Backend Server
 * 
 * This is the main entry point for the backend application.
 * It sets up Express, middleware, routes, and starts the server.
 * 
 * DEPENDENCIES:
 * - express: Web framework
 * - cors: Cross-origin resource sharing
 * - helmet: Security headers
 * - body-parser: JSON parsing
 * - All route files and middleware
 * 
 * INTEGRATIONS:
 * - Connects to Supabase Postgres database
 * - Provides REST API and natural language command interface
 * - Handles authentication via Supabase tokens
 * 
 * ARCHITECTURE:
 * 1. Environment validation
 * 2. Express app setup
 * 3. Middleware configuration
 * 4. Route mounting
 * 5. Error handling
 * 6. Server startup
 */

// Load environment variables from .env when running locally
// src/server.ts
// Entry point for the backend API server. We import the environment loader first
// so that all process.env variables are available to the rest of the code.

import "./config/loadEnv";
import dotenv from 'dotenv';
dotenv.config();
import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { validateEnvOrExit } from './middleware/env-validator';
import { logger, requestLogger } from './middleware/logger';
import {
  errorHandler,
  notFoundHandler,
} from './middleware/error-handler';

// Import routes
import healthRoutes from './routes/health';
import authRoutes from './routes/auth';
import commandRoutes from './routes/command';
import leadsRoutes from './routes/leads';

// ============================================================================
// Environment Variables
// ============================================================================

// Validate environment variables at startup
// This will exit the process if required variables are missing
validateEnvOrExit();

const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';

// ============================================================================
// Express App Setup
// ============================================================================

const app: Express = express();

// ============================================================================
// Middleware Configuration
// ============================================================================

// Security headers
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: CORS_ORIGIN.split(',').map((origin) => origin.trim()),
  credentials: true,
  optionsSuccessStatus: 200,
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' })); // Parse JSON bodies
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies

// Request logging
app.use(requestLogger);

// ============================================================================
// Routes
// ============================================================================

// Health check routes (no auth required)
app.use('/health', healthRoutes);

// Auth routes
app.use('/api/auth', authRoutes);

// Command route (natural language interface)
app.use('/api/command', commandRoutes); // Alternative path

// REST API routes
app.use('/api/leads', leadsRoutes);

// Root route
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'RealLeads.ai Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      auth: '/api/auth/*',
      command: '/command or /api/command',
      leads: '/api/leads',
    },
  });
});

// ============================================================================
// Error Handling
// ============================================================================

// 404 handler (must be before error handler)
app.use(notFoundHandler);

// Global error handler (must be last)
app.use(errorHandler);

// ============================================================================
// Server Startup
// ============================================================================

/**
 * Start the Express server
 * Also handles graceful shutdown
 */
function startServer() {
  const server = app.listen(PORT, () => {
    logger.info('Server started successfully', {
      port: PORT,
      environment: NODE_ENV,
      corsOrigins: CORS_ORIGIN,
    });

    // Log available routes
    logger.info('Available routes:', {
      health: '/health',
      auth: '/api/auth/provision, /api/auth/me',
      command: '/command',
      leads: '/api/leads',
    });
  });

  // Graceful shutdown handling
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');

    server.close(async () => {
      logger.info('HTTP server closed');

      // Close database connections
      try {
        const { db } = await import('./db/client');
        await db.end();
        logger.info('Database connections closed');
      } catch (error) {
        logger.error('Error closing database connections', {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      process.exit(0);
    });

    // Force shutdown after 30 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 30000);
  });

  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    server.close(() => {
      process.exit(0);
    });
  });

  // Handle uncaught errors
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled promise rejection', {
      reason,
      promise,
    });
  });
}

// ============================================================================
// Start the Server
// ============================================================================

startServer();

// ============================================================================
// Export App (for testing)
// ============================================================================

export default app;
