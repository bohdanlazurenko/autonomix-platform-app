import express from "express";
import { v4 as uuidv4 } from "uuid";
import { getZAIClient } from "../llm/zai-client.js";

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
    console.log('[DEBUG] Environment variables:');
    console.log('  GH_PAT:', process.env.GH_PAT ? `SET (${process.env.GH_PAT.length} chars)` : 'NOT SET');
    console.log('  GH_ORG:', process.env.GH_ORG || 'NOT SET');
    console.log('  VERCEL_TOKEN:', process.env.VERCEL_TOKEN ? `SET (${process.env.VERCEL_TOKEN.length} chars)` : 'NOT SET');
    
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
  const businessName = extractBusinessName(prompt) || 'Generated App';
  
  // Try LLM generation first
  try {
    const llmClient = getZAIClient();
    
    if (llmClient.enabled) {
      console.log('[GENERATION] 🤖 Using Z.AI LLM for code generation...');
      const generatedCode = await llmClient.generateProjectCode(prompt, businessName);
      
      return [
        {
          path: "app/page.js",
          content: generatedCode,
        },
        {
          path: "package.json",
          content: JSON.stringify({
            name: (businessName || 'generated-app').toLowerCase().replace(/\s+/g, '-'),
            version: "0.1.0",
            private: true,
            scripts: {
              dev: "next dev",
              build: "next build",
              start: "next start",
            },
            dependencies: {
              react: "^18.2.0",
              "react-dom": "^18.2.0",
              next: "^14.0.4",
            },
          }, null, 2),
        },
        {
          path: "app/layout.js",
          content: `export const metadata = {
  title: '${businessName}',
  description: 'Generated by AutonomiX',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: 'system-ui, -apple-system, sans-serif' }}>
        {children}
      </body>
    </html>
  )
}`,
        },
      ];
    }
  } catch (error) {
    console.error('[GENERATION] ⚠️ LLM generation failed, falling back to templates:', error.message);
  }
  
  // Fallback: Smart template selection based on prompt keywords
  console.log('[GENERATION] 📋 Using template-based generation...');
  const promptLower = prompt.toLowerCase();
  
  // Detect project type
  const isCoffeeShop = promptLower.includes('coffee') || promptLower.includes('cafe');
  const isRestaurant = promptLower.includes('restaurant') || promptLower.includes('food');
  const isPortfolio = promptLower.includes('portfolio') || promptLower.includes('personal');
  const isEcommerce = promptLower.includes('shop') || promptLower.includes('store') || promptLower.includes('ecommerce');
  const hasMenu = promptLower.includes('menu');
  const hasContact = promptLower.includes('contact') || promptLower.includes('form');
  const hasGallery = promptLower.includes('gallery') || promptLower.includes('photos');
  
  // Generate appropriate content
  let mainContent = '';
  
  if (isCoffeeShop || isRestaurant) {
    mainContent = generateRestaurantApp(prompt, hasMenu, hasContact, hasGallery);
  } else if (isPortfolio) {
    mainContent = generatePortfolioApp(prompt, hasGallery, hasContact);
  } else if (isEcommerce) {
    mainContent = generateEcommerceApp(prompt);
  } else {
    mainContent = generateGenericLanding(prompt, hasContact, hasGallery);
  }
  
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
      content: mainContent
    },
    {
      path: 'pages/_app.js',
      content: `export default function App({ Component, pageProps }) {
  return <Component {...pageProps} />
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

## Deploy

This app is automatically deployed on Vercel.
`
    },
    {
      path: '.gitignore',
      content: 'node_modules\n.next\nout\n.env*.local\n.DS_Store'
    }
  ];
}

/**
 * Generate restaurant/coffee shop app
 */
