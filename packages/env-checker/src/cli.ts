import { Command } from "commander";
import { runCheckCommand } from "./commands/check.js";
import { runInitCommand } from "./commands/init.js";
import { runSyncCommand } from "./commands/sync.js";
import { handleError } from "./lib/errors.js";

const program = new Command();

program
  .name("env-check")
  .description("⚡ Production-grade pre-flight environment and dependency verification CLI")
  .version("1.0.0", "-v, --version", "Output the current version")
  .option("-c, --config <path>", "Path to custom configuration file")
  .option("-e, --env-file <path>", "Path to target .env file")
  .option("-x, --example-file <path>", "Path to template .env.example file")
  .option("--dry-run", "Simulate execution without modifying any files", false)
  .option("--json", "Format output as machine-readable JSON", false)
  .option("--strict", "Treat warnings as validation failures", false)
  .option("--debug", "Output verbose debug logs and error call stacks", false);

// Default action: check
program
  .command("check", { isDefault: true })
  .description("Validate runtime, environment variables, binaries, and ports (default)")
  .action(async () => {
    const opts = program.opts();
    try {
      const exitCode = await runCheckCommand({
        config: opts.config,
        envFile: opts.envFile,
        exampleFile: opts.exampleFile,
        dryRun: opts.dryRun,
        json: opts.json,
        strict: opts.strict,
        debug: opts.debug
      });
      process.exit(exitCode);
    } catch (err) {
      handleError(err, opts.debug);
    }
  });

// Init command
program
  .command("init")
  .description("Generate an .envcheck.json configuration file with project defaults")
  .option("-f, --force", "Overwrite existing configuration file", false)
  .action(async (cmdOpts) => {
    const opts = program.opts();
    try {
      const exitCode = await runInitCommand({
        force: cmdOpts.force,
        dryRun: opts.dryRun,
        json: opts.json,
        debug: opts.debug
      });
      process.exit(exitCode);
    } catch (err) {
      handleError(err, opts.debug);
    }
  });

// Sync command
program
  .command("sync")
  .description("Sync missing variables from .env.example into your local .env file")
  .action(async () => {
    const opts = program.opts();
    try {
      const exitCode = await runSyncCommand({
        config: opts.config,
        envFile: opts.envFile,
        exampleFile: opts.exampleFile,
        dryRun: opts.dryRun,
        json: opts.json,
        debug: opts.debug
      });
      process.exit(exitCode);
    } catch (err) {
      handleError(err, opts.debug);
    }
  });

// Handle graceful process termination
process.on("SIGINT", () => {
  process.exit(130);
});

process.on("SIGTERM", () => {
  process.exit(143);
});

// Run program
program.parseAsync(process.argv).catch((err) => {
  handleError(err, program.opts().debug);
});
