import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import path from "node:path";
import { promises as fs } from "node:fs";

describe("CLI End-to-End Tests", () => {
  const cliPath = path.resolve(process.cwd(), "dist/cli.js");

  it("prints version via --version flag", () => {
    const output = execSync(`node "${cliPath}" --version`, { encoding: "utf-8" });
    expect(output.trim()).toBe("1.0.0");
  });

  it("prints help via --help flag", () => {
    const output = execSync(`node "${cliPath}" --help`, { encoding: "utf-8" });
    expect(output).toContain("env-check");
    expect(output).toContain("check");
    expect(output).toContain("init");
    expect(output).toContain("sync");
  });

  it("runs init --dry-run --json and outputs valid JSON", () => {
    const output = execSync(`node "${cliPath}" init --dry-run --json`, { encoding: "utf-8" });
    const parsed = JSON.parse(output);
    expect(parsed.dryRun).toBe(true);
    expect(parsed.config).toBeDefined();
    expect(parsed.config.node).toBeDefined();
  });

  it("runs check --json and formats structured diagnostics", async () => {
    // Create temporary .env and .env.example
    const tempEnv = path.resolve(process.cwd(), ".env.test");
    const tempExample = path.resolve(process.cwd(), ".env.example.test");

    await fs.writeFile(tempExample, "PORT=3000\nAPI_KEY=xyz\n", "utf-8");
    await fs.writeFile(tempEnv, "PORT=3000\nAPI_KEY=xyz\n", "utf-8");

    try {
      const output = execSync(
        `node "${cliPath}" check --env-file "${tempEnv}" --example-file "${tempExample}" --json`,
        { encoding: "utf-8" }
      );
      const parsed = JSON.parse(output);
      expect(parsed.timestamp).toBeDefined();
      expect(parsed.summary).toBeDefined();
      expect(Array.isArray(parsed.checks)).toBe(true);
      expect(parsed.success).toBe(true);
    } finally {
      await fs.unlink(tempEnv);
      await fs.unlink(tempExample);
    }
  });

  it("returns non-zero exit code on missing required variable", async () => {
    const tempEnv = path.resolve(process.cwd(), ".env.fail.test");
    const tempExample = path.resolve(process.cwd(), ".env.example.fail.test");

    await fs.writeFile(tempExample, "REQUIRED_SECRET=must_be_set\n", "utf-8");
    await fs.writeFile(tempEnv, "# empty file\n", "utf-8");

    try {
      let failed = false;
      try {
        execSync(
          `node "${cliPath}" check --env-file "${tempEnv}" --example-file "${tempExample}" --json`,
          { encoding: "utf-8", stdio: "pipe" }
        );
      } catch (err: any) {
        failed = true;
        expect(err.status).toBe(1);
        const parsed = JSON.parse(err.stdout.toString());
        expect(parsed.success).toBe(false);
        expect(parsed.summary.failed).toBeGreaterThan(0);
      }
      expect(failed).toBe(true);
    } finally {
      await fs.unlink(tempEnv);
      await fs.unlink(tempExample);
    }
  });
});
