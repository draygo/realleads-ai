/**
 * RealLeads.ai Backend Server
 * Main Express application with REST API endpoints, webhook handlers, and schedulers
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { validateEnv } from './middleware/env-validator';
import { errorHandler } from './middleware/error-handler';
import { logger, requestLogger } from './middleware/logger';
import { commandRouter } from './routes/command';
import { leadsRouter } from './routes/leads';
import { communicationsRouter } from './routes/communications';
import { pendingMessagesRouter } from './routes/pending-messages';
import { campaignsRouter } from './routes/campaigns';
import { auditLogRouter } from './routes/audit-log';
import { healthRouter } from './routes/health';
import { twilioWebhookRouter } from './routes/twilio-webhook';
import { startSchedulers } from './scheduler';

// Load environment variables
dotenv.config();

// Validate required environment variables
const envValidation = validateEnv();
if (!envValidation.valid) {
  console.error('❌ Environment validation failed:');
  envValidation.errors.forEach(err => console.error(`  - ${err}`));
  process.exit(1);
}

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// =====================================================================
// MIDDLEWARE
// =====================================================================

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging
app.use(requestLogger);

// =====================================================================
// ROUTES
// =====================================================================

// Health check & integration status
app.use('/health', healthRouter);

// Core API endpoints
app.use('/command', commandRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/communications', communicationsRouter);
app.use('/api/pending-messages', pendingMessagesRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/audit-log', auditLogRouter);

// Webhook handlers
app.use('/twilio', twilioWebhookRouter);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'RealLeads.ai Backend',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      health: '/health',
      integrations: '/health/integrations',
      command: 'POST /command',
      leads: '/api/leads',
      communications: '/api/communications',
      pendingMessages: '/api/pending-messages',
      campaigns: '/api/campaigns',
      auditLog: '/api/audit-log',
      twilioWebhook: 'POST /twilio/whatsapp-webhook',
    },
  });
});

// =====================================================================
// ERROR HANDLING
// =====================================================================

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use(errorHandler);

// =====================================================================
// SERVER STARTUP
// =====================================================================

app.listen(PORT, () => {
  logger.info(`🚀 RealLeads.ai Backend running on port ${PORT}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🌍 CORS origin: ${process.env.CORS_ORIGIN || '*'}`);
  
  // Start scheduled jobs (follow-ups, digests)
  if (process.env.NODE_ENV !== 'test') {
    startSchedulers();
    logger.info('⏰ Schedulers started (follow-ups at 9am PT, digests at 7am PT)');
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

export default app;
