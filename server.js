// server.js
import express from 'express';
import path from 'path';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';

const app = express();

// Necessário no Render para rate-limit e IP correto
app.set('trust proxy', 1);

// Middlewares básicos
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'cookie_secret'));

// Limite apenas para rotas sensíveis de autenticação
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
});

// Rotas API
app.use('/auth', authLimiter, authRoutes);

// Healthcheck
app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// ====== Static do frontend (Vite build) ======
const __dirname = path.dirname(new URL(import.meta.url).pathname);
const clientDist = path.join(__dirname, 'client', 'dist');

app.use(express.static(clientDist));

// service worker e manifest direto da pasta client (se existirem)
app.get('/service-worker.js', (_req, res) =>
  res.sendFile(path.join(__dirname, 'client', 'service-worker.js'))
);
app.get('/manifest.webmanifest', (_req, res) =>
  res.sendFile(path.join(__dirname, 'client', 'manifest.webmanifest'))
);

// SPA fallback
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// Porta
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Loove Music on :${PORT}`));
