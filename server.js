// server.js (ESM) — mínimo e compatível com "type":"module"

import express from "express";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

/* ---------- middlewares opcionais (carregados só se existirem) ---------- */
async function maybeImport(name) {
  try { return await import(name); } catch { return null; }
}

const morgan = await maybeImport("morgan");
const corsMod = await maybeImport("cors");

if (morgan?.default) app.use(morgan.default("tiny"));
if (corsMod?.default) app.use(corsMod.default());

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

/* ---------- HEALTH (antes de static/catch-all) ---------- */
app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "loove-api",
    ts: new Date().toISOString(),
    node: process.version,
    uptime: process.uptime(),
  });
});
app.get("/api/health", (_req, res) => res.json({ ok: true }));

/* ---------- SUAS ROTAS DA API ---------- */
async function mountApi() {
  // Tenta ./routes/index.(js|cjs) e ./routes.(js|cjs)
  const candidates = [
    path.join(__dirname, "routes", "index.js"),
    path.join(__dirname, "routes", "index.cjs"),
    path.join(__dirname, "routes.js"),
    path.join(__dirname, "routes.cjs"),
  ];

  for (const abs of candidates) {
    try {
      if (!fs.existsSync(abs)) continue;
      const mod = await import(pathToFileURL(abs).href);
      const router = mod.default ?? mod.router ?? mod;
      if (typeof router === "function") {
        app.use("/api", router);
        return;
      }
    } catch {
      // tenta o próximo
    }
  }
  console.warn("[WARN] ./routes não encontrado — seguindo sem API custom.");
}
await mountApi();

/* ---------- STATIC (SPA) + CATCH-ALL ---------- */
const pubDir = path.join(__dirname, "public");
if (fs.existsSync(pubDir)) {
  app.use(express.static(pubDir));
  app.get("*", (_req, res) => res.sendFile(path.join(pubDir, "index.html")));
} else {
  app.get("*", (_req, res) => res.status(200).send("Loove API online"));
}

/* ---------- START ---------- */
app.listen(PORT, () => {
  console.log(`✅ Server up on ${PORT}`);
});
