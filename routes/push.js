import { Router } from 'express';
import { pushEnabled, sendPush } from '../lib/push.js';

const router = Router();

/**
 * Recebe a inscrição (subscription) do navegador.
 * Por enquanto, apenas confirma (e ignora) se o push estiver desabilitado.
 * Futuro: salvar no banco vinculado ao UID do usuário.
 */
router.post('/subscribe', async (req, res) => {
  if (!pushEnabled) return res.json({ ok: false, skipped: true, reason: 'push-disabled' });
  // TODO: salvar req.body.subscription com o UID do usuário
  return res.json({ ok: true });
});

/**
 * Teste de envio de push (admin).
 * Body:
 * { "subscription": {...}, "payload": { "title":"...", "body":"...", "url": "..." } }
 */
router.post('/send', async (req, res) => {
  if (!pushEnabled) return res.json({ ok: false, skipped: true, reason: 'push-disabled' });
  const { subscription, payload } = req.body || {};
  if (!subscription) return res.status(400).json({ error: 'missing-subscription' });
  const result = await sendPush(subscription, payload || { title: 'Loove Music', body: 'Ping' });
  return res.json(result);
});

export default router;
