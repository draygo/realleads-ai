// backend/src/routes/leads.ts
// Basic placeholder routes for /api/leads

import { Router, Request, Response } from 'express';

export const leadsRouter = Router();

leadsRouter.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok', route: 'leads' });
});
