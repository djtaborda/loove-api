// server.js — Loove API (Render fix: usa /public em vez de client/dist)
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
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
  PORT
} = process.env;

// ====== S3 CLIENT (opcional para testes locais; app sobe mesmo sem Wasabi) ======
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

// ====== API BÁSICA ======
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "loove-api" });
});

// lista pastas (funciona quando Wasabi estiver configurado)
app.get("/api/folders", async (req, res) => {
  try {
    if (!s3 || !WASABI_BUCKET) return res.json({ folders: [] });
    const prefix = (req.query.prefix || "").toString().replace(/^\/+/, "");
    const data = await s3.send(new ListObjectsV2Command({
      Bucket: WASABI_BUCKET,
      Prefix: prefix,
      Delimiter: "/",
      MaxKeys: 50
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

// lista músicas (com paginação)
app.get("/api/list", async (req, res) => {
  try {
    if (!s3 || !WASABI_BUCKET) return res.json({ items: [], nextToken: null });
    const prefix = (req.query.prefix || "").toString().replace(/^\/+/, "");
    const token = req.query.token || undefined;
    const cmd = new ListObjectsV2Command({
      Bucket: WASABI_BUCKET,
      Prefix: prefix,
      ContinuationToken: token,
      MaxKeys: 50
    });
    const data = await s3.send(cmd);
    const audioExts = [".mp3", ".m4a", ".aac", ".wav", ".flac", ".ogg"];
    const isAudio = k => audioExts.some(ext => k.toLowerCase().endsWith(ext));

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

// assina URL de stream
app.get("/api/stream", async (req, res) => {
  try {
    if (!s3 || !WASABI_BUCKET) return res.status(400).json({ error: "Wasabi não configurado" });
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
