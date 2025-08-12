// server.js
import 'dotenv/config';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

// __dirname para ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Routers (ajuste os caminhos se algum nome for diferente)
import authRoutes from './routes/auth.js';
import contentRoutes from './routes/content.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import webhookRoutes from './routes/webhooks.js';
import pushRoutes from './routes/push.js';

const app = express();

/* ==== Middlewares básicos ==== */
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'cookie_secret'));

/* ==== CORS ==== */
const origins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      // relax para PWA/local e quando não há origem (ex.: cURL/health)
      if (!origin || origins.length === 0 || origins.includes(origin)) return cb(null, true);
      return cb(null, true);
    },
    credentials: true,
  })
);

/* ==== Rate limit em rotas sensíveis ==== */
const authLimiter = rateLimit({ windowMs: 60_000, max: 30 });
app.use('/auth', authLimiter);

/* ==== Rotas API ==== */
app.use('/auth', authRoutes);
app.use('/content', contentRoutes);
app.use('/user', userRoutes);
app.use('/admin', adminRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/push', pushRoutes);

/* ==== Healthcheck ==== */
app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

/* ==== Frontend estático (build do Vite) ==== */
const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));

/* Service worker e manifest */
app.get('/service-worker.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'service-worker.js'));
});

app.get('/manifest.webmanifest', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'manifest.webmanifest'));
});

/* SPA fallback */
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

/* ==== Start ==== */
const PORT = Number(process.env.PORT || 8080);
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  const addr = server.address();
  const where =
    typeof addr === 'string' ? addr : `${addr.address}:${addr.port} (${addr.family})`;
  console.log('Loove Music listening on', where);
});
