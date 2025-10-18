import express from "express";
import { deployForTenant } from "@autonomix/integration";

const router = express.Router();

// In-memory storage (for hackathon)
const tenants = new Map();

/**
 * Create a new tenant
 * POST /api/tenants
 */
router.post("/", async (req, res) => {
  try {
    const { id, name, subdomain } = req.body;

    if (!id) {
      return res.status(400).json({
        error: { message: "Missing required field: id" },
      });
    }

    if (tenants.has(id)) {
      return res.status(409).json({
        error: { message: "Tenant already exists" },
      });
    }

    const tenant = {
      id,
      name: name || id,
      subdomain: subdomain || `${id}.my-it-co.app`,
      createdAt: new Date().toISOString(),
      status: "active",
      quotas: {
        maxDeploys: parseInt(process.env.MAX_DEPLOYS_PER_TENANT || "5"),
        usedDeploys: 0,
      },
    };

    tenants.set(id, tenant);

    res.status(201).json(tenant);
  } catch (error) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * Get tenant details
 * GET /api/tenants/:id
 */
router.get("/:id", (req, res) => {
  const tenant = tenants.get(req.params.id);

  if (!tenant) {
    return res.status(404).json({
      error: { message: "Tenant not found" },
    });
  }

  res.json(tenant);
});

/**
 * Deploy application for tenant
 * POST /api/tenants/:id/deploy
 */
router.post("/:id/deploy", async (req, res) => {
  try {
    const tenantId = req.params.id;
    const { files } = req.body;

    const tenant = tenants.get(tenantId);
    if (!tenant) {
      return res.status(404).json({
        error: { message: "Tenant not found" },
      });
    }

    // Check quotas
    if (tenant.quotas.usedDeploys >= tenant.quotas.maxDeploys) {
      return res.status(429).json({
        error: { message: "Deployment quota exceeded" },
      });
    }

    if (!files || !Array.isArray(files)) {
      return res.status(400).json({
        error: { message: "Missing or invalid files array" },
      });
    }

    // Validate environment
    if (!process.env.GH_PAT || !process.env.VERCEL_TOKEN) {
      return res.status(500).json({
        error: { message: "Server not configured for deployments" },
      });
    }

    const deployConfig = {
      tenant: tenantId,
      files,
      ghOrg: process.env.GH_ORG || "autonomix",
      ghPat: process.env.GH_PAT,
      vercelToken: process.env.VERCEL_TOKEN,
      vercelOrgId: process.env.VERCEL_ORG_ID,
      cloudflareToken: process.env.CLOUDFLARE_API_TOKEN,
      cloudflareZoneId: process.env.CLOUDFLARE_ZONE_ID,
      baseDomain: process.env.CLOUDFLARE_DOMAIN,
    };

    // Deploy
    const result = await deployForTenant(deployConfig);

    // Update tenant
    tenant.quotas.usedDeploys++;
    tenant.lastDeployment = {
      ...result,
      deployedAt: new Date().toISOString(),
    };

    res.json({
      message: "Deployment successful",
      deployment: result,
      tenant: {
        id: tenant.id,
        quotas: tenant.quotas,
      },
    });
  } catch (error) {
    console.error("Deployment error:", error);
    res.status(500).json({
      error: {
        message: error.message || "Deployment failed",
      },
    });
  }
});

/**
 * List all tenants
 * GET /api/tenants
 */
router.get("/", (req, res) => {
  const allTenants = Array.from(tenants.values());
  res.json({
    tenants: allTenants,
    count: allTenants.length,
  });
});

export default router;
