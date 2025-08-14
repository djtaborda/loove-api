// server.js — Loove API (ESM) — aceita credenciais WASABI_*, S3_* ou AWS_*
// Mantém o layout (public/) e adiciona anti-cache apenas em /api/*.

import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import http from "http";
import compression from "compression";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

// ========= util =========
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.disable("x-powered-by");
app.set("etag", false); // sem ETag

app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

// ========= anti-cache só em /api/* =========
app.use(/^\/api\//, (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  res.removeHeader("ETag");
  next();
});

// ========= env helpers (aceita vários prefixos) =========
const pickEnv = (...keys) => {
  for (const k of keys) {
    const v = process.env[k];
    if (v != null && String(v).length) return v;
  }
  return undefined;
};

const ACCESS_PIN  = pickEnv("ACCESS_PIN")  || "2468";
const JWT_SECRET  = pickEnv("JWT_SECRET")  || "loove-secret";
const DEV_OPEN    = (pickEnv("DEV_OPEN") || "").toLowerCase() === "true";

const S3_BUCKET   = pickEnv("S3_BUCKET", "WASABI_BUCKET", "AWS_BUCKET");
const S3_REGION   = pickEnv("S3_REGION", "WASABI_REGION", "AWS_REGION") || "us-east-1";
const S3_ENDPOINT = pickEnv("S3_ENDPOINT", "WASABI_ENDPOINT") || `https://s3.${S3_REGION}.wasabisys.com`;

const S3_ACCESS_KEY_ID     = pickEnv("S3_ACCESS_KEY_ID", "WASABI_ACCESS_KEY_ID", "AWS_ACCESS_KEY_ID");
const S3_SECRET_ACCESS_KEY = pickEnv("S3_SECRET_ACCESS_KEY", "WASABI_SECRET_ACCESS_KEY", "AWS_SECRET_ACCESS_KEY");

// logs de diagnóstico seguros (sem vazar segredo)
console.log("[S3] bucket:", S3_BUCKET || "(indefinido)");
console.log("[S3] region:", S3_REGION);
console.log("[S3] endpoint:", S3_ENDPOINT);
console.log("[S3] keyId:", S3_ACCESS_KEY_ID ? "***" + S3_ACCESS_KEY_ID.slice(-4) : "(indefinido)");

// ========= cliente S3/Wasabi =========
const s3 = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT,
  forcePathStyle: true,
  credentials: (S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY)
    ? { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY }
    : undefined // cai para provider chain; se não houver, dará erro claro
});

// ========= auth simples =========
const signToken = (payload) => jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
const auth = (req, res, next) => {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: "missing token" });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: "invalid token" }); }
};

// ========= rotas públicas =========
app.get("/health", (_req, res) => {
  res.json({ ok: true, service: "loove-api", ts: new Date().toISOString(), node: process.version, uptime: process.uptime() });
});

app.post("/api/login", (req, res) => {
  const pin = req.body?.pin;
  if (!pin) return res.status(400).json({ error: "pin required" });
  if (DEV_OPEN || String(pin) === String(ACCESS_PIN)) return res.json({ token: signToken({ sub: "loove" }) });
  return res.status(401).json({ error: "invalid pin" });
});

app.get("/api/me", (req, res) => {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.json({ auth: false });
  try { const data = jwt.verify(token, JWT_SECRET); return res.json({ auth: true, user: { id: data.sub || "loove" } }); }
  catch { return res.json({ auth: false }); }
});

// ========= helpers S3 =========
const isAudio = (k="") => /\.(mp3|m4a|aac|wav|flac|ogg)$/i.test(k);

async function listPrefixes(prefix="") {
  if (!S3_BUCKET) throw new Error("bucket-not-configured");
  const out = await s3.send(new ListObjectsV2Command({
    Bucket: S3_BUCKET, Prefix: prefix, Delimiter: "/", MaxKeys: 1000
  }));
  return (out.CommonPrefixes || []).map(cp => {
    const p = cp.Prefix || "";
    return { prefix: p, name: p.replace(prefix, "").replace(/\/$/, "") };
  });
}

async function listObjects(prefix="", token=null) {
  if (!S3_BUCKET) throw new Error("bucket-not-configured");
  const out = await s3.send(new ListObjectsV2Command({
    Bucket: S3_BUCKET, Prefix: prefix, ContinuationToken: token || undefined, MaxKeys: 1000
  }));
  const items = (out.Contents || []).filter(o => isAudio(o.Key || "")).map(o => ({
    key: o.Key, name: path.basename(o.Key)
  }));
  return { items, nextToken: out.IsTruncated ? (out.NextContinuationToken || null) : null };
}

async function searchObjects(q="", prefix="", limit=200) {
  const qn = q.trim().toLowerCase();
  const found = [];
  let token = null;
  for (let i=0; i<20 && found.length<limit; i++) {
    const page = await listObjects(prefix, token);
    for (const it of page.items) {
      if (found.length >= limit) break;
      if (it.name.toLowerCase().includes(qn)) found.push(it);
    }
    if (!page.nextToken) break;
    token = page.nextToken;
  }
  return found;
}

async function presign(key) {
  if (!S3_BUCKET) throw new Error("bucket-not-configured");
  return await getSignedUrl(s3, new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }), { expiresIn: 60 });
}

// ========= API de dados =========
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
    const token  = req.query.token ? String(req.query.token) : null;
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

// ========= static (mantém seu layout) =========
const publicDir = path.join(__dirname, "public");
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir, {
    setHeaders(res, filePath) {
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

// ========= start =========
const PORT = Number(process.env.PORT || 10000);
http.createServer(app).listen(PORT, () => {
  console.log(`✅ Server up on ${PORT}`);
});
