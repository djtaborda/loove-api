// server.js — API + Health + (opcional) SPA
// Funciona no Render / Node 18+

import express from "express";
import path from "path";
import cors from "cors";
import compression from "compression";
import helmet from "helmet";
import morgan from "morgan";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const __dirname = path.resolve();

// ---------------------- CONFIG ----------------------
const PORT = process.env.PORT || 3000;

// Domínios permitidos para o front (CORS)
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ||
  "https://app.djafonso.com,https://djafonso.com")
  .split(",")
  .map(s => s.trim())
  .filter(Boolean);

// Se quiser que este serviço NÃO sirva a SPA, defina SERVE_STATIC=false
const SERVE_STATIC = String(process.env.SERVE_STATIC ?? "true") !== "false";

// ---------------------- MIDDLEWARES -----------------
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));
app.use(compression());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// Logs
app.use(morgan(process.env.NODE_ENV === "production" ? "tiny" : "dev"));

// CORS
app.use(
  cors({
    origin(origin, cb) {
      // Permite chamadas de ferramentas/server-side sem origin
      if (!origin) return cb(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error("CORS: origin not allowed: " + origin));
    },
    credentials: true,
  })
);

// ---------------------- HEALTH FIRST ----------------
// IMPORTANTE: /health precisa vir ANTES de static e do catch-all
app.get("/health", (req, res) => {
  res.type("application/json").send({
    ok: true,
    service: "loove-api",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    node: process.version,
  });
});

// Também disponível em /api/health (opcional)
app.get("/api/health", (req, res) => {
  res.type("application/json").send({ ok: true });
});

// ---------------------- ROTAS DA API ----------------
// Aqui montamos suas rotas reais. Se você já tem um router em ./routes,
// ele será carregado. Se não existir, apenas ignoramos para não quebrar.
try {
  // CommonJS: const apiRouter = require("./routes");
  // ESM default / named compat:
  const mod = await import("./routes/index.js").catch(async () => await import("./routes.js").catch(() => null));
  const apiRouter =
    mod?.default && typeof mod.default === "function" ? mod.default :
    typeof mod === "function" ? mod :
    null;

  if (apiRouter) {
    app.use("/api", apiRouter);
  } else {
    // Se não houver rotas, deixa um aviso e uma rota exemplo
    console.warn("[WARN] Não foi encontrado ./routes ou ./routes/index.js");
    app.get("/api/example", (req, res) => {
      res.json({ ok: true, message: "API placeholder. Monte suas rotas em /routes." });
    });
  }
} catch (e) {
  console.warn("[WARN] Falha ao carregar ./routes:", e?.message);
  app.get("/api/example", (req, res) => {
    res.json({ ok: true, message: "API placeholder. Monte suas rotas em /routes." });
  });
}

// ---------------------- SPA ESTÁTICA (opcional) -----
if (SERVE_STATIC) {
  // Sirva a pasta public (onde fica o index.html da SPA)
  app.use(express.static(path.join(__dirname, "public")));

  // Catch-all da SPA: deve ficar por ÚLTIMO de tudo
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
  });
}

// ---------------------- START -----------------------
app.listen(PORT, () => {
  console.log(`✅ Server up on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Static enabled: ${SERVE_STATIC}`);
  console.log(`   Allowed origins: ${ALLOWED_ORIGINS.join(", ")}`);
});
