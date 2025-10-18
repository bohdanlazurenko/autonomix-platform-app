import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import tasksRouter from "./routes/tasks.js";
import tenantsRouter from "./routes/tenants.js";
import healthRouter from "./routes/health.js";

// Load .env from project root (autonomix/)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');  // backend/src/../.. -> autonomix
console.log('[SERVER] Loading .env from:', join(projectRoot, '.env'));
const envResult = dotenv.config({ path: join(projectRoot, '.env') });
if (envResult.error) {
  console.error('[SERVER] Failed to load .env:', envResult.error);
} else {
  console.log('[SERVER] .env loaded successfully');
  console.log('[SERVER] GH_PAT:', process.env.GH_PAT ? 'SET ✅' : 'NOT SET ❌');
  console.log('[SERVER] VERCEL_TOKEN:', process.env.VERCEL_TOKEN ? 'SET ✅' : 'NOT SET ❌');
}

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api/", limiter);

// Routes
app.use("/health", healthRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/tenants", tenantsRouter);

// Error handling
app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(err.status || 500).json({
    error: {
      message: err.message || "Internal server error",
      status: err.status || 500,
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: "Not found",
      status: 404,
    },
  });
});

app.listen(PORT, () => {
  console.log(`🚀 AutonomiX Backend running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   API endpoint: http://localhost:${PORT}/api`);
});

export default app;
