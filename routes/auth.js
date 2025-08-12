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
// --- INÍCIO: login de convidado temporário (DEV) ---
import { saveUser } from '../lib/db.js'; // deixe este import no topo do arquivo se preferir
const DEV_OPEN = process.env.DEV_OPEN === '1';

router.get('/guest', async (req, res) => {
  try {
    if (!DEV_OPEN) {
      return res.status(404).json({ error: 'guest login desabilitado' });
    }

    // cria/atualiza um usuário "guest" simples
    const guest = {
      uid: 'guest',
      email: 'guest@loove',
      name: 'Guest',
      plan: 'free'
      // sem password
    };
    await saveUser(guest); // upsert

    const token = signSession({ uid: guest.uid, email: guest.email });
    res.cookie('session', token, {
      httpOnly: true,
      signed: true,
      sameSite: 'lax',
      secure: true,                // ok porque o Render usa HTTPS
      maxAge: 30 * 24 * 3600 * 1000
    });

    // redireciona para a home já logado
    return res.redirect('/');
  } catch (e) {
    console.error('guest login error', e);
    return res.status(500).json({ error: 'guest_login_failed' });
  }
});
// --- FIM: login de convidado temporário (DEV) ---
