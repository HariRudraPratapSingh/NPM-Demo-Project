import express from "express";
import path from "node:path";
import { promises as fs } from "node:fs";
import {
  startupGatekeeper,
  performEnvironmentAudit,
  syncEnvVariables,
  injectFault,
  restoreCleanEnv
} from "./gatekeeper.js";

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const cwd = process.cwd();

app.use(express.json());
app.use(express.static(path.resolve(cwd, "public")));

// Cache startup audit result
let initialAudit = null;

// Endpoint: General System Status
app.get("/api/status", (req, res) => {
  res.json({
    status: "online",
    service: "PreFlight Sentinel Service",
    uptimeSeconds: Math.floor(process.uptime()),
    nodeVersion: process.version,
    platform: process.platform,
    port: PORT,
    startupChecks: initialAudit?.summary || null
  });
});

// Endpoint: Run Real-Time Environment Audit
app.get("/api/audit", async (req, res) => {
  try {
    const audit = await performEnvironmentAudit({
      serverListening: true,
      activeServerPort: PORT
    });
    res.json(audit);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Auto-Sync .env with .env.example
app.post("/api/sync", async (req, res) => {
  try {
    const result = await syncEnvVariables();
    const freshAudit = await performEnvironmentAudit({
      serverListening: true,
      activeServerPort: PORT
    });
    res.json({ success: true, result, audit: freshAudit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Fault Injection Simulator
app.post("/api/fault/:type", async (req, res) => {
  try {
    const result = await injectFault(req.params.type);
    const freshAudit = await performEnvironmentAudit({
      serverListening: true,
      activeServerPort: PORT
    });
    res.json({ success: true, result, audit: freshAudit });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Endpoint: Restore Clean .env
app.post("/api/restore", async (req, res) => {
  try {
    const result = await restoreCleanEnv();
    const freshAudit = await performEnvironmentAudit({
      serverListening: true,
      activeServerPort: PORT
    });
    res.json({ success: true, result, audit: freshAudit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Read configuration files
app.get("/api/files", async (req, res) => {
  try {
    const envPath = path.resolve(cwd, ".env");
    const examplePath = path.resolve(cwd, ".env.example");
    const configPath = path.resolve(cwd, ".envcheck.json");

    const [envContent, exampleContent, configContent] = await Promise.all([
      fs.readFile(envPath, "utf-8").catch(() => ""),
      fs.readFile(examplePath, "utf-8").catch(() => ""),
      fs.readFile(configPath, "utf-8").catch(() => "")
    ]);

    res.json({
      env: envContent,
      example: exampleContent,
      config: configContent
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Endpoint: Save custom .env edits
app.post("/api/files/save", async (req, res) => {
  try {
    const { content } = req.body;
    if (typeof content !== "string") {
      return res.status(400).json({ error: "Content must be a string" });
    }
    const envPath = path.resolve(cwd, ".env");
    await fs.writeFile(envPath, content, "utf-8");

    const freshAudit = await performEnvironmentAudit({
      serverListening: true,
      activeServerPort: PORT
    });

    res.json({ success: true, audit: freshAudit });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Startup sequence
async function start() {
  try {
    // 1. Run gatekeeper verification
    initialAudit = await startupGatekeeper();

    // 2. Start HTTP server
    app.listen(PORT, () => {
      console.log(`\x1b[32m✔ PreFlight Sentinel Prototype listening on http://localhost:${PORT}\x1b[0m`);
      console.log(`\x1b[90m  Access the interactive web dashboard to test env-checker live.\x1b[0m\n`);
    });
  } catch (err) {
    console.error("\x1b[31m✖ Fatal error during pre-flight startup:\x1b[0m", err);
    process.exit(1);
  }
}

start();
