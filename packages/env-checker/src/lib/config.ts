import { promises as fs } from "node:fs";
import path from "node:path";
import { EnvCheckConfig } from "./types.js";

const DEFAULT_CONFIG_NAMES = [
  ".envcheck.json",
  "envcheck.json",
  "envcheck.config.json",
  ".envcheckrc.json"
];

export async function findConfigFile(cwd: string): Promise<string | null> {
  for (const name of DEFAULT_CONFIG_NAMES) {
    const fullPath = path.resolve(cwd, name);
    try {
      await fs.access(fullPath);
      return fullPath;
    } catch {
      // Continue searching
    }
  }
  return null;
}

export async function inferProjectConfig(cwd: string): Promise<EnvCheckConfig> {
  const config: EnvCheckConfig = {
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

  // 1. Try reading package.json
  const pkgPath = path.resolve(cwd, "package.json");
  try {
    const raw = await fs.readFile(pkgPath, "utf-8");
    const pkg = JSON.parse(raw);
    if (pkg.engines?.node) {
      config.node = pkg.engines.node;
    }
    if (pkg.packageManager) {
      config.packageManager = pkg.packageManager;
    }
  } catch {
    // Ignore if package.json not found
  }

  // 2. Try reading .nvmrc or .node-version if node wasn't in engines
  if (config.node === ">=18.0.0") {
    for (const file of [".nvmrc", ".node-version"]) {
      try {
        const raw = await fs.readFile(path.resolve(cwd, file), "utf-8");
        const trimmed = raw.trim();
        if (trimmed) {
          config.node = `>=${trimmed.replace(/^v/, "")}`;
          break;
        }
      } catch {
        // Continue
      }
    }
  }

  // 3. Check for .env.example or alternatives
  const envExampleCandidates = [".env.example", ".env.template", ".env.dist", ".env.sample"];
  for (const candidate of envExampleCandidates) {
    try {
      await fs.access(path.resolve(cwd, candidate));
      if (config.env) {
        config.env.exampleFiles = [candidate];
      }
      break;
    } catch {
      // Continue
    }
  }

  return config;
}

export async function loadConfig(
  customConfigPath?: string,
  cwd = process.cwd()
): Promise<{ config: EnvCheckConfig; configPath: string | null; isAutoInferred: boolean }> {
  if (customConfigPath) {
    const fullPath = path.resolve(cwd, customConfigPath);
    try {
      const raw = await fs.readFile(fullPath, "utf-8");
      return {
        config: JSON.parse(raw),
        configPath: fullPath,
        isAutoInferred: false
      };
    } catch (err: any) {
      throw new Error(`Failed to load config file at '${customConfigPath}': ${err.message}`);
    }
  }

  const detectedFile = await findConfigFile(cwd);
  if (detectedFile) {
    try {
      const raw = await fs.readFile(detectedFile, "utf-8");
      return {
        config: JSON.parse(raw),
        configPath: detectedFile,
        isAutoInferred: false
      };
    } catch (err: any) {
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
