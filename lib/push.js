// lib/push.js
import webpush from 'web-push';

const contact = process.env.VAPID_CONTACT_EMAIL || 'mailto:support@loove-music.app';
const pub = process.env.VAPID_PUBLIC_KEY;
const priv = process.env.VAPID_PRIVATE_KEY;

export const pushEnabled = Boolean(pub && priv);

if (pushEnabled) {
  webpush.setVapidDetails(contact, pub, priv);
  // opcional: console.log('Push habilitado (VAPID ok)');
} else {
  // opcional: console.log('Push DESABILITADO (faltam VAPID keys)');
}

export async function sendPush(subscription, payload) {
  if (!pushEnabled) return { ok: false, skipped: true };
  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err?.message || 'push-failed' };
  }
}
