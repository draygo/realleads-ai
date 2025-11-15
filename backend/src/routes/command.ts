// backend/src/routes/command.ts
// Basic placeholder router for command-related endpoints.

import { Router } from 'express';

const router = Router();

// Example health/check endpoint for commands
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', source: 'command-route' });
});

// TODO: add real command/voice/AI endpoints here

export default router;
