// backend/src/routes/pending-messages.ts
// Placeholder routes for /api/pending-messages

import { Router, Request, Response } from 'express';

export const pendingMessagesRouter = Router();

pendingMessagesRouter.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok', route: 'pending-messages' });
});

