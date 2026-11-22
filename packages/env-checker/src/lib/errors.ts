import pc from "picocolors";

export class EnvCheckError extends Error {
  public readonly exitCode: number;
  public readonly code: string;

  constructor(message: string, code = "ERR_ENVCHECK", exitCode = 1) {
    super(message);
    this.name = "EnvCheckError";
    this.code = code;
    this.exitCode = exitCode;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function handleError(error: unknown, debug = false): void {
  if (error instanceof EnvCheckError) {
    console.error(pc.red(`\n✖ ${error.message}`));
    if (debug && error.stack) {
      console.error(pc.dim(`\nStack trace:\n${error.stack}`));
    }
    process.exit(error.exitCode);
  }

  if (error instanceof Error) {
    console.error(pc.red(`\n✖ Unexpected error: ${error.message}`));
    if (debug && error.stack) {
      console.error(pc.dim(`\nStack trace:\n${error.stack}`));
    } else {
      console.error(pc.dim("Run with --debug for full stack trace."));
    }
    process.exit(1);
  }

  console.error(pc.red(`\n✖ Unknown error occurred: ${String(error)}`));
  process.exit(1);
}
