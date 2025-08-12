// routes/auth.js
import { Router } from 'express';
import { validatePassword, signSession } from '../lib/auth.js';
import { createUser, findUserByEmail, saveUser } from '../lib/db.js';

const router = Router();

/**
 * Registro
 */
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'missing' });
  }
  try {
    const user = await createUser(name, email, password);
    const token = signSession({ uid: user.uid, email: user.email });
    res.cookie('session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      maxAge: 30 * 24 * 3600 * 1000,
    });
    res.json({ ok: true, user: { uid: user.uid, name: user.name, email: user.email, plan: user.plan } });
  } catch (e) {
    res.status(400).json({ error: e.message || 'error' });
  }
});

/**
 * Login
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  const user = await validatePassword(email, password);
  if (!user) return res.status(401).json({ error: 'invalid' });

  const token = signSession({ uid: user.uid, email: user.email });
  res.cookie('session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 3600 * 1000,
  });
  res.json({ ok: true, user: { uid: user.uid, name: user.name, email: user.email, plan: user.plan } });
});

/**
 * Logout
 */
router.post('/logout', (req, res) => {
  res.clearCookie('session');
  res.json({ ok: true });
});

/**
 * Login como convidado (sem senha)
 * GET /auth/guest
 */
router.get('/guest', async (_req, res) => {
  const user = {
    uid: `guest_${Date.now()}`,
    name: 'Visitante',
    email: 'guest@loove',
    plan: 'free',
  };

  const token = signSession({ uid: user.uid, email: user.email, role: 'guest' });
  res.cookie('session', token, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    maxAge: 30 * 24 * 3600 * 1000,
  });

  return res.json({ ok: true, user });
});

export default router;
