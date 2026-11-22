import { describe, it, expect } from "vitest";
import path from "node:path";
import { promises as fs } from "node:fs";
import { inferProjectConfig, loadConfig } from "../src/lib/config.js";

describe("Config Loader", () => {
  it("infers config defaults from repository metadata", async () => {
    const inferred = await inferProjectConfig(process.cwd());
    expect(inferred.node).toBeDefined();
    expect(inferred.binaries).toBeDefined();
    expect(inferred.binaries?.some((b) => b.name === "git")).toBe(true);
  });

  it("loads config file when explicitly provided", async () => {
    const tempConfigPath = path.resolve(process.cwd(), "test-temp-config.json");
    await fs.writeFile(
      tempConfigPath,
      JSON.stringify({
        node: ">=20.0.0",
        ports: [{ port: 8080 }]
      }),
      "utf-8"
    );

    try {
      const loaded = await loadConfig(tempConfigPath);
      expect(loaded.config.node).toBe(">=20.0.0");
      expect(loaded.config.ports?.[0].port).toBe(8080);
      expect(loaded.isAutoInferred).toBe(false);
    } finally {
      await fs.unlink(tempConfigPath);
    }
  });
});
