// routes/auth.js
import { Router } from 'express';

const router = Router();

// Opções de cookie para a sessão (ajuste se necessário)
const cookieOpts = {
  httpOnly: true,
  secure: true,        // Render usa HTTPS; mantenha true
  sameSite: 'lax',
  path: '/',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
};

/**
 * Acesso convidado (sem senha)
 * GET /auth/guest
 */
router.get('/guest', (_req, res) => {
  const user = { id: 'guest', name: 'Guest', role: 'guest' };

  // conteúdo mínimo da “sessão”
  const session = { uid: user.id, role: user.role, iat: Date.now() };

  res.cookie('session', JSON.stringify(session), cookieOpts);
  res.status(200).json({ ok: true, user });
});

/**
 * Logout
 * POST /auth/logout
 */
router.post('/logout', (_req, res) => {
  res.clearCookie('session', { path: '/' });
  res.json({ ok: true });
});

export default router;
