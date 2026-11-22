#!/usr/bin/env node

// src/lib/errors.ts
import pc from "picocolors";
var EnvCheckError = class extends Error {
  exitCode;
  code;
  constructor(message, code = "ERR_ENVCHECK", exitCode = 1) {
    super(message);
    this.name = "EnvCheckError";
    this.code = code;
    this.exitCode = exitCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
};
function handleError(error, debug = false) {
  if (error instanceof EnvCheckError) {
    console.error(pc.red(`
\u2716 ${error.message}`));
    if (debug && error.stack) {
      console.error(pc.dim(`
Stack trace:
${error.stack}`));
    }
    process.exit(error.exitCode);
  }
  if (error instanceof Error) {
    console.error(pc.red(`
\u2716 Unexpected error: ${error.message}`));
    if (debug && error.stack) {
      console.error(pc.dim(`
Stack trace:
${error.stack}`));
    } else {
      console.error(pc.dim("Run with --debug for full stack trace."));
    }
    process.exit(1);
  }
  console.error(pc.red(`
\u2716 Unknown error occurred: ${String(error)}`));
  process.exit(1);
}

// src/lib/semver.ts
function extractVersion(raw) {
  const match = raw.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return null;
  const major = match[1];
  const minor = match[2];
  const patch = match[3] ?? "0";
  return `${major}.${minor}.${patch}`;
}
function parseSemver(input) {
  const cleaned = input.trim().replace(/^v/i, "");
  const match = cleaned.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: match[2] !== void 0 ? parseInt(match[2], 10) : 0,
    patch: match[3] !== void 0 ? parseInt(match[3], 10) : 0,
    raw: input.trim()
  };
}
function compareSemver(a, b) {
  const parsedA = typeof a === "string" ? parseSemver(a) : a;
  const parsedB = typeof b === "string" ? parseSemver(b) : b;
  if (!parsedA || !parsedB) return 0;
  if (parsedA.major !== parsedB.major) {
    return parsedA.major > parsedB.major ? 1 : -1;
  }
  if (parsedA.minor !== parsedB.minor) {
    return parsedA.minor > parsedB.minor ? 1 : -1;
  }
  if (parsedA.patch !== parsedB.patch) {
    return parsedA.patch > parsedB.patch ? 1 : -1;
  }
  return 0;
}
function satisfiesSingle(version, condition) {
  const cond = condition.trim();
  if (!cond || cond === "*") return true;
  const wildcardMatch = cond.match(/^(\d+)(?:\.([xX*]))?(?:\.([xX*]))?$/);
  if (wildcardMatch) {
    const major = parseInt(wildcardMatch[1], 10);
    return version.major === major;
  }
  if (cond.startsWith("^")) {
    const target = parseSemver(cond.slice(1));
    if (!target) return false;
    if (compareSemver(version, target) < 0) return false;
    if (target.major > 0) {
      return version.major === target.major;
    }
    if (target.minor > 0) {
      return version.minor === target.minor;
    }
    return version.patch === target.patch;
  }
  if (cond.startsWith("~")) {
    const target = parseSemver(cond.slice(1));
    if (!target) return false;
    if (compareSemver(version, target) < 0) return false;
    return version.major === target.major && version.minor === target.minor;
  }
  const opMatch = cond.match(/^(>=|<=|>|<|=|!=)\s*(.+)$/);
  if (opMatch) {
    const op = opMatch[1];
    const target = parseSemver(opMatch[2]);
    if (!target) return false;
    const cmp = compareSemver(version, target);
    switch (op) {
      case ">=":
        return cmp >= 0;
      case "<=":
        return cmp <= 0;
      case ">":
        return cmp > 0;
      case "<":
        return cmp < 0;
      case "=":
        return cmp === 0;
      case "!=":
        return cmp !== 0;
      default:
        return false;
    }
  }
  const exact = parseSemver(cond);
  if (!exact) return false;
  return compareSemver(version, exact) === 0;
}
function satisfiesRange(versionStr, rangeStr) {
  const parsed = parseSemver(versionStr);
  if (!parsed) return false;
  const orBranches = rangeStr.split("||").map((branch) => branch.trim());
  return orBranches.some((branch) => {
    const andClauses = branch.replace(/(>=|<=|>|<|=|!=)\s+/g, "$1").split(/\s+/).filter(Boolean);
    return andClauses.every((clause) => satisfiesSingle(parsed, clause));
  });
}

