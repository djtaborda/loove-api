import express from "express";
import cors from "cors";
import { S3Client, ListObjectsV2Command, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());

// Configuração do Wasabi S3
const s3 = new S3Client({
  region: process.env.WASABI_REGION,
  endpoint: process.env.WASABI_ENDPOINT,
  credentials: {
    accessKeyId: process.env.WASABI_KEY,
    secretAccessKey: process.env.WASABI_SECRET
  }
});

// Rota para listar músicas e gerar URLs temporárias
app.get('/tracks', async (req, res) => {
  try {
    const prefix = (req.query.prefix || '').toString();         // ex: "ACADEMIA/"
    const limit  = Math.min(parseInt(req.query.limit || '50'), 200);
    const token  = req.query.token ? req.query.token.toString() : undefined;
    const q      = (req.query.q || '').toString().toLowerCase();

    const data = await s3.send(new ListObjectsV2Command({
      Bucket: process.env.WASABI_BUCKET,
      Prefix: prefix,
      ContinuationToken: token,
      MaxKeys: limit,
    }));

    const all = (data.Contents || [])
      .filter(o => o.Key && !o.Key.endsWith('/'))
      .map(file => {
        const key = file.Key;
        const fileName = key.split('/').pop() || key;
        const title = fileName
          .replace(/\.(mp3|m4a|aac|wav|flac)$/i, '')
          .replace(/[_]+/g, ' ')
          .trim();
        return { key, title };
      });

    const filtered = q ? all.filter(i => i.title.toLowerCase().includes(q)) : all;

    // gera URL assinada curta (3 min) — suficiente para tocar
    const items = await Promise.all(filtered.map(async ({ key, title }) => {
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: key }),
        { expiresIn: 180 }
      );
      return { key, title, url };
    }));

    res.json({
      items,
      nextToken: data.IsTruncated ? data.NextContinuationToken : null
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'list_failed' });
  }
});
// POST /stream/:key (key URL-encoded)
app.post('/stream/:key', async (req, res) => {
  try {
    const key = decodeURIComponent(req.params.key);
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: process.env.WASABI_BUCKET, Key: key }),
      { expiresIn: 300 }
    );
    res.json({ url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'sign_failed' });
  }
});


// Rota de teste
app.get("/", (req, res) => {
  res.json({ ok: true, service: "loove-api", ts: new Date().toISOString() });
});

// Inicializa servidor
const port = process.env.PORT || 3001;
app.listen(port, "0.0.0.0", () => {
  console.log(`API rodando na porta ${port}`);
});

