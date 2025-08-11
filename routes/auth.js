import { Router } from 'express';
import { createUser, validatePassword, findUserByEmail, saveUser } from '../
lib/db.js';
import { signSession } from '../lib/auth.js';
import { sendMail } from '../lib/mail.js';
const r = Router();
r.post('/register', async (req, res) => {
const { name, email, password } = req.body || {};
if (!email || !password) return res.status(400).json({ error: 'missing' });
try {
const user = await createUser({ name, email, password });
const token = signSession({ uid: user.uid, email: user.email });
res.cookie('session', token, { httpOnly: true, signed: true, sameSite:
'lax', secure: true, maxAge: 30*24*3600*1000 });
res.json({ ok: true, user: { uid: user.uid, name: user.name, email:
user.email, plan: user.plan } });
} catch (e) {
res.status(400).json({ error: e.message || 'error' });
}
});
r.post('/login', async (req, res) => {
const { email, password } = req.body || {};
const user = await validatePassword(email, password);
if (!user) return res.status(401).json({ error: 'invalid' });
const token = signSession({ uid: user.uid, email: user.email });
res.cookie('session', token, { httpOnly: true, signed: true, sameSite:
'lax', secure: true, maxAge: 30*24*3600*1000 });
res.json({ ok: true, user: { uid: user.uid, name: user.name, email:
user.email, plan: user.plan } });
});
r.post('/logout', (req, res) => {
res.clearCookie('session');
res.json({ ok: true });
});
r.post('/forgot', async (req, res) => {
const { email } = req.body || {};
const user = await findUserByEmail(email);
if (!user) return res.json({ ok: true });
const token = signSession({ uid: user.uid, email: user.email });
await saveUser({ ...user, resetToken: token, resetAt: new
Date().toISOString() });
await sendMail({ to: user.email, subject: 'Redefinir sua senha — Loove
Music', html: `<p>Clique para redefinir: <a href="/reset?token=$
{token}">Redefinir senha</a></p>` });
res.json({ ok: true });
});
r.post('/reset', async (req, res) => {
const { token, password } = req.body || {};
if (!token || !password) return res.status(400).json({ error: 'missing' });
const { default: jwt } = await import('jsonwebtoken');
try {
const data = jwt.verify(token, process.env.JWT_SECRET || 'jwt_secret');
const { getUser } = await import('../lib/db.js');
const user = await getUser(data.uid);
if (!user || user.resetToken !== token) throw new Error('invalid');
const { saveUser } = await import('../lib/db.js');
const { default: bcrypt } = await import('bcryptjs');
const hash = await bcrypt.hash(password, 10);
user.pass = hash; delete user.resetToken; delete user.resetAt;
await saveUser(user);
res.json({ ok: true });
} catch {
res.status(400).json({ error: 'invalid' });
}
});
export default r;
