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
app.get("/musicas", async (req, res) => {
  try {
    const data = await s3.send(new ListObjectsV2Command({
      Bucket: process.env.WASABI_BUCKET
    }));

    const files = await Promise.all(
      data.Contents.map(async (file) => {
        const url = await getSignedUrl(
          s3,
          new GetObjectCommand({
            Bucket: process.env.WASABI_BUCKET,
            Key: file.Key
          }),
          { expiresIn: 3600 }
        );
        return { nome: file.Key, url };
      })
    );

    res.json(files);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao buscar músicas" });
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

