import { promises as fs } from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { CLIOptions } from "../lib/types.js";
import { readEnvFile } from "../lib/env-parser.js";
import { loadConfig } from "../lib/config.js";

export async function runSyncCommand(options: CLIOptions): Promise<number> {
  const cwd = process.cwd();
  const { config } = await loadConfig(options.config, cwd);

  const envFile = options.envFile || config.env?.files?.[0] || ".env";
  const exampleFile = options.exampleFile || config.env?.exampleFiles?.[0] || ".env.example";

  const examplePath = path.resolve(cwd, exampleFile);
  const envPath = path.resolve(cwd, envFile);

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
      console.error(pc.red(`\n✖ Could not find example file '${exampleFile}' to sync from.\n`));
    }
    return 1;
  }

  const currentMap = (await readEnvFile(envPath)) || new Map<string, string>();
  const missingKeys: Array<{ key: string; defaultValue: string }> = [];

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
      console.log(pc.green(`\n✔ '${envFile}' is already up-to-date with '${exampleFile}'.\n`));
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
        pc.cyan(
          `\n[DRY RUN] Would append ${missingKeys.length} missing variable(s) to '${envFile}':`
        )
      );
      for (const item of missingKeys) {
        console.log(`  ${pc.bold("+")} ${item.key}=${item.defaultValue}`);
      }
      console.log();
    }
    return 0;
  }

  // Append missing keys
  let existingContent = "";
  try {
    existingContent = await fs.readFile(envPath, "utf-8");
  } catch {
    // If .env doesn't exist yet, we create it
  }

  const additions: string[] = [];
  if (existingContent && !existingContent.endsWith("\n")) {
    additions.push("\n");
  }

  additions.push(`# --- Synced from ${exampleFile} on ${new Date().toISOString()} ---`);
  for (const item of missingKeys) {
    additions.push(`${item.key}=${item.defaultValue}`);
  }
  additions.push("");

  const newContent = existingContent + additions.join("\n");
  await fs.writeFile(envPath, newContent, "utf-8");

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
      pc.green(`\n✔ Synced ${missingKeys.length} missing variable(s) into '${envFile}':`)
    );
    for (const item of missingKeys) {
      console.log(`  ${pc.green("+")} ${item.key}`);
    }
    console.log();
  }

  return 0;
}
