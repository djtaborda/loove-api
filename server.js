// server.js
import express from 'express';
import path from 'path';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import rateLimit from 'express-rate-limit';

import authRoutes from './routes/auth.js';
// (se tiver outros: contentRoutes, userRoutes, etc.)

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const app = express();

/* Segurança básica */
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'cookie_secret'));

/* MUITO IMPORTANTE para proxy (Render) */
app.set('trust proxy', 1);

/* CORS (ajuste se quiser travar ao seu domínio) */
const origins = (process.env.CORS_ORIGIN || '').split(',').filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || origins.length === 0 || origins.includes(origin)) return cb(null, true);
      return cb(null, true); // relax para PWA local
    },
    credentials: true,
  })
);

/* Rate limit só para /auth */
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
});
app.use('/auth', authLimiter);

/* Rotas API */
app.use('/auth', authRoutes);
// app.use('/content', contentRoutes) ...
// app.use('/user', userRoutes) ...
// app.use('/admin', adminRoutes) ...
// app.use('/webhooks', webhookRoutes) ...
// app.use('/push', pushRoutes) ...

/* Healthcheck */
app.get('/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

/* Static do frontend (build Vite) */
const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));

/* Service worker e manifest (se existirem) */
app.get('/service-worker.js', (_req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'service-worker.js'));
});
app.get('/manifest.webmanifest', (_req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'manifest.webmanifest'));
});

/* SPA fallback */
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

/* Start */
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Loove Music on :${PORT}`);
});
