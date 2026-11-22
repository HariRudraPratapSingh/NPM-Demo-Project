import pc from "picocolors";
import { CheckResult, CheckStatus } from "./types.js";

const isUnicodeSupported = () => {
  if (process.platform !== "win32") {
    return process.env.TERM !== "linux";
  }
  return Boolean(
    process.env.CI ||
    process.env.WT_SESSION ||
    process.env.ConEmuTask === "{cmd::Cmder}" ||
    process.env.TERM_PROGRAM === "vscode" ||
    process.env.TERM === "xterm-256color" ||
    process.env.TERM === "alacritty"
  );
};

const unicode = isUnicodeSupported();

const symbols = {
  pass: unicode ? "✔" : "[PASS]",
  fail: unicode ? "✖" : "[FAIL]",
  warn: unicode ? "⚠" : "[WARN]",
  skip: unicode ? "ℹ" : "[SKIP]"
};

export function getStatusBadge(status: CheckStatus): string {
  switch (status) {
    case "pass":
      return pc.green(symbols.pass);
    case "fail":
      return pc.red(symbols.fail);
    case "warn":
      return pc.yellow(symbols.warn);
    case "skip":
      return pc.cyan(symbols.skip);
  }
}

export function renderHumanReport(result: CheckResult, dryRun = false): string {
  const lines: string[] = [];

  const titleText = dryRun
    ? pc.bold(pc.cyan("⚡ env-checker (DRY RUN - No changes applied)"))
    : pc.bold(pc.cyan("⚡ env-checker Pre-flight System Verification"));

  lines.push(`\n${titleText}`);
  lines.push(pc.dim("━".repeat(60)));

  // Group checks by category
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

    lines.push(`\n${pc.bold(pc.underline(cat.label))}`);

    for (const item of items) {
      const badge = getStatusBadge(item.status);
      const title = pc.bold(item.title);
      lines.push(`  ${badge} ${title}: ${item.message}`);

      if (item.details && item.details.length > 0) {
        for (const detail of item.details) {
          lines.push(`      ${pc.dim("•")} ${detail}`);
        }
      }

      if (item.help && (item.status === "fail" || item.status === "warn")) {
        lines.push(`      ${pc.blue("↳")} ${pc.italic(pc.dim(item.help))}`);
      }
    }
  }

  lines.push(pc.dim("\n" + "━".repeat(60)));

  // Summary row
  const { total, passed, failed, warnings, skipped } = result.summary;
  const parts: string[] = [];
  if (passed > 0) parts.push(pc.green(`${passed} passed`));
  if (failed > 0) parts.push(pc.red(`${failed} failed`));
  if (warnings > 0) parts.push(pc.yellow(`${warnings} warnings`));
  if (skipped > 0) parts.push(pc.cyan(`${skipped} skipped`));

  const statusSummary = parts.join(", ") || "No checks executed";
  lines.push(
    `Summary: ${statusSummary} ${pc.dim(`(total ${total} checks, ${result.durationMs}ms)`)}`
  );

  if (result.success) {
    lines.push(pc.bold(pc.green("\n✔ Environment is ready for development!\n")));
  } else {
    lines.push(pc.bold(pc.red("\n✖ Pre-flight verification failed. Fix the issues above.\n")));
  }

  return lines.join("\n");
}

export function renderJsonReport(result: CheckResult): string {
  return JSON.stringify(result, null, 2);
}