// src/lib/env-parser.ts
import { promises as fs } from "fs";
import path from "path";
function parseEnvContent(content) {
  const result = /* @__PURE__ */ new Map();
  const lines = content.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith("#")) {
      continue;
    }
    let line = rawLine;
    if (line.startsWith("export ")) {
      line = line.slice(7).trim();
    }
    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) {
      const key2 = line.trim();
      if (key2) {
        result.set(key2, "");
      }
      continue;
    }
    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();
    if (value.startsWith('"') && value.endsWith('"') || value.startsWith("'") && value.endsWith("'")) {
      value = value.slice(1, -1);
    } else {
      const commentIdx = value.indexOf(" #");
      if (commentIdx !== -1) {
        value = value.slice(0, commentIdx).trim();
      }
    }
    if (key) {
      result.set(key, value);
    }
  }
  return result;
}
async function readEnvFile(filePath) {
  try {
    const content = await fs.readFile(path.resolve(filePath), "utf-8");
    return parseEnvContent(content);
  } catch {
    return null;
  }
}
function validateType(value, type) {
  if (!value) return false;
  switch (type) {
    case "string":
      return value.trim().length > 0;
    case "number":
      return !isNaN(Number(value)) && !isNaN(parseFloat(value));
    case "boolean":
      return ["true", "false", "1", "0"].includes(value.toLowerCase().trim());
    case "url":
      try {
        const u = new URL(value);
        return Boolean(u.protocol);
      } catch {
        return false;
      }
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    default:
      return true;
  }
}
function validateEnvVariables(options) {
  const issues = [];
  const { actual, example, required = [], types = {}, allowEmpty = false } = options;
  const keysToCheck = new Set(required);
  if (example) {
    for (const key of example.keys()) {
      keysToCheck.add(key);
    }
  }
  for (const key of keysToCheck) {
    if (!actual.has(key)) {
      issues.push({
        key,
        type: "missing",
        message: `Variable '${key}' is missing from .env`
      });
      continue;
    }
    const val = actual.get(key) ?? "";
    if (!allowEmpty && val.trim() === "") {
      issues.push({
        key,
        type: "empty",
        message: `Variable '${key}' is defined but empty`
      });
      continue;
    }
    const expectedType = types[key];
    if (expectedType && val.trim() !== "") {
      const isValid = validateType(val, expectedType);
      if (!isValid) {
        issues.push({
          key,
          type: "invalid_type",
          expected: expectedType,
          actual: val,
          message: `Variable '${key}' must be of type '${expectedType}' (found '${val}')`
        });
      }
    }
  }
  return issues;
}

