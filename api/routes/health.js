import express from "express";
import { getZAIClient } from "../llm/zai-client.js";

const router = express.Router();

router.get("/", async (req, res) => {
  const llmClient = getZAIClient();
  let llmStatus = { enabled: false };
  
  if (llmClient.enabled) {
    llmStatus = await llmClient.healthCheck();
  }
  
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
        zai: llmStatus,
      },
    },
  };

  res.json(health);
});

export default router;
