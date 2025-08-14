// server.js  —  Loove API (ESM)  ✅
// -----------------------------------------------------------------------------
// Ambiente esperado (Render -> Variables):
// S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET
// (opcional) APP_PIN  -> PIN de login (padrão 2468)
// -----------------------------------------------------------------------------
// Este servidor:
// - Serve o front da pasta /public (index.html, assinaturas.html etc.)
// - API sem cache (apenas /api/*) e sem ETag
// - /health, /api/me, /api/login
// - /api/folders  (robusto para raiz/subpastas em Wasabi/S3)
// - /api/list     (arquivos imediatos de uma pasta)
// - /api/search   (busca simples dentro do prefix informado)
// - /api/stream   (presigned URL para tocar/baixar)
// -----------------------------------------------------------------------------

import express from "express";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// ---------- Paths util (ESM)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------- Config
const PORT = process.env.PORT || 10000;

const S3_ENDPOINT = process.env.S3_ENDPOINT || "";
const S3_REGION = process.env.S3_REGION || "us-east-1";
const S3_KEY = process.env.S3_ACCESS_KEY_ID || "";
const S3_SECRET = process.env.S3_SECRET_ACCESS_KEY || "";
const BUCKET = process.env.S3_BUCKET || process.env.BUCKET || "";
const APP_PIN = process.env.APP_PIN || "2468";

if (!BUCKET) {
  console.warn("[WARN] S3_BUCKET não definido — a API de arquivos não funcionará.");
}

// ---------- S3 Client
const s3 = new S3Client({
  region: S3_REGION,
  endpoint: S3_ENDPOINT || undefined,
  forcePathStyle: true, // bom para Wasabi/minio
  credentials: S3_KEY && S3_SECRET ? { accessKeyId: S3_KEY, secretAccessKey: S3_SECRET } : undefined,
});

// ---------- App
const app = express();

app.disable("x-powered-by");
app.disable("etag"); // desliga ETag global (evita 304 teimoso)

app.use(express.json({ limit: "1mb" }));

// CORS simples (libera seu app web e players externos, se precisar)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// 🔒 API SEM CACHE (somente /api/*) — pedido por você
app.use("/api", (req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.removeHeader("ETag");
  next();
});

// ---------- Health
app.get("/health", (req, res) => {
  res.json({
    ok: true,
    service: "loove-api",
    ts: new Date().toISOString(),
    node: process.version,
    uptime: process.uptime(),
  });
});

// ---------- Auth minimalista (compatível com seu front)
app.get("/api/me", (req, res) => {
  const auth = req.headers.authorization || "";
  if (!auth) return res.status(401).json({ error: "NO_TOKEN" });
  // não validamos JWT aqui – basta existir para o app logar
  res.json({ ok: true, user: { id: "user", plan: "free" } });
});

app.post("/api/login", (req, res) => {
  try {
    const pin = String(req.body?.pin || "");
    if (!pin) return res.status(400).json({ error: "PIN_REQUIRED" });
    if (pin !== APP_PIN) return res.status(401).json({ error: "PIN_INVALID" });

    // token simples (sem dependências) – o app só precisa de um valor
    const token = Buffer.from(`ok:${Date.now()}`).toString("base64");
    res.json({ token });
  } catch (e) {
    res.status(500).json({ error: "LOGIN_ERROR" });
  }
});

// ---------- Helpers S3
const ensureSlashEnd = (p = "") => (p && !p.endsWith("/") ? p + "/" : p);
const isDirKey = (k) => k.endsWith("/");