// src/lib/system.ts
import { spawnSync } from "child_process";
function checkNodeVersion(requiredRange) {
  const current = process.version.replace(/^v/, "");
  const range = requiredRange || ">=18.0.0";
  const satisfies = satisfiesRange(current, range);
  return {
    id: "runtime-node",
    category: "node",
    title: "Node.js Runtime",
    status: satisfies ? "pass" : "fail",
    message: satisfies ? `Node.js v${current} satisfies '${range}'` : `Node.js v${current} does not satisfy '${range}'`,
    expected: range,
    actual: `v${current}`,
    help: !satisfies ? `Please switch your Node.js version to match '${range}' (e.g. using nvm, fnm, or volta).` : void 0
  };
}
function detectPackageManager() {
  const userAgent = process.env.npm_config_user_agent;
  if (userAgent) {
    const match = userAgent.match(/^(npm|pnpm|yarn|bun)\/(\S+)/);
    if (match) {
      return { name: match[1], version: match[2] };
    }
  }
  try {
    const res = spawnSync("npm", ["--version"], {
      encoding: "utf-8",
      shell: process.platform === "win32",
      timeout: 3e3
    });
    if (res.status === 0 && res.stdout) {
      return { name: "npm", version: res.stdout.trim() };
    }
  } catch {
  }
  return { name: "unknown" };
}
function checkPackageManagerRequirement(required) {
  if (!required) return null;
  const expectedName = typeof required === "string" ? required.split("@")[0] : required.name;
  const expectedVersion = typeof required === "string" ? required.includes("@") ? required.split("@")[1] : void 0 : required.version;
  const current = detectPackageManager();
  const nameMatches = current.name.toLowerCase() === expectedName.toLowerCase();
  let versionMatches = true;
  if (expectedVersion && current.version) {
    versionMatches = satisfiesRange(current.version, expectedVersion);
  }
  const passed = nameMatches && versionMatches;
  const message = passed ? `Package manager is ${current.name}${current.version ? ` v${current.version}` : ""}` : `Expected package manager '${expectedName}${expectedVersion ? `@${expectedVersion}` : ""}', but detected '${current.name}${current.version ? ` v${current.version}` : ""}'`;
  return {
    id: "system-package-manager",
    category: "packageManager",
    title: "Package Manager",
    status: passed ? "pass" : "fail",
    message,
    expected: `${expectedName}${expectedVersion ? `@${expectedVersion}` : ""}`,
    actual: `${current.name}${current.version ? `@${current.version}` : ""}`,
    help: !passed ? `Ensure you are running commands with ${expectedName}.` : void 0
  };
}
function checkBinaryRequirement(req) {
  const flag = req.flag || "--version";
  const isWindows = process.platform === "win32";
  try {
    const result = spawnSync(req.name, [flag], {
      encoding: "utf-8",
      shell: isWindows,
      timeout: 4e3
    });
    if (result.error || result.status !== 0) {
      const isOptional = Boolean(req.optional);
      return {
        id: `binary-${req.name}`,
        category: "binary",
        title: `CLI Tool: ${req.name}`,
        status: isOptional ? "warn" : "fail",
        message: req.message || `Command '${req.name}' is not found in PATH${isOptional ? " (optional)" : ""}`,
        expected: req.version ? `${req.name} ${req.version}` : `${req.name} executable`,
        actual: "Not installed",
        help: `Install '${req.name}' and ensure it is available in your system PATH.`
      };
    }
    const output = (result.stdout || result.stderr || "").trim();
    const detectedVer = extractVersion(output);
    if (req.version && detectedVer) {
      const satisfies = satisfiesRange(detectedVer, req.version);
      return {
        id: `binary-${req.name}`,
        category: "binary",
        title: `CLI Tool: ${req.name}`,
        status: satisfies ? "pass" : "fail",
        message: satisfies ? `Found '${req.name}' version ${detectedVer} (satisfies '${req.version}')` : `'${req.name}' is version ${detectedVer}, but requires '${req.version}'`,
        expected: req.version,
        actual: detectedVer,
        help: !satisfies ? `Upgrade or change your '${req.name}' version to '${req.version}'.` : void 0
      };
    }
    return {
      id: `binary-${req.name}`,
      category: "binary",
      title: `CLI Tool: ${req.name}`,
      status: "pass",
      message: `Found '${req.name}' in PATH${detectedVer ? ` (${detectedVer})` : ""}`,
      actual: detectedVer || "Installed"
    };
  } catch (err) {
    const isOptional = Boolean(req.optional);
    return {
      id: `binary-${req.name}`,
      category: "binary",
      title: `CLI Tool: ${req.name}`,
      status: isOptional ? "warn" : "fail",
      message: req.message || `Failed to execute '${req.name}': ${err.message}`,
      actual: "Execution failed"
    };
  }
}

