// backend/src/routes/communications.ts
// Placeholder routes for /api/communications

import { Router, Request, Response } from 'express';

export const communicationsRouter = Router();

communicationsRouter.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok', route: 'communications' });
});

