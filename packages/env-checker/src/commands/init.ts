import { promises as fs } from "node:fs";
import path from "node:path";
import pc from "picocolors";
import { CLIOptions } from "../lib/types.js";
import { inferProjectConfig, findConfigFile } from "../lib/config.js";

export interface InitOptions extends CLIOptions {
  force?: boolean;
}

export async function runInitCommand(options: InitOptions): Promise<number> {
  const cwd = process.cwd();
  const existingConfig = await findConfigFile(cwd);

  if (existingConfig && !options.force) {
    if (options.json) {
      console.log(
        JSON.stringify({
          success: false,
          message: `Config file already exists at '${existingConfig}'. Use --force to overwrite.`
        })
      );
    } else {
      console.error(
        pc.yellow(
          `\n⚠ Config file already exists at '${existingConfig}'. Use --force to overwrite.\n`
        )
      );
    }
    return 1;
  }

  const generated = await inferProjectConfig(cwd);
  const targetPath = path.resolve(cwd, ".envcheck.json");
  const formatted = JSON.stringify(generated, null, 2) + "\n";

  if (options.dryRun) {
    if (options.json) {
      console.log(
        JSON.stringify({
          dryRun: true,
          targetPath,
          config: generated
        })
      );
    } else {
      console.log(pc.cyan("\n[DRY RUN] Would write the following config to: ") + targetPath);
      console.log(formatted);
    }
    return 0;
  }

  await fs.writeFile(targetPath, formatted, "utf-8");

  if (options.json) {
    console.log(
      JSON.stringify({
        success: true,
        targetPath,
        config: generated
      })
    );
  } else {
    console.log(pc.green(`\n✔ Created '.envcheck.json' successfully!`));
    console.log(pc.dim("  Run 'env-check' or 'npx env-check' to validate your environment.\n"));
  }

  return 0;
}