// src/lib/ports.ts
import net from "net";
function isPortAvailable(port, host = "127.0.0.1", timeoutMs = 1500) {
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    }, timeoutMs);
    const server = net.createServer();
    server.unref();
    server.once("error", (err) => {
      clearTimeout(timer);
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    });
    server.listen(port, host, () => {
      server.close(() => {
        clearTimeout(timer);
        if (!resolved) {
          resolved = true;
          resolve(true);
        }
      });
    });
  });
}
async function checkPortRequirement(req) {
  const host = req.host || "127.0.0.1";
  const expected = req.expectedStatus || "free";
  const available = await isPortAvailable(req.port, host);
  const actual = available ? "free" : "in-use";
  const passed = expected === actual;
  const desc = req.description ? ` (${req.description})` : "";
  return {
    id: `port-${req.port}`,
    category: "port",
    title: `Port ${req.port}${desc}`,
    status: passed ? "pass" : "fail",
    message: passed ? `Port ${req.port} is ${actual} as expected` : `Port ${req.port} is ${actual}, but expected to be ${expected}`,
    expected,
    actual,
    help: !passed && actual === "in-use" ? `Kill the process occupying port ${req.port} or reconfigure your application port.` : void 0
  };
}

// src/lib/config.ts
import { promises as fs2 } from "fs";
import path2 from "path";
var DEFAULT_CONFIG_NAMES = [
  ".envcheck.json",
  "envcheck.json",
  "envcheck.config.json",
  ".envcheckrc.json"
];
async function findConfigFile(cwd) {
  for (const name of DEFAULT_CONFIG_NAMES) {
    const fullPath = path2.resolve(cwd, name);
    try {
      await fs2.access(fullPath);
      return fullPath;
    } catch {
    }
  }
  return null;
}
async function inferProjectConfig(cwd) {
  const config = {
    $schema: "https://raw.githubusercontent.com/rangxr/env-checker/main/schema.json",
    node: ">=18.0.0",
    env: {
      files: [".env"],
      exampleFiles: [".env.example"],
      required: [],
      allowEmpty: false
    },
    binaries: [{ name: "git", optional: false }],
    ports: []
  };
  const pkgPath = path2.resolve(cwd, "package.json");
  try {
    const raw = await fs2.readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(raw);
    if (pkg.engines?.node) {
      config.node = pkg.engines.node;
    }
    if (pkg.packageManager) {
      config.packageManager = pkg.packageManager;
    }
  } catch {
  }
  if (config.node === ">=18.0.0") {
    for (const file of [".nvmrc", ".node-version"]) {
      try {
        const raw = await fs2.readFile(path2.resolve(cwd, file), "utf-8");
        const trimmed = raw.trim();
        if (trimmed) {
          config.node = `>=${trimmed.replace(/^v/, "")}`;
          break;
        }
      } catch {
      }
    }
  }
  const envExampleCandidates = [".env.example", ".env.template", ".env.dist", ".env.sample"];
  for (const candidate of envExampleCandidates) {
    try {
      await fs2.access(path2.resolve(cwd, candidate));
      if (config.env) {
        config.env.exampleFiles = [candidate];
      }
      break;
    } catch {
    }
  }
  return config;
}
async function loadConfig(customConfigPath, cwd = process.cwd()) {
  if (customConfigPath) {
    const fullPath = path2.resolve(cwd, customConfigPath);
    try {
      const raw = await fs2.readFile(fullPath, "utf-8");
      return {
        config: JSON.parse(raw),
        configPath: fullPath,
        isAutoInferred: false
      };
    } catch (err) {
      throw new Error(`Failed to load config file at '${customConfigPath}': ${err.message}`);
    }
  }
  const detectedFile = await findConfigFile(cwd);
  if (detectedFile) {
    try {
      const raw = await fs2.readFile(detectedFile, "utf-8");
      return {
        config: JSON.parse(raw),
        configPath: detectedFile,
        isAutoInferred: false
      };
    } catch (err) {
      throw new Error(`Failed to parse config file '${detectedFile}': ${err.message}`);
    }
  }
  const inferred = await inferProjectConfig(cwd);
  return {
    config: inferred,
    configPath: null,
    isAutoInferred: true
  };
}

