// server.js
import express from 'express';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

// Rotas da API
import authRoutes from './routes/auth.js';
import contentRoutes from './routes/content.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import webhookRoutes from './routes/webhooks.js';
import pushRoutes from './routes/push.js';

// Suporte a __dirname em ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

/* ========= Fix Render/Cloudflare =========
   Necessário para o express-rate-limit ler IP correto
   e evitar ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
*/
app.set('trust proxy', 1);

/* ========= Middlewares básicos ========= */
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'cookie_secret'));

/* ========= CORS =========
   Defina CORS_ORIGIN="https://loove-music.onrender.com"
   (ou lista separada por vírgula) nas variáveis de ambiente
*/
const origins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin || origins.length === 0 || origins.includes(origin)) {
        return cb(null, true);
      }
      return cb(null, false);
    },
    credentials: true,
  })
);

/* ========= Rate limit apenas em rotas sensíveis ========= */
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
});

/* ========= Rotas da API ========= */
app.use('/auth', authLimiter, authRoutes);
app.use('/content', contentRoutes);
app.use('/user', userRoutes);
app.use('/admin', adminRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/push', pushRoutes);

/* ========= Healthcheck ========= */
app.get('/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime() });
});

/* ========= Frontend estático (Vite build) ========= */
const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));

/* Service Worker e Manifest (opcional, se existirem fora do dist) */
app.get('/service-worker.js', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'service-worker.js'));
});
app.get('/manifest.webmanifest', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'manifest.webmanifest'));
});

/* ========= SPA fallback ========= */
app.get('*', (req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

/* ========= Boot ========= */
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Loove Music on :${PORT}`));
