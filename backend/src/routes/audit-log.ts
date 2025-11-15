// backend/src/routes/audit-log.ts
// Placeholder routes for /api/audit-log

import { Router, Request, Response } from 'express';

export const auditLogRouter = Router();

auditLogRouter.get('/', (req: Request, res: Response) => {
  res.json({ status: 'ok', route: 'audit-log' });
});

