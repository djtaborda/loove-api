import { Router } from 'express';
import { createUser, findUserByEmail, saveUser, validatePassword } from '../lib/db.js';
import { signSession } from '../lib/auth.js';

const router = Router();

// Registro
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'missing' });
  try {
    const user = await createUser(name, email, password);
    const token = signSession({ uid: user.uid, email: user.email });
    res.cookie('session', token, {
      httpOnly: true, signed: true, sameSite: 'lax', secure: true, maxAge: 30 * 24 * 3600 * 1000
    });
    res.json({ ok: true, user: { uid: user.uid, name: user.name, email: user.email, plan: user.plan } });
  } catch (e) {
    res.status(400).json({ error: e.message || 'error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await validatePassword(email, password);
  if (!user) return res.status(401).json({ error: 'invalid' });
  const token = signSession({ uid: user.uid, email: user.email });
  res.cookie('session', token, {
    httpOnly: true, signed: true, sameSite: 'lax', secure: true, maxAge: 30 * 24 * 3600 * 1000
  });
  res.json({ ok: true, user: { uid: user.uid, name: user.name, email: user.email, plan: user.plan } });
});

// Logout
router.post('/logout', (req, res) => {
  res.clearCookie('session');
  res.json({ ok: true });
});

export default router;
