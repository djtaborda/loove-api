import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
3
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.js';
import contentRoutes from './routes/content.js';
import userRoutes from './routes/user.js';
import adminRoutes from './routes/admin.js';
import webhookRoutes from './routes/webhooks.js';
import pushRoutes from './routes/push.js';
dotenv.config();
const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Middleware básico
app.use(helmet());
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser(process.env.COOKIE_SECRET || 'cookie_secret'));
// CORS
const origins = (process.env.CORS_ORIGIN || '').split(',').filter(Boolean);
app.use(cors({ origin: (origin, cb) => {
if (!origin || origins.length === 0 || origins.includes(origin)) return
cb(null, true);
return cb(null, true); // relax para apps PWA locais
}, credentials: true }));
// Rate limit em rotas sensíveis
const authLimiter = rateLimit({ windowMs: 60_000, max: 30 });
app.use('/auth', authLimiter);
// Rotas API
app.use('/auth', authRoutes);
app.use('/content', contentRoutes);
app.use('/user', userRoutes);
app.use('/admin', adminRoutes);
app.use('/webhooks', webhookRoutes);
app.use('/push', pushRoutes);
// Static do frontend (build Vite)
const clientDist = path.join(__dirname, 'client', 'dist');
app.use(express.static(clientDist));
// Service worker e manifest
app.get('/service-worker.js', (req, res) =>
res.sendFile(path.join(__dirname, 'client', 'service-worker.js')));
app.get('/manifest.webmanifest', (req, res) =>
res.sendFile(path.join(__dirname, 'client', 'manifest.webmanifest')));
4
// SPA fallback
app.get('*', (req, res) => {
res.sendFile(path.join(clientDist, 'index.html'));
});
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`Loove Music on :${PORT}`));

