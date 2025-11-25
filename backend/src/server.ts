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
import { authRouter } from './routes/auth';
import { startSchedulers } from './scheduler';

// -----------------------------------------------------------------------------
// ENVIRONMENT SETUP
// -----------------------------------------------------------------------------

// Load environment variables from process.env (Replit Secrets, .env, etc.)
dotenv.config();

// Validate that required env vars are present (Twilio, Mailchimp, Supabase, etc.)
const envValidation = validateEnv();
if (!envValidation.valid) {
  console.error('❌ Environment validation failed:');
  envValidation.errors.forEach(err => console.error(`  - ${err}`));
  process.exit(1);
}

// -----------------------------------------------------------------------------
// EXPRESS APP SETUP
// -----------------------------------------------------------------------------

// Create the Express application instance
const app = express();
const PORT = Number(process.env.PORT) || 4000; // backend dev port

// -----------------------------------------------------------------------------
// MIDDLEWARE
// -----------------------------------------------------------------------------

// CORS configuration – for now we allow all origins, which is fine in dev.
// Later, you can tighten this to your actual frontend origin(s).
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  })
);

// Parse JSON and URL-encoded bodies (up to 10MB)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Log each incoming request (method, path, duration, etc.)
app.use(requestLogger);

// -----------------------------------------------------------------------------
// ROUTES
// -----------------------------------------------------------------------------

// Health check & integration status
app.use('/health', healthRouter);

// Core API endpoints
app.use('/command', commandRouter);
app.use('/api/leads', leadsRouter);
app.use('/api/auth', authRouter);
app.use('/api/communications', communicationsRouter);
app.use('/api/pending-messages', pendingMessagesRouter);
app.use('/api/campaigns', campaignsRouter);
app.use('/api/audit-log', auditLogRouter);

// Webhook handlers (Twilio WhatsApp, etc.)
app.use('/twilio', twilioWebhookRouter);

// Root endpoint – simple JSON describing the service
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

// -----------------------------------------------------------------------------
// ERROR HANDLING
// -----------------------------------------------------------------------------

// 404 handler for unknown routes
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler (catches thrown errors / next(err))
app.use(errorHandler);

// -----------------------------------------------------------------------------
// SERVER STARTUP
// -----------------------------------------------------------------------------

app.listen(PORT, () => {
  logger.info(`🚀 RealLeads.ai Backend running on port ${PORT}`);
  logger.info(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`🌍 CORS origin: ${process.env.CORS_ORIGIN || '*'}`);

  // Start scheduled jobs (follow-ups, digests)
  // Right now this calls a simple stub in scheduler.ts so the app doesn't crash.
  if (process.env.NODE_ENV !== 'test') {
    startSchedulers();
    logger.info('⏰ Schedulers started (follow-ups at 9am PT, digests at 7am PT)');
  }
});

// Graceful shutdown on SIGTERM / SIGINT (Replit, Docker, etc.)
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

export default app;
