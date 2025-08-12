// server.js — Loove API com Login (PIN + JWT) e rotas protegidas
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// ====== ENV ======
const {
  WASABI_REGION,
  WASABI_ENDPOINT,
  WASABI_ACCESS_KEY_ID,
  WASABI_SECRET_ACCESS_KEY,
  WASABI_BUCKET,
  PORT,
  ACCESS_PIN = "2468",            // defina em Environment do Render
  JWT_SECRET = "troque-isto"      // defina em Environment do Render
} = process.env;

// ====== S3 CLIENT (opcional; servidor sobe mesmo sem credenciais) ======
let s3 = null;
if (WASABI_ACCESS_KEY_ID && WASABI_SECRET_ACCESS_KEY && WASABI_ENDPOINT) {
  s3 = new S3Client({
    region: WASABI_REGION || "us-east-1",
    endpoint: WASABI_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: WASABI_ACCESS_KEY_ID,
      secretAccessKey: WASABI_SECRET_ACCESS_KEY
    }
  });
}

const PAGE_SIZE = 50;
const AUDIO_EXTS = [".mp3", ".m4a", ".aac", ".wav", ".flac", ".ogg"];
const isAudio = (key = "") => AUDIO_EXTS.some(ext => key.toLowerCase().endsWith(ext));
const cleanPrefix = (p = "") => p.replace(/^\/+/, "");

// ====== AUTH helpers ======
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
}

function auth(req, res, next) {
  try {
    const h = req.headers.authorization || "";
    const [type, token] = h.split(" ");
    if (type !== "Bearer" || !token) {
      return res.status(401).json({ error: "Token ausente" });
    }
    const data = jwt.verify(token, JWT_SECRET);
    req.user = data;
    next();
  } catch (e) {
    return res.status(401).json({ error: "Token inválido" });
  }
}

// ====== ROTAS PÚBLICAS ======
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "loove-api" });
});

// Login via PIN (env ACCESS_PIN). Retorna token JWT.
app.post("/api/login", (req, res) => {
  const pin = (req.body?.pin || "").toString().trim();
  if (!pin) return res.status(400).json({ error: "Informe o PIN" });
  if (pin !== ACCESS_PIN) return res.status(401).json({ error: "PIN inválido" });

  const token = signToken({ role: "user" });
  res.json({ token, expiresInSeconds: 7 * 24 * 3600 });
});

// Verificar token
app.get("/api/me", auth, (req, res) => {
  res.json({ ok: true, user: req.user });
});

// ====== ROTAS PROTEGIDAS (precisam de Authorization: Bearer <token>) ======
app.get("/api/folders", auth, async (req, res) => {
  try {
    if (!s3 || !WASABI_BUCKET) return res.json({ folders: [] });
    const prefix = cleanPrefix(req.query.prefix || "");
    const data = await s3.send(new ListObjectsV2Command({
      Bucket: WASABI_BUCKET,
      Prefix: prefix,
      Delimiter: "/",
      MaxKeys: PAGE_SIZE
    }));
    const folders = (data.CommonPrefixes || []).map(p => ({
      prefix: p.Prefix,
      name: p.Prefix.replace(prefix, "").replace(/\/$/, "")
    }));
    res.json({ folders });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao listar pastas" });
  }
});

app.get("/api/list", auth, async (req, res) => {
  try {
    if (!s3 || !WASABI_BUCKET) return res.json({ items: [], nextToken: null });
    const prefix = cleanPrefix(req.query.prefix || "");
    const token = req.query.token || undefined;

    const data = await s3.send(new ListObjectsV2Command({
      Bucket: WASABI_BUCKET,
      Prefix: prefix,
      ContinuationToken: token,
      MaxKeys: PAGE_SIZE
    }));

    const items = (data.Contents || [])
      .filter(o => isAudio(o.Key))
      .map(o => ({
        key: o.Key,
        name: o.Key.split("/").pop(),
        size: o.Size,
        lastModified: o.LastModified
      }));

    res.json({
      items,
      nextToken: data.IsTruncated ? data.NextContinuationToken : null
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao listar músicas" });
  }
});

app.get("/api/stream", auth, async (req, res) => {
  try {
    if (!s3 || !WASABI_BUCKET)
      return res.status(400).json({ error: "Wasabi não configurado" });

    const key = req.query.key;
    if (!key) return res.status(400).json({ error: "Parâmetro key obrigatório" });

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: WASABI_BUCKET, Key: key }),
      { expiresIn: 60 * 60 * 6 }
    );
    res.json({ url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro ao gerar URL de stream" });
  }
});

// Busca simples (scan limitado)
app.get("/api/search", auth, async (req, res) => {
  try {
    if (!s3 || !WASABI_BUCKET) return res.json({ items: [], scanned: 0 });
    const q = (req.query.q || "").toString().trim().toLowerCase();
    const prefix = cleanPrefix(req.query.prefix || "");
    if (q.length < 3) return res.status(400).json({ error: "Digite pelo menos 3 letras" });

    const maxScan = 2000;
    let scanned = 0;
    let token = undefined;
    const results = [];

    while (scanned < maxScan && results.length < 100) {
      const data = await s3.send(new ListObjectsV2Command({
        Bucket: WASABI_BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: PAGE_SIZE
      }));

      const contents = data.Contents || [];
      scanned += contents.length;

      for (const o of contents) {
        if (!isAudio(o.Key)) continue;
        const name = o.Key.split("/").pop();
        if (name && name.toLowerCase().includes(q)) {
          results.push({
            key: o.Key,
            name,
            size: o.Size,
            lastModified: o.LastModified
          });
          if (results.length >= 100) break;
        }
      }

      if (data.IsTruncated && results.length < 100 && scanned < maxScan) {
        token = data.NextContinuationToken;
      } else {
        break;
      }
    }
    res.json({ items: results, scanned });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Erro na busca" });
  }
});

// ====== FRONTEND ESTÁTICO EM /public ======
const publicDir = path.join(__dirname, "public");
app.use(express.static(publicDir));
app.get("*", (_req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

// ====== START ======
const listenPort = Number(PORT) || 3000; // Render injeta PORT
app.listen(listenPort, () => {
  console.log(`🚀 Loove API online na porta :${listenPort}`);
});
