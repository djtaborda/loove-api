import { Router } from 'express';
import { authGuard } from '../lib/auth.js';
import { saveSubscription } from '../lib/push.js';
const r = Router();
r.get('/public-key', (req, res) => {
res.json({ key: process.env.VAPID_PUBLIC_KEY || '' });
});
r.post('/subscribe', authGuard, async (req, res) => {
const sub = req.body || {};
await saveSubscription(req.user.uid, sub);
res.json({ ok: true });
});
export default r;
