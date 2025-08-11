import { Router } from 'express';
import { adminGuard, authGuard } from '../lib/auth.js';
import { getJson, putJson } from '../lib/s3.js';
import { sendPushTo } from '../lib/push.js';
const r = Router();
r.use(authGuard, adminGuard);
r.post('/push/send', async (req, res) => {
const { targets = [], title, body, icon, url } = req.body || {};
for (const uid of targets) await sendPushTo(uid, { title, body, icon,
url });
res.json({ ok: true });
});
r.post('/push/schedule', async (req, res) => {
const { when, targets = [], title, body, icon, url } = req.body || {};
const data = await safeRead('db/admin/notifications.json');
data.queue = data.queue || [];
data.queue.push({ id: Date.now().toString(36), when, targets, title, body,
icon, url, sent: false });
await putJson('db/admin/notifications.json', data);
res.json({ ok: true });
});
r.get('/stats', async (req, res) => {
// simples placeholder que lê contadores básicos
const users = await safeList('db/users/');
const playlists = await safeList('db/users/'); // contagem grosseira
res.json({ users: users.length, playlists: playlists.length });
});
async function safeRead(key) { try { return await getJson(key); } catch {
return {}; } }
async function safeList(prefix) { return []; }
export default r;
