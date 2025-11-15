// backend/src/routes/health.ts
// Health + integrations check stubs

import { Router, Request, Response } from 'express';

export const healthRouter = Router();

healthRouter.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'RealLeads.ai Backend' });
});

healthRouter.get('/integrations', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    integrations: {
      twilio: 'unknown',
      supabase: 'unknown',
    },
  });
});

