// backend/src/routes/twilio-webhook.ts
// Placeholder Twilio webhook handler

import { Router, Request, Response } from 'express';

export const twilioWebhookRouter = Router();

twilioWebhookRouter.post('/whatsapp-webhook', (req: Request, res: Response) => {
  // For now, just log and return 200 so Twilio doesn't retry
  console.log('Received Twilio webhook payload:', req.body);
  res.status(200).send('ok');
});