function generateRestaurantApp(prompt, hasMenu, hasContact, hasGallery) {
  const businessName = extractBusinessName(prompt) || 'Our Coffee Shop';
  
  return `import { useState } from 'react';

export default function CoffeeShop() {
  const [showMenu, setShowMenu] = useState(false);
  
  const menuItems = [
    { name: 'Espresso', price: '$3.50', desc: 'Rich and bold' },
    { name: 'Cappuccino', price: '$4.50', desc: 'Creamy and smooth' },
    { name: 'Latte', price: '$4.75', desc: 'Silky milk foam' },
    { name: 'Americano', price: '$3.75', desc: 'Strong and pure' },
    { name: 'Mocha', price: '$5.00', desc: 'Chocolate delight' },
    { name: 'Cold Brew', price: '$4.25', desc: 'Smooth and refreshing' },
  ];

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Hero Section */}
      <header style={{
        background: 'linear-gradient(135deg, #6B4423 0%, #3E2723 100%)',
        color: 'white',
        padding: '80px 20px',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '3.5rem', marginBottom: '20px', fontWeight: '700' }}>
          ☕ ${businessName}
        </h1>
        <p style={{ fontSize: '1.3rem', opacity: 0.9, marginBottom: '30px' }}>
          ${prompt}
        </p>
        <button onClick={() => setShowMenu(!showMenu)} style={{
          background: '#FF6B35',
          color: 'white',
          border: 'none',
          padding: '15px 40px',
          fontSize: '1.1rem',
          borderRadius: '30px',
          cursor: 'pointer',
          fontWeight: '600',
          boxShadow: '0 4px 15px rgba(255,107,53,0.3)',
          transition: 'transform 0.2s'
        }}>
          View Menu
        </button>
      </header>

      ${hasMenu ? `
      {/* Menu Section */}
      {showMenu && (
        <section style={{ padding: '60px 20px', maxWidth: '1200px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: '2.5rem', marginBottom: '40px', color: '#3E2723' }}>
            Our Menu
          </h2>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', 
            gap: '30px' 
          }}>
            {menuItems.map((item, i) => (
              <div key={i} style={{
                background: 'white',
                padding: '30px',
                borderRadius: '15px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                transition: 'transform 0.3s',
                cursor: 'pointer'
              }}
              onMouseOver={e => e.currentTarget.style.transform = 'translateY(-5px)'}
              onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <h3 style={{ fontSize: '1.5rem', marginBottom: '10px', color: '#6B4423' }}>
                  {item.name}
                </h3>
                <p style={{ color: '#666', marginBottom: '10px' }}>{item.desc}</p>
                <p style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#FF6B35' }}>
                  {item.price}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
      ` : ''}

      ${hasGallery ? `
      {/* Gallery Section */}
      <section style={{ padding: '60px 20px', background: '#f5f5f5' }}>
        <h2 style={{ textAlign: 'center', fontSize: '2.5rem', marginBottom: '40px', color: '#3E2723' }}>
          Gallery
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', maxWidth: '1200px', margin: '0 auto' }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ 
              background: \`linear-gradient(135deg, \${i % 2 ? '#6B4423' : '#FF6B35'} 0%, \${i % 2 ? '#3E2723' : '#D84315'} 100%)\`,
              height: '250px',
              borderRadius: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '2rem'
            }}>
              📷
            </div>
          ))}
        </div>
      </section>
      ` : ''}

      ${hasContact ? `
      {/* Contact Section */}
      <section style={{ padding: '60px 20px', maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '2.5rem', marginBottom: '40px', color: '#3E2723' }}>
          Contact Us
        </h2>
        <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <input 
            type="text" 
            placeholder="Your Name" 
            style={{ padding: '15px', fontSize: '1rem', border: '2px solid #ddd', borderRadius: '10px' }}
          />
          <input 
            type="email" 
            placeholder="Your Email" 
            style={{ padding: '15px', fontSize: '1rem', border: '2px solid #ddd', borderRadius: '10px' }}
          />
          <textarea 
            placeholder="Your Message" 
            rows="5"
            style={{ padding: '15px', fontSize: '1rem', border: '2px solid #ddd', borderRadius: '10px', resize: 'vertical' }}
          />
          <button type="submit" style={{
            background: '#6B4423',
            color: 'white',
            border: 'none',
            padding: '15px',
            fontSize: '1.1rem',
            borderRadius: '10px',
            cursor: 'pointer',
            fontWeight: '600',
            transition: 'background 0.3s'
          }}>
            Send Message
          </button>
        </form>
      </section>
      ` : ''}

      {/* Footer */}
      <footer style={{ 
        background: '#3E2723', 
        color: 'white', 
        padding: '40px 20px', 
        textAlign: 'center' 
      }}>
        <p style={{ fontSize: '1.1rem', marginBottom: '10px' }}>
          © 2025 ${businessName}. Generated by AutonomiX.
        </p>
        <p style={{ opacity: 0.7 }}>
          📍 Visit us today | ☎️ Call us | 📧 Email us
        </p>
      </footer>
    </div>
  );
}`;
}

/**
 * Generate portfolio app
 */
function generatePortfolioApp(prompt, hasGallery, hasContact) {
  return `export default function Portfolio() {
  const projects = [
    { title: 'Project Alpha', desc: 'Modern web application', tech: 'React, Node.js' },
    { title: 'Project Beta', desc: 'Mobile app design', tech: 'React Native' },
    { title: 'Project Gamma', desc: 'E-commerce platform', tech: 'Next.js, Stripe' },
  ];

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      <header style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '100px 20px',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '20px' }}>👋 Portfolio</h1>
        <p style={{ fontSize: '1.3rem', opacity: 0.9 }}>${prompt}</p>
      </header>

      <section style={{ padding: '60px 20px', maxWidth: '1200px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '2.5rem', marginBottom: '40px' }}>
          Featured Projects
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
          {projects.map((proj, i) => (
            <div key={i} style={{
              background: 'white',
              padding: '30px',
              borderRadius: '15px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ fontSize: '1.5rem', marginBottom: '10px', color: '#667eea' }}>
                {proj.title}
              </h3>
              <p style={{ color: '#666', marginBottom: '10px' }}>{proj.desc}</p>
              <p style={{ fontSize: '0.9rem', color: '#999' }}>{proj.tech}</p>
            </div>
          ))}
        </div>
      </section>

      ${hasContact ? `
      <section style={{ padding: '60px 20px', background: '#f5f5f5' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: '2.5rem', marginBottom: '40px' }}>
            Get In Touch
          </h2>
          <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <input type="text" placeholder="Name" style={{ padding: '15px', fontSize: '1rem', border: '2px solid #ddd', borderRadius: '10px' }} />
            <input type="email" placeholder="Email" style={{ padding: '15px', fontSize: '1rem', border: '2px solid #ddd', borderRadius: '10px' }} />
            <textarea placeholder="Message" rows="5" style={{ padding: '15px', fontSize: '1rem', border: '2px solid #ddd', borderRadius: '10px' }} />
            <button type="submit" style={{
              background: '#667eea',
              color: 'white',
              border: 'none',
              padding: '15px',
              fontSize: '1.1rem',
              borderRadius: '10px',
              cursor: 'pointer'
            }}>Send</button>
          </form>
        </div>
      </section>
      ` : ''}
    </div>
  );
}`;
}

/**
 * Generate e-commerce app
 */
function generateEcommerceApp(prompt) {
  return `export default function Shop() {
  const products = [
    { name: 'Product 1', price: '$29.99', image: '🎁' },
    { name: 'Product 2', price: '$39.99', image: '📦' },
    { name: 'Product 3', price: '$49.99', image: '🛍️' },
    { name: 'Product 4', price: '$59.99', image: '🎉' },
  ];

  return (
    <div style={{ fontFamily: 'system-ui' }}>
      <header style={{
        background: '#2c3e50',
        color: 'white',
        padding: '60px 20px',
        textAlign: 'center'
      }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '15px' }}>🛒 Shop</h1>
        <p style={{ fontSize: '1.2rem' }}>${prompt}</p>
      </header>

      <section style={{ padding: '60px 20px', maxWidth: '1200px', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '30px' }}>
          {products.map((prod, i) => (
            <div key={i} style={{
              background: 'white',
              padding: '30px',
              borderRadius: '15px',
              boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '4rem', marginBottom: '15px' }}>{prod.image}</div>
              <h3 style={{ fontSize: '1.3rem', marginBottom: '10px' }}>{prod.name}</h3>
              <p style={{ fontSize: '1.5rem', color: '#27ae60', fontWeight: 'bold' }}>{prod.price}</p>
              <button style={{
                background: '#27ae60',
                color: 'white',
                border: 'none',
                padding: '12px 30px',
                borderRadius: '25px',
                cursor: 'pointer',
                marginTop: '15px',
                fontSize: '1rem'
              }}>Add to Cart</button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}`;
}

/**
 * Generate generic landing page
 */
function generateGenericLanding(prompt, hasContact, hasGallery) {
  return `export default function Landing() {
  return (
    <div style={{ fontFamily: 'system-ui' }}>
      <header style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        padding: '100px 20px',
        textAlign: 'center',
        minHeight: '60vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <h1 style={{ fontSize: '3.5rem', marginBottom: '20px', fontWeight: '700' }}>
          Welcome! 🚀
        </h1>
        <p style={{ fontSize: '1.3rem', maxWidth: '600px', lineHeight: '1.6' }}>
          ${prompt}
        </p>
        <button style={{
          background: 'white',
          color: '#667eea',
          border: 'none',
          padding: '15px 40px',
          fontSize: '1.1rem',
          borderRadius: '30px',
          cursor: 'pointer',
          marginTop: '30px',
          fontWeight: '600',
          boxShadow: '0 4px 15px rgba(0,0,0,0.2)'
        }}>
          Get Started
        </button>
      </header>

      <section style={{ padding: '80px 20px', textAlign: 'center', maxWidth: '1000px', margin: '0 auto' }}>
        <h2 style={{ fontSize: '2.5rem', marginBottom: '40px', color: '#333' }}>Features</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '40px' }}>
          <div>
            <div style={{ fontSize: '3rem', marginBottom: '15px' }}>⚡</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>Fast</h3>
            <p style={{ color: '#666' }}>Lightning-fast performance</p>
          </div>
          <div>
            <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🎨</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>Beautiful</h3>
            <p style={{ color: '#666' }}>Modern and elegant design</p>
          </div>
          <div>
            <div style={{ fontSize: '3rem', marginBottom: '15px' }}>🔒</div>
            <h3 style={{ fontSize: '1.5rem', marginBottom: '10px' }}>Secure</h3>
            <p style={{ color: '#666' }}>Protected and safe</p>
          </div>
        </div>
      </section>

      ${hasContact ? `
      <section style={{ padding: '60px 20px', background: '#f8f9fa' }}>
        <div style={{ maxWidth: '600px', margin: '0 auto' }}>
          <h2 style={{ textAlign: 'center', fontSize: '2.5rem', marginBottom: '40px' }}>Contact</h2>
          <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <input type="text" placeholder="Name" style={{ padding: '15px', fontSize: '1rem', border: '2px solid #ddd', borderRadius: '10px' }} />
            <input type="email" placeholder="Email" style={{ padding: '15px', fontSize: '1rem', border: '2px solid #ddd', borderRadius: '10px' }} />
            <textarea placeholder="Message" rows="5" style={{ padding: '15px', fontSize: '1rem', border: '2px solid #ddd', borderRadius: '10px' }} />
            <button style={{
              background: '#667eea',
              color: 'white',
              border: 'none',
              padding: '15px',
              fontSize: '1.1rem',
              borderRadius: '10px',
              cursor: 'pointer'
            }}>Send</button>
          </form>
        </div>
      </section>
      ` : ''}

      <footer style={{ background: '#2c3e50', color: 'white', padding: '40px 20px', textAlign: 'center' }}>
        <p>© 2025 Generated by AutonomiX</p>
      </footer>
    </div>
  );
}`;
}

/**
 * Extract business name from prompt
 */
function extractBusinessName(prompt) {
  // Simple extraction - look for words after "for", "of", etc.
  const match = prompt.match(/(?:for|of)\s+(?:a\s+)?([A-Z][a-zA-Z\s]+)/);
  return match ? match[1].trim() : null;
}

function simulateDelay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default router;
