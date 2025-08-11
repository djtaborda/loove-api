import { getUser, saveUser } from './db.js';
export async function addPlayTag(uid, genre) {
const user = await getUser(uid); if (!user) return;
user.tags = user.tags || {}; user.tags.genres = user.tags.genres || {};
if (genre) user.tags.genres[genre] = (user.tags.genres[genre] || 0) + 1;
10
await saveUser(user);
}
export async function addSessionTime(uid, minutes) {
const user = await getUser(uid); if (!user) return;
user.tags = user.tags || {}; user.tags.timeMinutes =
(user.tags.timeMinutes || 0) + (minutes || 1);
await saveUser(user);
}
