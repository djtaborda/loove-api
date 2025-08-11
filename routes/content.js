import { Router } from 'express';
import { listPrefixes, listObjects, isAudio, signedGetUrl } from '../lib/
s3.js';
import { authGuard } from '../lib/auth.js';
import { getEntitlements } from '../lib/db.js';
import { addPlayTag } from '../lib/tags.js';
const r = Router();
12
let INDEX_CACHE = { keys: [], at: 0 };
const INDEX_TTL_MS = 10 * 60 * 1000; // 10 min
async function refreshIndexIfNeeded() {
const now = Date.now();
if (now - INDEX_CACHE.at < INDEX_TTL_MS && INDEX_CACHE.keys.length) return
INDEX_CACHE.keys;
// lista tudo do bucket (paginado)
let token; const keys = [];
do {
const data = await listObjects({ token });
for (const obj of (data.Contents || [])) if (isAudio(obj.Key))
keys.push({ key: obj.Key, size: obj.Size || 0, lastModified:
obj.LastModified });
token = data.IsTruncated ? data.NextContinuationToken : undefined;
} while (token);
INDEX_CACHE = { keys, at: now };
return keys;
}
function isPremiumFolder(name = '') {
return /(^|\/)\s*.*(PREMIUM)\/?$/i.test(name);
}
function isGoldFolder(name = '') {
return /(^|\/)\s*.*(GOLD)\/?$/i.test(name);
}
r.get('/folders', authGuard, async (req, res) => {
const roots = await listPrefixes('');
const items = roots.map(p => ({ prefix: p, label: p.replace(/\/$/, ''),
premium: isPremiumFolder(p), gold: isGoldFolder(p) }));
res.json({ items });
});
// Lista músicas por prefix (pasta). Se search vazio, lista pasta. Se search
presente, busca global no índice.
r.get('/tracks', authGuard, async (req, res) => {
const { prefix = '', token, search = '' } = req.query;
const q = String(search || '').trim().toLowerCase();
if (q) {
const all = await refreshIndexIfNeeded();
const filtered = all.filter(o =>
o.key.toLowerCase().includes(q)).slice(0, 500);
return res.json({ items: filtered.map(mapObj), nextToken: null });
}
const data = await listObjects({ prefix, token });
const items = (data.Contents || []).filter(o =>
isAudio(o.Key)).map(mapObj);
13
res.json({ items, nextToken: data.IsTruncated ?
data.NextContinuationToken : null });
});
function mapObj(o) {
const name = o.key.split('/').pop();
const folder = o.key.includes('/') ? o.key.split('/').slice(0,
-1).join('/') : '';
return { key: o.key, name, folder, size: o.size, lastModified:
o.lastModified };
}
r.get('/stream-url', authGuard, async (req, res) => {
const key = req.query.key; if (!key) return res.status(400).json({ error:
'key' });
const folder = key.includes('/') ? key.split('/').slice(0, -1).join('/') :
'';
const ent = await getEntitlements(req.user.uid);
if (isGoldFolder(folder) && ent.plan !== 'gold') return
res.status(402).json({ error: 'gold_required' });
if (isPremiumFolder(folder) && !['premium','gold'].includes(ent.plan))
return res.status(402).json({ error: 'premium_required' });
const url = await signedGetUrl(key);
// tag por gênero = primeira parte da pasta
const genre = (folder.split('/')[0] || '').trim();
if (genre) addPlayTag(req.user.uid, genre).catch(()=>{});
res.json({ url });
});
export default r;
