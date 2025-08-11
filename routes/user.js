import { Router } from 'express';
import { authGuard } from '../lib/auth.js';
import { readFavorites, upsertFavorites, readHistory, writeHistory,
readPlaylists, writePlaylists, getEntitlements } from '../lib/db.js';
import { addSessionTime } from '../lib/tags.js';
const r = Router();
r.use(authGuard);
r.get('/me', async (req, res) => {
const ent = await getEntitlements(req.user.uid);
res.json({ uid: req.user.uid, email: req.user.email, plan: ent.plan });
});
// Favoritos
r.get('/favorites', async (req, res) => {
res.json(await readFavorites(req.user.uid));
});
r.post('/favorites', async (req, res) => {
const { key, op } = req.body || {};
const fav = await readFavorites(req.user.uid);
const set = new Set(fav.items || []);
if (op === 'add') set.add(key); else if (op === 'remove') set.delete(key);
await upsertFavorites(req.user.uid, Array.from(set));
res.json({ ok: true });
});
// Histórico
r.get('/history', async (req, res) => res.json(await
readHistory(req.user.uid)));
r.post('/history', async (req, res) => {
const { key } = req.body || {};
const h = await readHistory(req.user.uid);
(h.items = h.items || []).unshift({ key, at: new Date().toISOString() });
h.items = h.items.slice(0, 1000);
await writeHistory(req.user.uid, h);
res.json({ ok: true });
});
// Playlists do usuário
r.get('/playlists', async (req, res) => res.json(await
readPlaylists(req.user.uid)));
r.post('/playlists', async (req, res) => {
const { name } = req.body || {};
const data = await readPlaylists(req.user.uid);
const id = cryptoRandomId();
(data.lists = data.lists || []).push({ id, name, items: [], createdAt: new
Date().toISOString() });
await writePlaylists(req.user.uid, data);
res.json({ ok: true, id });
});
r.put('/playlists/:id', async (req, res) => {
const { id } = req.params; const { name } = req.body || {};
const data = await readPlaylists(req.user.uid);
const pl = (data.lists || []).find(x => x.id === id); if (!pl) return
res.status(404).json({ error: 'not_found' });
pl.name = name; pl.updatedAt = new Date().toISOString();
await writePlaylists(req.user.uid, data);
res.json({ ok: true });
});
r.delete('/playlists/:id', async (req, res) => {
const { id } = req.params;
const data = await readPlaylists(req.user.uid);
data.lists = (data.lists || []).filter(x => x.id !== id);
await writePlaylists(req.user.uid, data);
res.json({ ok: true });
});
r.post('/playlists/:id/tracks', async (req, res) => {
const { id } = req.params; const { key } = req.body || {};
const data = await readPlaylists(req.user.uid);
const pl = (data.lists || []).find(x => x.id === id); if (!pl) return
res.status(404).json({ error: 'not_found' });
const set = new Set(pl.items || []); set.add(key); pl.items =
Array.from(set); pl.updatedAt = new Date().toISOString();
await writePlaylists(req.user.uid, data);
res.json({ ok: true });
});
r.delete('/playlists/:id/tracks', async (req, res) => {
const { id } = req.params; const { key } = req.body || {};
const data = await readPlaylists(req.user.uid);
const pl = (data.lists || []).find(x => x.id === id); if (!pl) return
res.status(404).json({ error: 'not_found' });
pl.items = (pl.items || []).filter(k => k !== key); pl.updatedAt = new
Date().toISOString();
await writePlaylists(req.user.uid, data);
res.json({ ok: true });
});
// Sessão — ping para somar minutos de uso
r.post('/session/ping', async (req, res) => {
await addSessionTime(req.user.uid, 1);
res.json({ ok: true });
});
function cryptoRandomId() {
return Math.random().toString(36).slice(2, 10) +
Math.random().toString(36).slice(2, 10);
}
export default r;
