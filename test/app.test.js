import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  checkNodeVersion,
  validateEnvVariables,
  validateType,
  readEnvFile,
  isPortAvailable,
  loadConfig
} from "env-checker";
import { restoreCleanEnv } from "../src/gatekeeper.js";

before(async () => {
  await restoreCleanEnv();
});

after(async () => {
  await restoreCleanEnv();
});

const execFileAsync = promisify(execFile);
const cwd = process.cwd();

test("env-checker: validates Node.js semver compatibility", () => {
  const passCheck = checkNodeVersion(">=18.0.0");
  assert.equal(passCheck.status, "pass");
  assert.equal(passCheck.category, "node");

  const failCheck = checkNodeVersion(">=99.0.0");
  assert.equal(failCheck.status, "fail");
});

test("env-checker: validates typed variables accurately", () => {
  // Number
  assert.equal(validateType("3000", "number"), true);
  assert.equal(validateType("three-thousand", "number"), false);

  // URL
  assert.equal(validateType("postgres://user:pass@localhost:5432/db", "url"), true);
  assert.equal(validateType("https://api.github.com", "url"), true);
  assert.equal(validateType("not-a-valid-url", "url"), false);

  // Email
  assert.equal(validateType("admin@example.com", "email"), true);
  assert.equal(validateType("invalid-email-address", "email"), false);

  // Boolean
  assert.equal(validateType("true", "boolean"), true);
  assert.equal(validateType("false", "boolean"), true);
  assert.equal(validateType("1", "boolean"), true);
  assert.equal(validateType("0", "boolean"), true);
  assert.equal(validateType("maybe", "boolean"), false);
});

test("env-checker: reads and checks project .env file against .env.example", async () => {
  const envMap = await readEnvFile(path.resolve(cwd, ".env"));
  const exampleMap = await readEnvFile(path.resolve(cwd, ".env.example"));

  assert.ok(envMap instanceof Map);
  assert.ok(exampleMap instanceof Map);

  const issues = validateEnvVariables({
    actual: envMap,
    example: exampleMap,
    required: ["PORT", "DATABASE_URL", "JWT_SECRET", "ADMIN_EMAIL", "ENABLE_ANALYTICS"],
    types: {
      PORT: "number",
      DATABASE_URL: "url",
      ADMIN_EMAIL: "email",
      ENABLE_ANALYTICS: "boolean"
    }
  });

  assert.equal(issues.length, 0, "Clean environment should have zero validation issues");
});

test("env-checker: detects missing variables and invalid types", () => {
  const flawedMap = new Map([
    ["PORT", "not-a-number"],
    ["ADMIN_EMAIL", "bad-email"]
    // missing DATABASE_URL, JWT_SECRET, ENABLE_ANALYTICS
  ]);

  const issues = validateEnvVariables({
    actual: flawedMap,
    required: ["PORT", "DATABASE_URL", "ADMIN_EMAIL"],
    types: {
      PORT: "number",
      DATABASE_URL: "url",
      ADMIN_EMAIL: "email"
    }
  });

  assert.equal(issues.length, 3);
  const keys = issues.map((i) => i.key);
  assert.ok(keys.includes("DATABASE_URL"));
  assert.ok(keys.includes("PORT"));
  assert.ok(keys.includes("ADMIN_EMAIL"));
});

test("env-checker: port availability scanner works non-intrusively", async () => {
  // Port 59999 should usually be available
  const available = await isPortAvailable(59999);
  assert.equal(typeof available, "boolean");
});

test("env-checker: loads and parses .envcheck.json configuration", async () => {
  const { config } = await loadConfig(undefined, cwd);
  assert.ok(config);
  assert.equal(config.node, ">=18.0.0");
  assert.ok(Array.isArray(config.env?.required));
  assert.ok(config.env?.required.includes("DATABASE_URL"));
});

test("env-checker: CLI executable runs with --json flag", async () => {
  const cliPath = path.resolve(cwd, "packages/env-checker/dist/cli.js");
  let output = "";
  try {
    const res = await execFileAsync("node", [cliPath, "--json"]);
    output = res.stdout;
  } catch (err) {
    output = err.stdout;
  }
  const parsed = JSON.parse(output);

  assert.equal(typeof parsed.success, "boolean");
  assert.ok(parsed.summary.total >= 4);
  assert.ok(Array.isArray(parsed.checks));
});
