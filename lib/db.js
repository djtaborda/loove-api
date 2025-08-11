import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';
import { getJson, putJson } from './s3.js';
// Estrutura:
// db/users/{uid}.json
// db/emails/{email-safe}.json -> { uid }
// db/users/{uid}/playlists.json
// db/users/{uid}/favorites.json
// db/users/{uid}/history.json
// db/users/{uid}/push.json (subscriptions)
// db/users/{uid}/sessions.json (tempo de uso)
// db/entitlements/{uid}.json (planos, compras)
// db/admin/notifications.json (agendamentos)
function safeEmail(email) { return encodeURIComponent(email.toLowerCase()); }
export async function findUserByEmail(email) {
try {
const map = await getJson(`db/emails/${safeEmail(email)}.json`);
if (!map.uid) return null;
const user = await getJson(`db/users/${map.uid}.json`);
return user?.uid ? user : null;
} catch { return null; }
}
export async function getUser(uid) {
try { return await getJson(`db/users/${uid}.json`); } catch { return
null; }
}
export async function saveUser(user) {
await putJson(`db/users/${user.uid}.json`, user);
await putJson(`db/emails/${safeEmail(user.email)}.json`, { uid:
user.uid });
}
export async function createUser({ name, email, password }) {
const existing = await findUserByEmail(email);
if (existing) throw new Error('email_in_use');
7
const hash = await bcrypt.hash(password, 10);
const uid = uuid();
const now = new Date().toISOString();
const user = { uid, name, email, pass: hash, createdAt: now, role: 'user',
plan: 'free', tags: { month: monthName(new Date()), year: String(new
Date().getFullYear()) } };
await saveUser(user);
await putJson(`db/users/${uid}/favorites.json`, { items: [] });
await putJson(`db/users/${uid}/history.json`, { items: [] });
await putJson(`db/entitlements/${uid}.json`, { plan: 'free', purchases:
[], updatedAt: now });
return user;
}
export async function validatePassword(email, password) {
const user = await findUserByEmail(email);
if (!user) return null;
const ok = await bcrypt.compare(password, user.pass);
return ok ? user : null;
}
export async function upsertFavorites(uid, items) { await putJson(`db/users/$
{uid}/favorites.json`, { items }); }
export async function readFavorites(uid) { try { return await getJson(`db/
users/${uid}/favorites.json`); } catch { return { items: [] }; } }
export async function readHistory(uid) { try { return await getJson(`db/
users/${uid}/history.json`); } catch { return { items: [] }; } }
export async function writeHistory(uid, history) { await putJson(`db/users/$
{uid}/history.json`, history); }
export async function readPlaylists(uid) { try { return await getJson(`db/
users/${uid}/playlists.json`); } catch { return { lists: [] }; } }
export async function writePlaylists(uid, data) { await putJson(`db/users/$
{uid}/playlists.json`, data); }
export async function getEntitlements(uid) { try { return await getJson(`db/
entitlements/${uid}.json`); } catch { return { plan: 'free', purchases:
[] }; } }
export async function setEntitlements(uid, ent) { await putJson(`db/
entitlements/${uid}.json`, { ...ent, updatedAt: new
Date().toISOString() }); }
function monthName(d) { return d.toLocaleDateString('pt-BR', { month:
'long' }); }
