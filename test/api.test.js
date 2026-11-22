import test, { after, afterEach, before } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { performEnvironmentAudit, injectFault, restoreCleanEnv } from "../src/gatekeeper.js";

before(async () => {
  await restoreCleanEnv();
});

afterEach(async () => {
  await restoreCleanEnv();
});

after(async () => {
  await restoreCleanEnv();
});

test("API & Gatekeeper: verifies audit under normal conditions", async () => {
  const audit = await performEnvironmentAudit();
  assert.equal(audit.success, true);
  assert.equal(audit.summary.failed, 0);
  assert.ok(audit.summary.passed >= 6);
});

test("API & Gatekeeper: injects fault and detects type mismatch", async () => {
  await injectFault("invalid-port-type");
  const audit = await performEnvironmentAudit();
  assert.equal(audit.success, false);
  assert.ok(audit.summary.failed > 0);

  const envCheck = audit.checks.find((c) => c.category === "env");
  assert.equal(envCheck.status, "fail");
  assert.ok(envCheck.details.some((d) => d.includes("must be of type 'number'")));

  // Restore clean state
  await restoreCleanEnv();
  const cleanAudit = await performEnvironmentAudit();
  assert.equal(cleanAudit.success, true);
});

test("API & Gatekeeper: injects missing secret and detects disparity", async () => {
  await injectFault("missing-db");
  const audit = await performEnvironmentAudit();
  assert.equal(audit.success, false);

  const envCheck = audit.checks.find((c) => c.category === "env");
  assert.equal(envCheck.status, "fail");
  assert.ok(envCheck.details.some((d) => d.includes("DATABASE_URL")));

  // Restore
  await restoreCleanEnv();
  const cleanAudit = await performEnvironmentAudit();
  assert.equal(cleanAudit.success, true);
});
