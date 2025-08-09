// server.js (ESM)

import express from "express";
import cors from "cors";
import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// -------- CORS (liberado; ajuste se quiser restringir) --------
app.use(
  cors({
    origin: "*",
  })
);

// =============== Wasabi S3 ===============
const s3 = new S3Client({
  region: process.env.WASABI_REGION,
  endpoint: process.env.WASABI_ENDPOINT,
  credentials: {
    accessKeyId: process.env.WASABI_KEY,
    secretAccessKey: process.env.WASABI_SECRET,
  },
});

// =============== Helpers ===============
const stripExt = (name) =>
  name.replace(/\.(mp3|m4a|aac|wav|flac)$/i, "").replace(/[_]+/g, " ").trim();

const parseTitle = (raw) => {
  const clean = stripExt(raw);
  const parts = clean.split(" - ");
  const artist = (parts[0] || "").trim();
  const song = (parts.slice(1).join(" - ") || "").trim(); // preserva hifens internos
  const title = song ? `${artist} - ${song}` : clean;
  return { artist, song, title };
};

const signUrl = async (key, seconds = 180) =>
  getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: key }),
    { expiresIn: seconds }
  );

// =============== ROTAS ===============

/**
 * GET /tracks
 * Lista músicas de uma pasta (Prefix) específica e gera URLs temporárias.
 *
 * Query:
 *  - prefix: ex. "ACADEMIA/" (com a barra no final)
 *  - limit: máx. 200 (default 50)
 *  - token: paginação do S3 (NextContinuationToken)
 *  - q: filtro simples por título/arquivo
 *
 * Retorno:
 *  { items: [{ key, title, artist, song, url }], nextToken }
 */
app.get("/tracks", async (req, res) => {
  try {
    const prefix = (req.query.prefix || "").toString(); // ex: "ACADEMIA/"
    const limit = Math.min(Math.max(parseInt(req.query.limit || "50"), 1), 200);
    const token = req.query.token ? req.query.token.toString() : undefined;
    const q = (req.query.q || "").toString().toLowerCase().trim();

    const data = await s3.send(
      new ListObjectsV2Command({
        Bucket: process.env.WASABI_BUCKET,
        Prefix: prefix,
        ContinuationToken: token,
        MaxKeys: limit,
      })
    );

    const all = (data.Contents || [])
      .filter((o) => o.Key && !o.Key.endsWith("/"))
      .map((file) => {
        const key = file.Key;
        const fileName = key.split("/").pop() || key;
        const { title, artist, song } = parseTitle(fileName);
        return { key, fileName, title, artist, song };
      });

    const filtered = q
      ? all.filter(
          (i) =>
            i.fileName.toLowerCase().includes(q) ||
            i.title.toLowerCase().includes(q) ||
            i.artist.toLowerCase().includes(q) ||
            i.song.toLowerCase().includes(q)
        )
      : all;

    // URLs assinadas (3 minutos) — suficiente para tocar
    const items = await Promise.all(
      filtered.map(async ({ key, title, artist, song }) => {
        const url = await signUrl(key, 180);
        return { key, title, artist, song, url };
      })
    );

    res.json({
      items,
      nextToken: data.IsTruncated ? data.NextContinuationToken : null,
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "list_failed" });
  }
});

/**
 * GET /search
 * Busca global no bucket inteiro (todas as pastas), respeitando o padrão "Artista - Música.ext".
 *
 * Query:
 *  - q: termo de busca (obrigatório; mínimo recomendado 2 letras)
 *  - limit: máx. 100 (default 50)
 *  - token: paginação (ContinuationToken)
 *
 * Retorno:
 *  { items: [{ key, title, artist, song, url }], nextToken }
 */
app.get("/search", async (req, res) => {
  try {
    const q = (req.query.q || "").toString().toLowerCase().trim();
    if (!q) return res.json({ items: [], nextToken: null });

    const limit = Math.min(Math.max(parseInt(req.query.limit || "50"), 1), 100);
    let token = req.query.token ? req.query.token.toString() : undefined;

    const pageSize = 1000; // quantos objetos pedimos por vez ao Wasabi
    const results = [];
    let nextTokenToReturn = null;

    while (results.length < limit) {
      const data = await s3.send(
        new ListObjectsV2Command({
          Bucket: process.env.WASABI_BUCKET,
          // Sem Prefix: varre toda a RAIZ + subpastas (playlistdj/…)
          ContinuationToken: token,
          MaxKeys: pageSize,
        })
      );

      const page = (data.Contents || [])
        .filter((o) => o.Key && !o.Key.endsWith("/"))
        .map((o) => {
          const key = o.Key;
          const fileName = key.split("/").pop() || key;
          const { title, artist, song } = parseTitle(fileName);
          return { key, fileName, title, artist, song };
        })
        .filter(
          (i) =>
            i.fileName.toLowerCase().includes(q) ||
            i.title.toLowerCase().includes(q) ||
            i.artist.toLowerCase().includes(q) ||
            i.song.toLowerCase().includes(q)
        );

      for (const hit of page) {
        if (results.length >= limit) break;
        const url = await signUrl(hit.key, 180);
        results.push({
          key: hit.key,
          title: hit.title,
          artist: hit.artist,
          song: hit.song,
          url,
        });
      }

      if (results.length >= limit) {
        nextTokenToReturn = data.IsTruncated ? data.NextContinuationToken : null;
        break;
      }

      if (!data.IsTruncated) {
        nextTokenToReturn = null;
        break;
      }

      token = data.NextContinuationToken;
    }

    res.json({ items: results, nextToken: nextTokenToReturn });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "search_failed" });
  }
});

/**
 * POST /stream/:key
 * Recebe a key (URL-encoded) e devolve uma URL assinada (5 min) para streaming.
 * Use quando quiser reforçar segurança antes de tocar.
 */
app.post("/stream/:key", async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const url = await signUrl(key, 300);
    res.json({ url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "sign_failed" });
  }
});

// -------- Health check --------
app.get("/", (req, res) => {
  res.json({ ok: true, service: "loove-api", ts: new Date().toISOString() });
});

// -------- 404 & erro genérico (opcional) --------
app.use((req, res) => res.status(404).json({ error: "not_found" }));

// Inicializa servidor
const port = process.env.PORT || 3001;
app.listen(port, "0.0.0.0", () => {
  console.log(`API rodando na porta ${port}`);
});


