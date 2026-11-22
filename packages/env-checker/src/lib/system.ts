import { spawnSync } from "node:child_process";
import os from "node:os";
import { BinaryRequirement, CheckItem } from "./types.js";
import { extractVersion, satisfiesRange } from "./semver.js";

export function checkNodeVersion(requiredRange?: string): CheckItem {
  const current = process.version.replace(/^v/, "");
  const range = requiredRange || ">=18.0.0";
  const satisfies = satisfiesRange(current, range);

  return {
    id: "runtime-node",
    category: "node",
    title: "Node.js Runtime",
    status: satisfies ? "pass" : "fail",
    message: satisfies
      ? `Node.js v${current} satisfies '${range}'`
      : `Node.js v${current} does not satisfy '${range}'`,
    expected: range,
    actual: `v${current}`,
    help: !satisfies
      ? `Please switch your Node.js version to match '${range}' (e.g. using nvm, fnm, or volta).`
      : undefined
  };
}

export function detectPackageManager(): { name: string; version?: string } {
  const userAgent = process.env.npm_config_user_agent;
  if (userAgent) {
    const match = userAgent.match(/^(npm|pnpm|yarn|bun)\/(\S+)/);
    if (match) {
      return { name: match[1], version: match[2] };
    }
  }

  // Fallback to checking npm version
  try {
    const res = spawnSync("npm", ["--version"], {
      encoding: "utf-8",
      shell: process.platform === "win32",
      timeout: 3000
    });
    if (res.status === 0 && res.stdout) {
      return { name: "npm", version: res.stdout.trim() };
    }
  } catch {
    // Ignore error
  }

  return { name: "unknown" };
}

export function checkPackageManagerRequirement(
  required?: string | { name: string; version?: string }
): CheckItem | null {
  if (!required) return null;

  const expectedName = typeof required === "string" ? required.split("@")[0] : required.name;
  const expectedVersion =
    typeof required === "string"
      ? required.includes("@")
        ? required.split("@")[1]
        : undefined
      : required.version;

  const current = detectPackageManager();
  const nameMatches = current.name.toLowerCase() === expectedName.toLowerCase();

  let versionMatches = true;
  if (expectedVersion && current.version) {
    versionMatches = satisfiesRange(current.version, expectedVersion);
  }

  const passed = nameMatches && versionMatches;

  const message = passed
    ? `Package manager is ${current.name}${current.version ? ` v${current.version}` : ""}`
    : `Expected package manager '${expectedName}${expectedVersion ? `@${expectedVersion}` : ""}', but detected '${current.name}${current.version ? ` v${current.version}` : ""}'`;

  return {
    id: "system-package-manager",
    category: "packageManager",
    title: "Package Manager",
    status: passed ? "pass" : "fail",
    message,
    expected: `${expectedName}${expectedVersion ? `@${expectedVersion}` : ""}`,
    actual: `${current.name}${current.version ? `@${current.version}` : ""}`,
    help: !passed ? `Ensure you are running commands with ${expectedName}.` : undefined
  };
}

export function checkBinaryRequirement(req: BinaryRequirement): CheckItem {
  const flag = req.flag || "--version";
  const isWindows = process.platform === "win32";

  try {
    const result = spawnSync(req.name, [flag], {
      encoding: "utf-8",
      shell: isWindows,
      timeout: 4000
    });

    if (result.error || result.status !== 0) {
      const isOptional = Boolean(req.optional);
      return {
        id: `binary-${req.name}`,
        category: "binary",
        title: `CLI Tool: ${req.name}`,
        status: isOptional ? "warn" : "fail",
        message:
          req.message ||
          `Command '${req.name}' is not found in PATH${isOptional ? " (optional)" : ""}`,
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
        message: satisfies
          ? `Found '${req.name}' version ${detectedVer} (satisfies '${req.version}')`
          : `'${req.name}' is version ${detectedVer}, but requires '${req.version}'`,
        expected: req.version,
        actual: detectedVer,
        help: !satisfies
          ? `Upgrade or change your '${req.name}' version to '${req.version}'.`
          : undefined
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
  } catch (err: any) {
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
