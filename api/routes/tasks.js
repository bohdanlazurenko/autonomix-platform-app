import express from "express";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

// In-memory storage (for hackathon, replace with DB)
const tasks = new Map();

/**
 * Create a new task
 * POST /api/tasks
 */
router.post("/", async (req, res) => {
  try {
    const { prompt, tenant } = req.body;

    if (!prompt || !tenant) {
      return res.status(400).json({
        error: { message: "Missing required fields: prompt, tenant" },
      });
    }

    const taskId = uuidv4();
    const task = {
      id: taskId,
      tenant,
      prompt,
      status: "pending",
      createdAt: new Date().toISOString(),
      steps: [],
    };

    tasks.set(taskId, task);

    // Trigger async processing (in real scenario)
    processTask(taskId).catch((err) => {
      console.error(`Task ${taskId} processing error:`, err);
      const t = tasks.get(taskId);
      if (t) {
        t.status = "failed";
        t.error = err.message;
      }
    });

    res.status(201).json({
      taskId,
      status: task.status,
      message: "Task created and processing started",
    });
  } catch (error) {
    res.status(500).json({ error: { message: error.message } });
  }
});

/**
 * Get task status
 * GET /api/tasks/:id
 */
router.get("/:id", (req, res) => {
  const task = tasks.get(req.params.id);

  if (!task) {
    return res.status(404).json({
      error: { message: "Task not found" },
    });
  }

  res.json(task);
});

/**
 * List all tasks (for debugging)
 * GET /api/tasks
 */
router.get("/", (req, res) => {
  const allTasks = Array.from(tasks.values());
  res.json({
    tasks: allTasks,
    count: allTasks.length,
  });
});

/**
 * Async task processing with REAL deployment
 */
async function processTask(taskId) {
  const task = tasks.get(taskId);
  if (!task) return;

  try {
    // Import deployment function
    const { deployForTenant } = await import('@autonomix/integration');
    
    // Step 1: PM Analysis
    task.status = "pm_analysis";
    task.steps.push({
      name: "PM Analysis",
      status: "in_progress",
      startedAt: new Date().toISOString(),
    });
    await simulateDelay(1000);
    task.steps[task.steps.length - 1].status = "completed";
    task.steps[task.steps.length - 1].completedAt = new Date().toISOString();

    // Step 2: Research
    task.status = "research";
    task.steps.push({
      name: "Research",
      status: "in_progress",
      startedAt: new Date().toISOString(),
    });
    await simulateDelay(1000);
    task.steps[task.steps.length - 1].status = "completed";
    task.steps[task.steps.length - 1].completedAt = new Date().toISOString();

    // Step 3: Development - Generate code with AI
    task.status = "development";
    task.steps.push({
      name: "Development",
      status: "in_progress",
      startedAt: new Date().toISOString(),
    });
    
    // Generate files based on prompt
    const files = await generateProjectFiles(task.prompt);
    task.generatedFiles = files;
    
    task.steps[task.steps.length - 1].status = "completed";
    task.steps[task.steps.length - 1].completedAt = new Date().toISOString();

    // Step 4: Real Deployment to GitHub + Vercel
    task.status = "deploying";
    task.steps.push({
      name: "Deployment",
      status: "in_progress",
      startedAt: new Date().toISOString(),
    });
    
    // Deploy with real integration
    const deployResult = await deployForTenant({
      tenant: task.tenant,
      files: files,
      ghOrg: process.env.GH_ORG || 'bohdanlazurenko',
      ghPat: process.env.GH_PAT,
      vercelToken: process.env.VERCEL_TOKEN,
      vercelOrgId: process.env.VERCEL_ORG_ID,
    });
    
    task.steps[task.steps.length - 1].status = "completed";
    task.steps[task.steps.length - 1].completedAt = new Date().toISOString();

    task.status = "completed";
    task.completedAt = new Date().toISOString();
    task.result = {
      repoUrl: deployResult.repoUrl,
      deployUrl: deployResult.deployUrl,
    };
  } catch (error) {
    console.error(`Task ${taskId} failed:`, error);
    task.status = "failed";
    task.error = error.message;
  }
}

/**
 * Generate project files using AI or templates
 */
async function generateProjectFiles(prompt) {
  // For now, return a working Next.js template
  // TODO: Integrate with OpenAI/Z.AI for real code generation
  
  return [
    {
      path: 'package.json',
      content: JSON.stringify({
        name: 'generated-app',
        version: '1.0.0',
        private: true,
        scripts: {
          dev: 'next dev',
          build: 'next build',
          start: 'next start'
        },
        dependencies: {
          next: '14.0.4',
          react: '^18.2.0',
          'react-dom': '^18.2.0'
        }
      }, null, 2)
    },
    {
      path: 'pages/index.js',
      content: `export default function Home() {
  return (
    <div style={{ 
      fontFamily: 'system-ui',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'white',
      padding: '20px'
    }}>
      <div style={{ textAlign: 'center', maxWidth: '600px' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '20px' }}>
          🚀 Generated App
        </h1>
        <p style={{ fontSize: '1.2rem', marginBottom: '20px' }}>
          Task: ${prompt.replace(/"/g, '\\"')}
        </p>
        <p style={{ opacity: 0.8 }}>
          Created automatically by AutonomiX
        </p>
      </div>
    </div>
  );
}`
    },
    {
      path: 'README.md',
      content: `# Generated Application

Created by AutonomiX based on: "${prompt}"

## Run locally

\`\`\`bash
npm install
npm run dev
\`\`\`
`
    },
    {
      path: '.gitignore',
      content: 'node_modules\n.next\nout\n.env*.local'
    }
  ];
}

function simulateDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default router;
