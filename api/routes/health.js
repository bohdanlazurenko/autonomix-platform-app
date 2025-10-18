import express from "express";

const router = express.Router();

router.get("/", (req, res) => {
  const health = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: process.env.npm_package_version || "1.0.0",
    checks: {
      github: !!process.env.GH_PAT,
      vercel: !!process.env.VERCEL_TOKEN,
      cloudflare: !!process.env.CLOUDFLARE_API_TOKEN,
      llm: {
        pm: !!process.env.PM_MODEL_KEY,
        research: !!process.env.RESEARCH_MODEL_KEY,
        dev: !!process.env.DEV_MODEL_KEY,
      },
    },
  };

  res.json(health);
});

export default router;
