// backend/src/routes/command.ts
// Basic placeholder router for command-related endpoints.

import { Router, Request, Response } from 'express';

export const commandRouter = Router();

// Example health/check endpoint for commands
commandRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', source: 'command-route' });
});

// TODO: add real command/voice/AI endpoints here