// src/lib/reporter.ts
import pc2 from "picocolors";
var isUnicodeSupported = () => {
  if (process.platform !== "win32") {
    return process.env.TERM !== "linux";
  }
  return Boolean(
    process.env.CI || process.env.WT_SESSION || process.env.ConEmuTask === "{cmd::Cmder}" || process.env.TERM_PROGRAM === "vscode" || process.env.TERM === "xterm-256color" || process.env.TERM === "alacritty"
  );
};
var unicode = isUnicodeSupported();
var symbols = {
  pass: unicode ? "\u2714" : "[PASS]",
  fail: unicode ? "\u2716" : "[FAIL]",
  warn: unicode ? "\u26A0" : "[WARN]",
  skip: unicode ? "\u2139" : "[SKIP]"
};
function getStatusBadge(status) {
  switch (status) {
    case "pass":
      return pc2.green(symbols.pass);
    case "fail":
      return pc2.red(symbols.fail);
    case "warn":
      return pc2.yellow(symbols.warn);
    case "skip":
      return pc2.cyan(symbols.skip);
  }
}
function renderHumanReport(result, dryRun = false) {
  const lines = [];
  const titleText = dryRun ? pc2.bold(pc2.cyan("\u26A1 env-checker (DRY RUN - No changes applied)")) : pc2.bold(pc2.cyan("\u26A1 env-checker Pre-flight System Verification"));
  lines.push(`
${titleText}`);
  lines.push(pc2.dim("\u2501".repeat(60)));
  const categories = [
    { key: "node", label: "Runtime Environment" },
    { key: "packageManager", label: "Package Manager" },
    { key: "env", label: "Environment Variables" },
    { key: "binary", label: "System Binaries & Tools" },
    { key: "port", label: "Network Ports" }
  ];
  for (const cat of categories) {
    const items = result.checks.filter((c) => c.category === cat.key);
    if (items.length === 0) continue;
    lines.push(`
${pc2.bold(pc2.underline(cat.label))}`);
    for (const item of items) {
      const badge = getStatusBadge(item.status);
      const title = pc2.bold(item.title);
      lines.push(`  ${badge} ${title}: ${item.message}`);
      if (item.details && item.details.length > 0) {
        for (const detail of item.details) {
          lines.push(`      ${pc2.dim("\u2022")} ${detail}`);
        }
      }
      if (item.help && (item.status === "fail" || item.status === "warn")) {
        lines.push(`      ${pc2.blue("\u21B3")} ${pc2.italic(pc2.dim(item.help))}`);
      }
    }
  }
  lines.push(pc2.dim("\n" + "\u2501".repeat(60)));
  const { total, passed, failed, warnings, skipped } = result.summary;
  const parts = [];
  if (passed > 0) parts.push(pc2.green(`${passed} passed`));
  if (failed > 0) parts.push(pc2.red(`${failed} failed`));
  if (warnings > 0) parts.push(pc2.yellow(`${warnings} warnings`));
  if (skipped > 0) parts.push(pc2.cyan(`${skipped} skipped`));
  const statusSummary = parts.join(", ") || "No checks executed";
  lines.push(
    `Summary: ${statusSummary} ${pc2.dim(`(total ${total} checks, ${result.durationMs}ms)`)}`
  );
  if (result.success) {
    lines.push(pc2.bold(pc2.green("\n\u2714 Environment is ready for development!\n")));
  } else {
    lines.push(pc2.bold(pc2.red("\n\u2716 Pre-flight verification failed. Fix the issues above.\n")));
  }
  return lines.join("\n");
}
function renderJsonReport(result) {
  return JSON.stringify(result, null, 2);
}

