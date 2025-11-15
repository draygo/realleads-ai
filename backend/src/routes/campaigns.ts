// backend/src/routes/campaigns.ts
// Placeholder routes for /api/campaigns

import { Router, Request, Response } from 'express';

export const campaignsRouter = Router();

campaignsRouter.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok', route: 'campaigns' });
});