// /api/folders — lista pastas de primeiro nível do prefixo
app.get("/api/folders", async (req, res) => {
  try {
    const raw = (req.query.prefix || "").trim();
    const base = ensureSlashEnd(raw);
    const token = req.query.token || undefined;

    // 1) tentativa com Delimiter "/"
    let out = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: base || undefined,
        Delimiter: "/",
        ContinuationToken: token,
        MaxKeys: 1000,
      })
    );

    let prefixes = (out.CommonPrefixes || []).map((p) => p.Prefix);

    // 2) Fallback (Wasabi às vezes não retorna CommonPrefixes na raiz)
    if (prefixes.length === 0) {
      const out2 = await s3.send(
        new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: base || undefined,
          ContinuationToken: token,
          MaxKeys: 1000,
        })
      );

      const set = new Set();
      for (const obj of out2.Contents || []) {
        const k = obj.Key || "";
        const without = base ? k.slice(base.length) : k;
        const first = without.split("/")[0];
        if (first && without.includes("/")) {
          set.add((base || "") + first + "/");
        }
      }
      prefixes = [...set];
      out = out2; // paginar baseado no último result
    }

    const folders = prefixes
      .map((p) => ({
        prefix: p,
        name: p.slice(base.length).replace(/\/$/, ""),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      folders,
      nextToken: out.IsTruncated ? out.NextContinuationToken || null : null,
    });
  } catch (err) {
    console.error("folders error:", err);
    res.status(500).json({ error: "FOLDERS_LIST_ERROR", detail: String(err?.message || err) });
  }
});

// /api/list — lista arquivos (somente objetos) dentro do prefixo
app.get("/api/list", async (req, res) => {
  try {
    const prefix = (req.query.prefix || "").trim();
    const token = req.query.token || undefined;

    const out = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix || undefined,
        ContinuationToken: token,
        MaxKeys: 1000,
      })
    );

    const items = (out.Contents || [])
      .filter((o) => o.Key && !isDirKey(o.Key))
      .map((o) => ({
        key: o.Key,
        name: path.basename(o.Key),
        size: o.Size || 0,
        lastModified: o.LastModified ? new Date(o.LastModified).toISOString() : null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({
      items,
      nextToken: out.IsTruncated ? out.NextContinuationToken || null : null,
    });
  } catch (err) {
    console.error("list error:", err);
    res.status(500).json({ error: "LIST_ERROR", detail: String(err?.message || err) });
  }
});

// /api/search — busca simples dentro do prefix informado
app.get("/api/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    const prefix = (req.query.prefix || "").trim();
    if (!q) return res.json({ items: [] });

    // Limitamos a busca ao prefix informado para não varrer o bucket todo
    const out = await s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: prefix || undefined,
        MaxKeys: 1000,
      })
    );

    const Q = q.toLowerCase();
    const items = (out.Contents || [])
      .filter((o) => o.Key && !isDirKey(o.Key))
      .filter((o) => path.basename(o.Key).toLowerCase().includes(Q))
      .map((o) => ({
        key: o.Key,
        name: path.basename(o.Key),
      }));

    res.json({ items });
  } catch (err) {
    console.error("search error:", err);
    res.status(500).json({ error: "SEARCH_ERROR", detail: String(err?.message || err) });
  }
});

// /api/stream — URL assinada para tocar/baixar
app.get("/api/stream", async (req, res) => {
  try {
    const key = String(req.query.key || "").trim();
    if (!key) return res.status(400).json({ error: "KEY_REQUIRED" });

    const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
    const url = await getSignedUrl(s3, cmd, { expiresIn: 3600 }); // 1 hora

    res.json({ url });
  } catch (err) {
    console.error("stream error:", err);
    res.status(500).json({ error: "STREAM_ERROR", detail: String(err?.message || err) });
  }
});

// ---------- Static (FRONT)
// Servimos tudo que está em /public
const PUBLIC_DIR = path.join(__dirname, "public");
if (!fs.existsSync(PUBLIC_DIR)) {
  console.warn("[WARN] Pasta /public não encontrada — crie /public com seu front.");
}
app.use(express.static(PUBLIC_DIR, { extensions: ["html"] }));

// Raiz -> index.html
app.get("/", (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, "index.html"));
});

// ---------- 404 padrão (para APIs)
app.use("/api", (req, res) => res.status(404).json({ error: "NOT_FOUND" }));

// ---------- Start
app.listen(PORT, () => {
  console.log(`✅ Server up on ${PORT}`);
});