// src/commands/check.ts
import path3 from "path";
async function runCheckCommand(options) {
  const startTime = Date.now();
  const cwd = process.cwd();
  const { config } = await loadConfig(options.config, cwd);
  const checks = [];
  checks.push(checkNodeVersion(config.node));
  if (config.packageManager) {
    const pmItem = checkPackageManagerRequirement(config.packageManager);
    if (pmItem) checks.push(pmItem);
  }
  const envFiles = options.envFile ? [options.envFile] : config.env?.files || [".env"];
  const exampleFiles = options.exampleFile ? [options.exampleFile] : config.env?.exampleFiles || [".env.example"];
  for (let i = 0; i < envFiles.length; i++) {
    const envFileName = envFiles[i];
    const exampleFileName = exampleFiles[i] || exampleFiles[0];
    const actualMap = await readEnvFile(path3.resolve(cwd, envFileName));
    const exampleMap = exampleFileName ? await readEnvFile(path3.resolve(cwd, exampleFileName)) : null;
    if (!actualMap) {
      checks.push({
        id: `env-file-${envFileName}`,
        category: "env",
        title: `Environment File (${envFileName})`,
        status: "fail",
        message: `File '${envFileName}' was not found`,
        help: exampleFileName ? `Create '${envFileName}' or run 'env-check sync' to bootstrap it from '${exampleFileName}'.` : `Create a '${envFileName}' file with your local configurations.`
      });
    } else {
      const issues = validateEnvVariables({
        actual: actualMap,
        example: exampleMap || void 0,
        required: config.env?.required,
        types: config.env?.types,
        allowEmpty: config.env?.allowEmpty
      });
      if (issues.length === 0) {
        checks.push({
          id: `env-vars-${envFileName}`,
          category: "env",
          title: `Environment File (${envFileName})`,
          status: "pass",
          message: `All ${actualMap.size} variables are present and valid`
        });
      } else {
        const details = issues.map((iss) => iss.message);
        checks.push({
          id: `env-vars-${envFileName}`,
          category: "env",
          title: `Environment File (${envFileName})`,
          status: "fail",
          message: `Found ${issues.length} variable issue(s)`,
          details,
          help: `Review your '${envFileName}' against '${exampleFileName || "requirements"}'.`
        });
      }
    }
  }
  if (config.binaries && config.binaries.length > 0) {
    for (const binReq of config.binaries) {
      checks.push(checkBinaryRequirement(binReq));
    }
  }
  if (config.ports && config.ports.length > 0) {
    for (const portReq of config.ports) {
      checks.push(await checkPortRequirement(portReq));
    }
  }
  const summary = {
    total: checks.length,
    passed: checks.filter((c) => c.status === "pass").length,
    failed: checks.filter((c) => c.status === "fail").length,
    warnings: checks.filter((c) => c.status === "warn").length,
    skipped: checks.filter((c) => c.status === "skip").length
  };
  const hasFailures = summary.failed > 0;
  const hasWarnings = summary.warnings > 0;
  const isSuccess = options.strict ? !hasFailures && !hasWarnings : !hasFailures;
  const result = {
    success: isSuccess,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    durationMs: Date.now() - startTime,
    summary,
    checks,
    dryRun: Boolean(options.dryRun)
  };
  if (options.json) {
    console.log(renderJsonReport(result));
  } else {
    console.log(renderHumanReport(result, options.dryRun));
  }
  return isSuccess ? 0 : 1;
}

// src/commands/init.ts
import { promises as fs3 } from "fs";
import path4 from "path";
import pc3 from "picocolors";
async function runInitCommand(options) {
  const cwd = process.cwd();
  const existingConfig = await findConfigFile(cwd);
  if (existingConfig && !options.force) {
    if (options.json) {
      console.log(
        JSON.stringify({
          success: false,
          message: `Config file already exists at '${existingConfig}'. Use --force to overwrite.`
        })
      );
    } else {
      console.error(
        pc3.yellow(
          `
\u26A0 Config file already exists at '${existingConfig}'. Use --force to overwrite.
`
        )
      );
    }
    return 1;
  }
  const generated = await inferProjectConfig(cwd);
  const targetPath = path4.resolve(cwd, ".envcheck.json");
  const formatted = JSON.stringify(generated, null, 2) + "\n";
  if (options.dryRun) {
    if (options.json) {
      console.log(
        JSON.stringify({
          dryRun: true,
          targetPath,
          config: generated
        })
      );
    } else {
      console.log(pc3.cyan("\n[DRY RUN] Would write the following config to: ") + targetPath);
      console.log(formatted);
    }
    return 0;
  }
  await fs3.writeFile(targetPath, formatted, "utf-8");
  if (options.json) {
    console.log(
      JSON.stringify({
        success: true,
        targetPath,
        config: generated
      })
    );
  } else {
    console.log(pc3.green(`
\u2714 Created '.envcheck.json' successfully!`));
    console.log(pc3.dim("  Run 'env-check' or 'npx env-check' to validate your environment.\n"));
  }
  return 0;
}

