import { Router } from 'express';
import { pushEnabled, sendPush } from '../lib/push.js';

const router = Router();

/**
 * Endpoint simples para enviar push (somente se VAPID estiver configurado).
 * Body esperado:
 * {
 *   "subscription": { ... },   // objeto de inscrição do navegador
 *   "payload": { "title": "...", "body": "...", "url": "..." } // opcional
 * }
 */
router.post('/push', async (req, res) => {
  if (!pushEnabled) {
    return res.json({ ok: false, skipped: true, reason: 'push-disabled' });
  }
  const { subscription, payload } = req.body || {};
  if (!subscription) return res.status(400).json({ error: 'missing-subscription' });

  const result = await sendPush(subscription, payload || { title: 'Loove Music', body: 'Ping' });
  return res.json(result);
});

// ping do painel admin (útil pra checar auth depois)
router.get('/health', (_req, res) => res.json({ ok: true }));

export default router;
