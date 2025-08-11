import webpush from 'web-push';
import { getJson, putJson } from './s3.js';
webpush.setVapidDetails(process.env.VAPID_SUBJECT ||
'mailto:support@example.com', process.env.VAPID_PUBLIC_KEY || '',
process.env.VAPID_PRIVATE_KEY || '');
export async function saveSubscription(uid, sub) {
await putJson(`db/users/${uid}/push.json`, sub);
}
export async function loadSubscription(uid) {
try { return await getJson(`db/users/${uid}/push.json`); } catch { return
null; }
}
export async function sendPushTo(uid, payload) {
const sub = await loadSubscription(uid);
if (!sub) return { ok: false };
try {
await webpush.sendNotification(sub, JSON.stringify(payload));
return { ok: true };
} catch (e) { return { ok: false, error: e?.message }; }
}
