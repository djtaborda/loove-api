// server.js — mínimo, sem dependências obrigatórias além de express (CommonJS)

const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();

// Use SEMPRE a porta do Render (não defina PORT manualmente no painel).
const PORT = process.env.PORT || 3000;

// ---------- middlewares opcionais (se existirem) ----------
function tryRequire(name, fallback) {
  try { return require(name); } catch { return fallback; }
}

const morgan = tryRequire("morgan", () => (req, res, next) => next());
const corsLib = tryRequire("cors", () => () => (req, res, next) => next());

app.use(morgan("tiny"));
app.use(corsLib());
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));

// ---------- HEALTH FIRST (antes de static/catch-all) ----------
app.get("/health", (_req, res) => {
  res.status(200).json({
    ok: true,
    service: "loove-api",
    ts: new Date().toISOString(),
    node: process.version,
    uptime: process.uptime(),
  });
});

// Alias opcional
app.get("/api/health", (_req, res) => res.json({ ok: true }));

// ---------- SUAS ROTAS DA API ----------
(function mountApi() {
  // Tenta ./routes (CommonJS) ou ./routes/index.js (default export)
  try {
    const api = require("./routes");
    if (typeof api === "function") app.use("/api", api);
    else if (api && typeof api.default === "function") app.use("/api", api.default);
  } catch {
    try {
      const api2 = require("./routes/index");
      if (typeof api2 === "function") app.use("/api", api2);
      else if (api2 && typeof api2.default === "function") app.use("/api", api2.default);
    } catch {
      console.warn("[WARN] ./routes não encontrado — seguindo sem API custom.");
    }
  }
})();

// ---------- STATIC (SPA) + CATCH-ALL ----------
const pubDir = path.join(__dirname, "public");
if (fs.existsSync(pubDir)) {
  app.use(express.static(pubDir));
  app.get("*", (_req, res) => res.sendFile(path.join(pubDir, "index.html")));
} else {
  // fallback simples se não houver /public
  app.get("*", (_req, res) => res.status(200).send("Loove API online"));
}

// ---------- START ----------
app.listen(PORT, () => {
  console.log(`✅ Server up on ${PORT}`);
});
