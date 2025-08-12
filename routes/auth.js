// routes/auth.js (ESM)
import { Router } from 'express';
import {
  createUser,
  validatePassword,
  findUserByEmail,
  saveUser,
} from '../lib/db.js';
import { signSession } from '../lib/auth.js';
// (Opcional) se tiver rotas de esqueci senha, deixe sendMail configurado:
// import { sendMail } from '../lib/mail.js';

const router = Router();

// Utilidades simples
const normalizeEmail = (e) => String(e || '').trim().toLowerCase();
const hasText = (s) => typeof s === 'string' && s.trim().length > 0;

// Variável de ambiente para liberar login convidado (DEV)
const DEV_OPEN = process.env.DEV_OPEN === '1';

// --------- REGISTRAR (alias: /auth/register e /register) ----------
router.post(['/auth/register', '/register'], async (req, res) => {
  try {
    const name = String(req.body?.name || req.body?.nome || '').trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || req.body?.senha || '');

    if (!hasText(name) || !hasText(email) || !hasText(password)) {
      return res.status(400).json({ ok: false, error: 'missing' });
    }

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(409).json({ ok: false, error: 'email_in_use' });
    }

    const user = await createUser({ name, email, password });
    // cria sessão imediatamente após registrar
    const token = signSession({ uid: user.uid, email: user.email });
    res.cookie('session', token, {
      httpOnly: true,
      signed: true,
      sameSite: 'lax',
      secure: true, // HTTPS no Render -> ok
      maxAge: 30 * 24 * 3600 * 1000, // 30 dias
    });

    return res.status(200).json({
      ok: true,
      user: { uid: user.uid, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('register error', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// --------- LOGIN (alias: /auth/login e /login) ----------
router.post(['/auth/login', '/login'], async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');

    if (!hasText(email) || !hasText(password)) {
      return res.status(400).json({ ok: false, error: 'missing' });
    }

    const user = await findUserByEmail(email);
    if (!user) {
      // usuário não existe
      return res.status(401).json({ ok: false, error: 'invalid' });
    }

    const okPass = await validatePassword(user, password);
    if (!okPass) {
      // senha incorreta
      return res.status(401).json({ ok: false, error: 'invalid' });
    }

    const token = signSession({ uid: user.uid, email: user.email });
    res.cookie('session', token, {
      httpOnly: true,
      signed: true,
      sameSite: 'lax',
      secure: true,
      maxAge: 30 * 24 * 3600 * 1000,
    });

    return res.status(200).json({
      ok: true,
      user: { uid: user.uid, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('login error', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// --------- LOGOUT (alias: /auth/logout e /logout) ----------
router.post(['/auth/logout', '/logout'], (req, res) => {
  try {
    res.clearCookie('session');
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('logout error', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// --------- LOGIN DE CONVIDADO (DEV) ----------
router.get('/auth/guest', async (req, res) => {
  try {
    if (!DEV_OPEN) {
      return res.status(404).json({ ok: false, error: 'guest_disabled' });
    }

    // cria/atualiza um usuário "guest" simples (UID fixo)
    const guest = {
      uid: 'guest',
      email: 'guest@loove',
      name: 'Guest',
      plan: 'free',
      // sem senha
    };
    await saveUser(guest); // upsert

    const token = signSession({ uid: guest.uid, email: guest.email });
    res.cookie('session', token, {
      httpOnly: true,
      signed: true,
      sameSite: 'lax',
      secure: true,
      maxAge: 7 * 24 * 3600 * 1000, // 7 dias p/ convidado
    });

    // Redireciona para home já logado
    return res.redirect('/');
  } catch (err) {
    console.error('guest login error', err);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// --------- (Opcional) ESQUECI MINHA SENHA / RESET (deixe para depois) ----------
// Exemplo de stub seguro que não quebra a app se a rota existir no front:
// router.post('/auth/forgot', async (req, res) => {
//   return res.status(501).json({ ok: false, error: 'not_implemented' });
// });
// router.post('/auth/reset', async (req, res) => {
//   return res.status(501).json({ ok: false, error: 'not_implemented' });
// });

export default router;

