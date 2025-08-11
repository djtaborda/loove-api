import cron from 'node-cron';
import { getJson, putJson } from './s3.js';
import { sendPushTo } from './push.js';
export function mountScheduler() {
cron.schedule('* * * * *', async () => {
// roda a cada minuto e entrega notificações agendadas cujo horário <=
agora
try {
const data = await getJson('db/admin/notifications.json');
const now = Date.now();
const pending = (data.queue || []).filter(n => !n.sent && new
Date(n.when).getTime() <= now);
for (const n of pending) {
for (const uid of n.targets || []) {
await sendPushTo(uid, { title: n.title, body: n.body, icon: n.icon
|| undefined, url: n.url || '/' });
}
n.sent = true; n.sentAt = new Date().toISOString();
}
await putJson('db/admin/notifications.json', { queue: data.queue ||
[] });
} catch { /* ignore */ }
});
}
