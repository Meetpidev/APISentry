import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { testConnection } from "./src/config/db.js";
import apiRoutes from "./src/routes/index.js";
import { notFoundHandler, errorHandler } from "./src/middlewares/errorHandler.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.FRONTEND_ORIGIN || "*" }));
app.use(express.json());
app.use((req, _res, next) => {
  req.geminiApiKey = req.get("X-Gemini-API-Key")?.trim() || null;
  next();
});

app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/api", apiRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, async () => {
  console.log(`APISentry backend running on http://localhost:${PORT}`);
  try {
    await testConnection();
  } catch (err) {
    console.error("⚠️  Could not connect to Postgres:", err.message);
  }
});