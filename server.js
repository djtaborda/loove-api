// server.js — Loove API (ESM) — suporta S3_* e WASABI_*
// Requisitos no package.json: "type":"module"
// Dependências: express, compression, cors, jsonwebtoken, cookie-parser,
// @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, uuid

import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import http from "http";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { S3Client, ListObjectsV2Command, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

// ========= Infra básico =========
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.disable("x-powered-by");

// Desliga ETag globalmente (evita 304 teimoso em proxies)
app.set("etag", false);

// Middlewares padrão
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

// ========= Leitura de variáveis (aceita S3_* e WASABI_*) =========
const ENV = (k, def = undefined) =>
  process.env[k] ?? process.env[k.replace(/^S3_/, "WASABI_")] ?? def;

const ACCESS_PIN = process.env.ACCESS_PIN || "2468";
const JWT_SECRET = process.env.JWT_SECRET || "loove-secret";
const DEV_OPEN = (process.env.DEV_OPEN || "").toLowerCase() === "true";

const S3_ENDPOINT = ENV("S3_ENDPOINT", "https://s3.us-east-1.wasabisys.com");
const S3_REGION = ENV("S3_REGION", "us-east-1");
const S3_ACCESS_KEY_ID = ENV("S3_ACCESS_KEY_ID");
const S3_SECRET_ACCESS_KEY = ENV("S3_SECRET_ACCESS_KEY");
const S3_BUCKET = ENV("S3_BUCKET");

// Validação leve (loga, mas não derruba)
if (!S3_BUCKET) console.warn("[WARN] Bucket não definido (S3_BUCKET/WASABI_BUCKET). A listagem não funcionará.");
if (!S3_ACCESS_KEY_ID || !S3_SECRET_ACCESS_KEY)
  console.warn("[WARN] Credenciais não definidas (S3_ACCESS_KEY_ID/WASABI_ACCESS_KEY_ID).");

// Cliente S3 (Wasabi compatível)
const s3 = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT,
  forcePathStyle: true, // importante para Wasabi
  credentials: S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY ? {
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY
  } : undefined
});

// ========= Anti-cache SÓ para /api/* =========
app.use(/^\/api\//, (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.removeHeader("ETag");
  next();
});

// ========= Auth simples (PIN → JWT) =========
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}
function auth(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing token" });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: "invalid token" });
  }
}

// ========= Rotas públicas básicas =========
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "loove-api",
    ts: new Date().toISOString(),
    node: process.version,
    uptime: process.uptime()
  });
});

app.post("/api/login", (req, res) => {
  const { pin } = req.body || {};
  if (!pin) return res.status(400).json({ error: "pin required" });
  if (DEV_OPEN || String(pin) === String(ACCESS_PIN)) {
    return res.json({ token: signToken({ sub: "loove", iat: Math.floor(Date.now() / 1000) }) });
  }
  return res.status(401).json({ error: "invalid pin" });
});

app.get("/api/me", (req, res) => {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(200).json({ auth: false });
  try {
    const data = jwt.verify(token, JWT_SECRET);
    return res.json({ auth: true, user: { id: data.sub || "loove" } });
  } catch {
    return res.json({ auth: false });
  }
});

// ========= Funções S3 =========
async function listPrefixes(prefix = "") {
  if (!S3_BUCKET) throw new Error("bucket-not-configured");
  const cmd = new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    Prefix: prefix,
    Delimiter: "/",
    MaxKeys: 1000
  });
  const out = await s3.send(cmd);
  const folders = (out.CommonPrefixes || []).map(cp => {
    const p = cp.Prefix || "";
    const name = p.replace(prefix, "").replace(/\/$/, "");
    return { prefix: p, name };
  });
  return folders;
}

function isAudioKey(key = "") {
  return /\.(mp3|m4a|aac|wav|flac|ogg)$/i.test(key);
}

