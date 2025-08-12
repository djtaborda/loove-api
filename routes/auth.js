// routes/auth.js
import { Router } from 'express';
import { createUser, validatePassword, findUserByEmail } from '../lib/db.js';
import { signSession } from '../lib/auth.js';

const router = Router();

const cookieOptions = {
  httpOnly: true,
  secure: true,          // estamos em HTTPS no Render
  sameSite: 'lax',
  path: '/',
  maxAge: 30 * 24 * 3600 * 1000, // 30 dias
  signed: true,           // usa COOKIE_SECRET
};

/**
 * Registrar
 */
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'missing' });
  }

  try {
    const user = await createUser({ name, email, password });
    const token = signSession({ uid: user.uid, email: user.email });
    res.cookie('session', token, cookieOptions);
    res.json({ ok: true, user: { uid: user.uid, name: user.name, email: user.email, plan: user.plan } });
  } catch (e) {
    res.status(400).json({ error: e?.message || 'error' });
  }
});

/**
 * Login
 */
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'missing' });
  }

  const user = await validatePassword(email, password);
  if (!user) {
    return res.status(401).json({ error: 'invalid' });
  }

  const token = signSession({ uid: user.uid, email: user.email });
  res.cookie('session', token, cookieOptions);
  res.json({ ok: true, user: { uid: user.uid, name: user.name, email: user.email, plan: user.plan } });
});

/**
 * Logout
 */
router.post('/logout', (req, res) => {
  res.clearCookie('session', { path: '/' });
  res.json({ ok: true });
});

/**
 * Guest (acesso sem senha)
 * GET /auth/guest  → cria uma sessão "guest" e redireciona para "/"
 */
router.get('/guest', (req, res) => {
  const token = signSession({
    uid: 'guest',
    email: 'guest@loove',
    name: 'Guest',
    plan: 'free',
  });

  res.cookie('session', token, cookieOptions);
  // redireciona para a home do app
  res.redirect('/');
});

export default router;
