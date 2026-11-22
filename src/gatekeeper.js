import path from "node:path";
import { promises as fs } from "node:fs";
import {
  loadConfig,
  checkNodeVersion,
  checkPackageManagerRequirement,
  checkBinaryRequirement,
  checkPortRequirement,
  readEnvFile,
  validateEnvVariables,
  runSyncCommand
} from "env-checker";

const cwd = process.cwd();

/**
 * Performs a comprehensive programmatic audit of the environment
 * using the 'env-checker' package.
 */
export async function performEnvironmentAudit(options = {}) {
  const startTime = Date.now();
  const { config } = await loadConfig(options.configPath, cwd);
  const checks = [];

  // 1. Check Node Runtime
  checks.push(checkNodeVersion(config.node));

  // 2. Check Package Manager
  if (config.packageManager) {
    const pmItem = checkPackageManagerRequirement(config.packageManager);
    if (pmItem) checks.push(pmItem);
  }

  // 3. Check Environment Variables
  const envFile = options.envFile || config.env?.files?.[0] || ".env";
  const exampleFile = options.exampleFile || config.env?.exampleFiles?.[0] || ".env.example";

  const actualMap = await readEnvFile(path.resolve(cwd, envFile));
  const exampleMap = exampleFile ? await readEnvFile(path.resolve(cwd, exampleFile)) : null;

  if (!actualMap) {
    checks.push({
      id: `env-file-${envFile}`,
      category: "env",
      title: `Environment File (${envFile})`,
      status: "fail",
      message: `Environment file '${envFile}' was not found`,
      help: "Run 'npm run env:sync' or click 'Auto-Sync .env' to generate it."
    });
  } else {
    const issues = validateEnvVariables({
      actual: actualMap,
      example: exampleMap || undefined,
      required: config.env?.required,
      types: config.env?.types,
      allowEmpty: config.env?.allowEmpty
    });

    if (issues.length === 0) {
      checks.push({
        id: `env-vars-${envFile}`,
        category: "env",
        title: `Environment File (${envFile})`,
        status: "pass",
        message: `All ${actualMap.size} variables are present, formatted, and strictly typed`
      });
    } else {
      checks.push({
        id: `env-vars-${envFile}`,
        category: "env",
        title: `Environment File (${envFile})`,
        status: "fail",
        message: `Identified ${issues.length} configuration disparity issue(s)`,
        details: issues.map((i) => i.message),
        help: "Review the required schema in .envcheck.json or use 'env-check sync'."
      });
    }
  }

  // 4. Check System Binaries
  if (config.binaries && config.binaries.length > 0) {
    for (const binReq of config.binaries) {
      checks.push(checkBinaryRequirement(binReq));
    }
  }

  // 5. Check Network Ports
  if (config.ports && config.ports.length > 0) {
    for (const portReq of config.ports) {
      // If we are auditing while this server itself is listening, adjust expected status
      if (options.serverListening && portReq.port === options.activeServerPort) {
        checks.push({
          id: `port-${portReq.port}`,
          category: "port",
          title: `Port ${portReq.port} (${portReq.description || "Active Service"})`,
          status: "pass",
          message: `Port ${portReq.port} is currently bound and serving incoming traffic`,
          expected: "bound",
          actual: "bound"
        });
      } else {
        checks.push(await checkPortRequirement(portReq));
      }
    }
  }

  // Calculate Summary
  const summary = {
    total: checks.length,
    passed: checks.filter((c) => c.status === "pass").length,
    failed: checks.filter((c) => c.status === "fail").length,
    warnings: checks.filter((c) => c.status === "warn").length,
    skipped: checks.filter((c) => c.status === "skip").length
  };

  const isSuccess = summary.failed === 0;

  return {
    success: isSuccess,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startTime,
    summary,
    checks,
    config
  };
}

/**
 * Gatekeeper Pre-flight Startup Verification.
 * Executed right as the application initializes.
 */
export async function startupGatekeeper() {
  console.log("\x1b[36m⚡ [PreFlight Sentinel] Running startup environment verification...\x1b[0m");
  const audit = await performEnvironmentAudit();

  for (const check of audit.checks) {
    const symbol =
      check.status === "pass" ? "\x1b[32m✔\x1b[0m" : check.status === "warn" ? "\x1b[33m▲\x1b[0m" : "\x1b[31m✖\x1b[0m";
    console.log(`  ${symbol} [${check.category.toUpperCase()}] ${check.title}: ${check.message}`);
    if (check.details) {
      for (const d of check.details) {
        console.log(`      \x1b[90m• ${d}\x1b[0m`);
      }
    }
  }

  console.log(
    `\x1b[36m⚡ [PreFlight Sentinel] Checks: ${audit.summary.passed} passed, ${audit.summary.failed} failed, ${audit.summary.warnings} warnings (${audit.durationMs}ms)\x1b[0m\n`
  );

  return audit;
}

/**
 * Synchronize missing variables using env-checker's sync command.
 */
export async function syncEnvVariables() {
  const result = await runSyncCommand({ json: true });
  return { exitCode: result };
}

/**
 * Fault Injection Test Harness
 * Demonstrates env-checker's detection precision by intentionally
 * injecting specific malformations.
 */
export async function injectFault(faultType) {
  const envPath = path.resolve(cwd, ".env");
  const examplePath = path.resolve(cwd, ".env.example");

  let baseContent = await fs.readFile(examplePath, "utf-8");

  switch (faultType) {
    case "missing-db":
      // Remove DATABASE_URL
      baseContent = baseContent
        .split("\n")
        .filter((line) => !line.startsWith("DATABASE_URL="))
        .join("\n");
      break;

    case "invalid-port-type":
      // Change PORT to string
      baseContent = baseContent.replace(/^PORT=.*/m, "PORT=three-thousand");
      break;

    case "invalid-db-url":
      // Make DATABASE_URL an invalid URL format
      baseContent = baseContent.replace(/^DATABASE_URL=.*/m, "DATABASE_URL=localhost-without-protocol:5432");
      break;

    case "invalid-email":
      // Set invalid email
      baseContent = baseContent.replace(/^ADMIN_EMAIL=.*/m, "ADMIN_EMAIL=not-an-email-address");
      break;

    case "invalid-boolean":
      // Set invalid boolean
      baseContent = baseContent.replace(/^ENABLE_ANALYTICS=.*/m, "ENABLE_ANALYTICS=not_a_bool");
      break;

    case "empty-jwt":
      // Set empty value
      baseContent = baseContent.replace(/^JWT_SECRET=.*/m, "JWT_SECRET=");
      break;

    default:
      throw new Error(`Unknown fault type: ${faultType}`);
  }

  await fs.writeFile(envPath, baseContent, "utf-8");
  return { status: "fault-injected", faultType };
}

/**
 * Restore .env to clean, valid state matching .env.example
 */
export async function restoreCleanEnv() {
  const envPath = path.resolve(cwd, ".env");
  const examplePath = path.resolve(cwd, ".env.example");
  const content = await fs.readFile(examplePath, "utf-8");
  await fs.writeFile(envPath, content, "utf-8");
  return { status: "restored" };
}
