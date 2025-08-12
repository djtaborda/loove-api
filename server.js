// server.js
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';

// ===== util para __dirname em ESM =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Importante para apps atrás de proxy (Render/Cloudflare)
app.set('trust proxy', 1);

// ---- Middlewares básicos
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'cookie_secret'));

// ---- CORS (permite apenas os domínios configurados; se não houver, permite todos)
const origins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || origins.length === 0 || origins.includes(origin)) return cb(null, true);
      return cb(null, true); // relax para PWA local; troque por cb(new Error('CORS'), false) se quiser restringir
    },
    credentials: true,
  })
);

// ---- Rate limit (rotas sensíveis)
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
});

// ---- Rotas API
app.use('/auth', authLimiter, authRoutes);

// ---- Healthcheck
app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

// ---- Frontend estático (build do Vite)
const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));

// Service Worker e Manifest (se existirem na raiz de client/)
app.get('/service-worker.js', (_req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'service-worker.js'));
});
app.get('/manifest.webmanifest', (_req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'manifest.webmanifest'));
});

// ---- SPA fallback (sempre por último)
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ---- Start
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Loove Music on :${PORT}`);
});
