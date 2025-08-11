import { setEntitlements, getEntitlements } from './db.js';
export async function applyPlanByEmail(email, plan) {
// resolve uid por email
const { findUserByEmail } = await import('./db.js');
const user = await findUserByEmail(email);
if (!user) return false;
const ent = await getEntitlements(user.uid);
ent.plan = plan; // free | premium | gold
await setEntitlements(user.uid, ent);
return true;
}
