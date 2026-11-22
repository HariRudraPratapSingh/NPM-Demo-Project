import path from "node:path";
import { CLIOptions, CheckItem, CheckResult, CheckSummary } from "../lib/types.js";
import { loadConfig } from "../lib/config.js";
import {
  checkNodeVersion,
  checkPackageManagerRequirement,
  checkBinaryRequirement
} from "../lib/system.js";
import { readEnvFile, validateEnvVariables } from "../lib/env-parser.js";
import { checkPortRequirement } from "../lib/ports.js";
import { renderHumanReport, renderJsonReport } from "../lib/reporter.js";

export async function runCheckCommand(options: CLIOptions): Promise<number> {
  const startTime = Date.now();
  const cwd = process.cwd();

  const { config } = await loadConfig(options.config, cwd);
  const checks: CheckItem[] = [];

  // 1. Node runtime check
  checks.push(checkNodeVersion(config.node));

  // 2. Package manager check
  if (config.packageManager) {
    const pmItem = checkPackageManagerRequirement(config.packageManager);
    if (pmItem) checks.push(pmItem);
  }

  // 3. Env file validation
  const envFiles = options.envFile ? [options.envFile] : config.env?.files || [".env"];
  const exampleFiles = options.exampleFile
    ? [options.exampleFile]
    : config.env?.exampleFiles || [".env.example"];

  for (let i = 0; i < envFiles.length; i++) {
    const envFileName = envFiles[i];
    const exampleFileName = exampleFiles[i] || exampleFiles[0];

    const actualMap = await readEnvFile(path.resolve(cwd, envFileName));
    const exampleMap = exampleFileName
      ? await readEnvFile(path.resolve(cwd, exampleFileName))
      : null;

    if (!actualMap) {
      checks.push({
        id: `env-file-${envFileName}`,
        category: "env",
        title: `Environment File (${envFileName})`,
        status: "fail",
        message: `File '${envFileName}' was not found`,
        help: exampleFileName
          ? `Create '${envFileName}' or run 'env-check sync' to bootstrap it from '${exampleFileName}'.`
          : `Create a '${envFileName}' file with your local configurations.`
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

  // 4. Binary checks
  if (config.binaries && config.binaries.length > 0) {
    for (const binReq of config.binaries) {
      checks.push(checkBinaryRequirement(binReq));
    }
  }

  // 5. Port checks
  if (config.ports && config.ports.length > 0) {
    for (const portReq of config.ports) {
      checks.push(await checkPortRequirement(portReq));
    }
  }

  // Calculate summary
  const summary: CheckSummary = {
    total: checks.length,
    passed: checks.filter((c) => c.status === "pass").length,
    failed: checks.filter((c) => c.status === "fail").length,
    warnings: checks.filter((c) => c.status === "warn").length,
    skipped: checks.filter((c) => c.status === "skip").length
  };

  const hasFailures = summary.failed > 0;
  const hasWarnings = summary.warnings > 0;
  const isSuccess = options.strict ? !hasFailures && !hasWarnings : !hasFailures;

  const result: CheckResult = {
    success: isSuccess,
    timestamp: new Date().toISOString(),
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
