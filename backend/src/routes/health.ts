/**
 * Health Check Route
 * 
 * This route provides a health check endpoint for monitoring and load balancers.
 * It checks the status of critical dependencies (database, OpenAI).
 * 
 * DEPENDENCIES:
 * - backend/src/db/client.ts: Database health check
 * - backend/src/middleware/logger.ts: Logging
 * 
 * INTEGRATIONS:
 * - Used by: backend/src/server.ts
 * 
 * ENDPOINTS:
 * - GET /health: Basic health check
 * - GET /health/detailed: Detailed health check with component status
 */

import { Router, Request, Response } from 'express';
import { healthCheck as dbHealthCheck } from '../db/client';
import { logger } from '../middleware/logger';

const router = Router();

// ============================================================================
// Types
// ============================================================================

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version?: string;
  components?: {
    database: 'healthy' | 'unhealthy';
    openai: 'healthy' | 'unknown';
  };
}

// ============================================================================
// Routes
// ============================================================================

/**
 * GET /health
 * Basic health check - returns 200 if server is running
 * Used by load balancers and monitoring systems
 */
router.get('/', async (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

/**
 * GET /health/detailed
 * Detailed health check - checks database and other dependencies
 * Returns degraded status if any component is unhealthy
 */
router.get('/detailed', async (req: Request, res: Response) => {
  const startTime = Date.now();

  try {
    // Check database
    const dbStatus = (await dbHealthCheck()) ? 'healthy' : 'unhealthy';

    // OpenAI status (we can't really check this without making a call)
    const openaiStatus = process.env.OPENAI_API_KEY ? 'healthy' : 'unknown';

    // Overall status
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' = 'healthy';
    if (dbStatus === 'unhealthy') {
      overallStatus = 'unhealthy';
    } else if (openaiStatus === 'unknown') {
      overallStatus = 'degraded';
    }

    const healthStatus: HealthStatus = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version,
      components: {
        database: dbStatus,
        openai: openaiStatus as 'healthy' | 'unknown',
      },
    };

    const statusCode = overallStatus === 'healthy' ? 200 : overallStatus === 'degraded' ? 200 : 503;

    const duration = Date.now() - startTime;

    logger.debug('Health check completed', {
      status: overallStatus,
      duration,
      components: healthStatus.components,
    });

    res.status(statusCode).json(healthStatus);
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error('Health check failed', {
      error: error instanceof Error ? error.message : String(error),
      duration,
    });

    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      error: 'Health check failed',
    });
  }
});

// ============================================================================
// Export Router
// ============================================================================

export default router;
