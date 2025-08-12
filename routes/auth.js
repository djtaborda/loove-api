// routes/auth.js
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = express.Router();

// ===== Config =====
const JWT_SECRET = process.env.JWT_SECRET || 'dev_jwt_secret';
const COOKIE_NAME = 'session';
const isProd = process.env.NODE_ENV === 'production';

const cookieOpts = {
  httpOnly: true,
  secure: true,          // Render serve HTTPS
  sameSite: 'lax',
  path: '/',
  signed: true,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
};

// ===== "Banco" simples em memória (suficiente para testes) =====
/**
 * Observação: isso é volátil. Em cada restart do servidor o “banco”
 * começa vazio. Para produção, troque por uma persistência real.
 */
const users = new Map(); // key: email, value: { id, email, name, role, passhash? }

// Helper para gerar ids simples
const uid = (p = 'u') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// ===== Helpers =====
function signSession(res, payload) {
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
  res.cookie(COOKIE_NAME, token, cookieOpts);
}

function readSession(req) {
  const token = req.signedCookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// ===== Rotas =====

// Criar/entrar como CONVIDADO (GET e POST para facilitar)
async function guestHandler(_req, res) {
  // cria um usuário “Guest” efêmero
  const id = uid('guest');
  const email = `${id}@guest.local`;
  const user = { id, email, name: 'Convidado', role: 'guest' };

  // não armazena senha para guest
  users.set(email, user);

  // grava sessão no cookie
  signSession(res, { id: user.id, email: user.email, role: user.role });
  return res.json({ ok: true, user });
}
router.get('/guest', guestHandler);
router.post('/guest', guestHandler);

// Criar conta normal
router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password || !name) {
      return res.status(400).json({ ok: false, error: 'Dados inválidos' });
    }
    const existing = users.get(email);
    if (existing) return res.status(409).json({ ok: false, error: 'E-mail já cadastrado' });

    const passhash = await bcrypt.hash(password, 10);
    const user = { id: uid('usr'), email, name, role: 'user', passhash };
    users.set(email, user);

    signSession(res, { id: user.id, email: user.email, role: user.role });
    return res.json({ ok: true, user: { id: user.id, email, name, role: user.role } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Erro ao cadastrar' });
  }
});

// Login com e-mail/senha
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: 'Dados inválidos' });

    const user = users.get(email);
    if (!user || !user.passhash) {
      return res.status(401).json({ ok: false, error: 'E-mail ou senha inválidos' });
    }
    const ok = await bcrypt.compare(password, user.passhash);
    if (!ok) return res.status(401).json({ ok: false, error: 'E-mail ou senha inválidos' });

    signSession(res, { id: user.id, email: user.email, role: user.role });
    return res.json({ ok: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Erro ao autenticar' });
  }
});

// Quem sou eu
router.get('/me', (req, res) => {
  const ses = readSession(req);
  if (!ses) return res.status(401).json({ ok: false, error: 'Sem sessão' });

  // tenta complementar com o “banco”
  const stored = [...users.values()].find(u => u.id === ses.id) || { id: ses.id, email: ses.email, role: ses.role, name: 'Usuário' };
  return res.json({ ok: true, user: { id: stored.id, email: stored.email, name: stored.name, role: stored.role } });
});

// Logout
router.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME, { ...cookieOpts, maxAge: 0 });
  res.json({ ok: true });
});

export default router;