async function listObjects(prefix = "", token = null) {
  if (!S3_BUCKET) throw new Error("bucket-not-configured");
  const cmd = new ListObjectsV2Command({
    Bucket: S3_BUCKET,
    Prefix: prefix,
    ContinuationToken: token || undefined,
    MaxKeys: 1000
  });
  const out = await s3.send(cmd);
  const items = (out.Contents || [])
    .filter(o => isAudioKey(o.Key || ""))
    .map(o => ({ key: o.Key, name: path.basename(o.Key) }));
  return {
    items,
    nextToken: out.IsTruncated ? out.NextContinuationToken || null : null
  };
}

async function searchObjects(q = "", prefix = "", limit = 200) {
  // Implementação simples: varre páginas até achar "limit" itens
  let token = null;
  const found = [];
  const qNorm = q.trim().toLowerCase();
  for (let i = 0; i < 20 && found.length < limit; i++) {
    const page = await listObjects(prefix, token);
    for (const it of page.items) {
      if (found.length >= limit) break;
      if (it.name.toLowerCase().includes(qNorm)) found.push(it);
    }
    if (!page.nextToken) break;
    token = page.nextToken;
  }
  return found;
}

async function presign(key) {
  if (!S3_BUCKET) throw new Error("bucket-not-configured");
  // Valida se objeto existe (metadados)
  try {
    await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
  } catch (e) {
    // Se Head falhar por permissão, ainda tentamos presign
    // console.warn("HeadObject falhou, tentando presign mesmo assim:", e?.name || e);
  }
  const url = await getSignedUrl(
    s3,
    new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }), // truque para URL base
    { expiresIn: 60 } // 60s
  );
  // O getSignedUrl com Head gera URL válida; para download do objeto, troca o método:
  // Trabalho garantido: usa GET com getSignedUrl + RequestPresigner? Simples: refaz:
  const { request } = await import("@aws-sdk/s3-request-presigner");
  // Para simplificar e evitar custo adicional aqui, vamos fazer do jeito clássico:
  // O presigner com GetObject é o correto:
  const { GetObjectCommand } = await import("@aws-sdk/client-s3");
  const dl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    { expiresIn: 60 }
  );
  return dl;
}

// ========= Endpoints de dados =========
app.get("/api/folders", async (req, res) => {
  try {
    const prefix = String(req.query.prefix || "");
    const folders = await listPrefixes(prefix);
    res.json({ folders });
  } catch (e) {
    console.error("folders error:", e);
    res.status(500).json({ error: "folders-failed" });
  }
});

app.get("/api/list", async (req, res) => {
  try {
    const prefix = String(req.query.prefix || "");
    const token = req.query.token ? String(req.query.token) : null;
    const out = await listObjects(prefix, token);
    res.json(out);
  } catch (e) {
    console.error("list error:", e);
    res.status(500).json({ error: "list-failed" });
  }
});

app.get("/api/search", async (req, res) => {
  try {
    const q = String(req.query.q || "");
    if (!q || q.length < 2) return res.json({ items: [] });
    const prefix = String(req.query.prefix || "");
    const items = await searchObjects(q, prefix, 200);
    res.json({ items });
  } catch (e) {
    console.error("search error:", e);
    res.status(500).json({ error: "search-failed" });
  }
});

app.get("/api/stream", async (req, res) => {
  try {
    const key = String(req.query.key || "");
    if (!key) return res.status(400).json({ error: "key required" });
    const url = await presign(key);
    res.json({ url });
  } catch (e) {
    console.error("stream error:", e);
    res.status(500).json({ error: "stream-failed" });
  }
});

// ========= Static web (layout do /public) =========
const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, {
    setHeaders(res, filePath) {
      // dá cache curto p/ assets, mas sem ETag (já desligada globalmente)
      if (/\.(js|css|png|jpg|jpeg|webp|svg|ico|woff2?)$/i.test(filePath)) {
        res.setHeader("Cache-Control", "public, max-age=3600, immutable");
      } else {
        res.setHeader("Cache-Control", "no-cache");
      }
      res.removeHeader("ETag");
    }
  }));
  app.get("/", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));
}

// ========= Inicialização =========
const PORT = process.env.PORT ? Number(process.env.PORT) : 10000;
const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`✅ Server up on ${PORT}`);
});