// src/commands/sync.ts
import { promises as fs4 } from "fs";
import path5 from "path";
import pc4 from "picocolors";
async function runSyncCommand(options) {
  const cwd = process.cwd();
  const { config } = await loadConfig(options.config, cwd);
  const envFile = options.envFile || config.env?.files?.[0] || ".env";
  const exampleFile = options.exampleFile || config.env?.exampleFiles?.[0] || ".env.example";
  const examplePath = path5.resolve(cwd, exampleFile);
  const envPath = path5.resolve(cwd, envFile);
  const exampleMap = await readEnvFile(examplePath);
  if (!exampleMap) {
    if (options.json) {
      console.log(
        JSON.stringify({
          success: false,
          error: `Template file '${exampleFile}' not found.`
        })
      );
    } else {
      console.error(pc4.red(`
\u2716 Could not find example file '${exampleFile}' to sync from.
`));
    }
    return 1;
  }
  const currentMap = await readEnvFile(envPath) || /* @__PURE__ */ new Map();
  const missingKeys = [];
  for (const [key, val] of exampleMap.entries()) {
    if (!currentMap.has(key)) {
      missingKeys.push({ key, defaultValue: val });
    }
  }
  if (missingKeys.length === 0) {
    if (options.json) {
      console.log(
        JSON.stringify({
          success: true,
          message: `'${envFile}' is already in sync with '${exampleFile}'.`,
          added: []
        })
      );
    } else {
      console.log(pc4.green(`
\u2714 '${envFile}' is already up-to-date with '${exampleFile}'.
`));
    }
    return 0;
  }
  if (options.dryRun) {
    if (options.json) {
      console.log(
        JSON.stringify({
          dryRun: true,
          envFile,
          exampleFile,
          wouldAdd: missingKeys
        })
      );
    } else {
      console.log(
        pc4.cyan(
          `
[DRY RUN] Would append ${missingKeys.length} missing variable(s) to '${envFile}':`
        )
      );
      for (const item of missingKeys) {
        console.log(`  ${pc4.bold("+")} ${item.key}=${item.defaultValue}`);
      }
      console.log();
    }
    return 0;
  }
  let existingContent = "";
  try {
    existingContent = await fs4.readFile(envPath, "utf-8");
  } catch {
  }
  const additions = [];
  if (existingContent && !existingContent.endsWith("\n")) {
    additions.push("\n");
  }
  additions.push(`# --- Synced from ${exampleFile} on ${(/* @__PURE__ */ new Date()).toISOString()} ---`);
  for (const item of missingKeys) {
    additions.push(`${item.key}=${item.defaultValue}`);
  }
  additions.push("");
  const newContent = existingContent + additions.join("\n");
  await fs4.writeFile(envPath, newContent, "utf-8");
  if (options.json) {
    console.log(
      JSON.stringify({
        success: true,
        envFile,
        added: missingKeys
      })
    );
  } else {
    console.log(
      pc4.green(`
\u2714 Synced ${missingKeys.length} missing variable(s) into '${envFile}':`)
    );
    for (const item of missingKeys) {
      console.log(`  ${pc4.green("+")} ${item.key}`);
    }
    console.log();
  }
  return 0;
}
export {
  EnvCheckError,
  checkBinaryRequirement,
  checkNodeVersion,
  checkPackageManagerRequirement,
  checkPortRequirement,
  compareSemver,
  detectPackageManager,
  extractVersion,
  findConfigFile,
  getStatusBadge,
  handleError,
  inferProjectConfig,
  isPortAvailable,
  loadConfig,
  parseEnvContent,
  parseSemver,
  readEnvFile,
  renderHumanReport,
  renderJsonReport,
  runCheckCommand,
  runInitCommand,
  runSyncCommand,
  satisfiesRange,
  validateEnvVariables,
  validateType
};
//# sourceMappingURL=index.js.map