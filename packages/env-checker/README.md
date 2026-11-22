# env-checker ⚡

> Production-grade pre-flight environment validator: check Node.js versions, `.env` files, system binaries, and port availability before running or deploying applications.

[![CI](https://github.com/HariRudraPratapSingh/NPM-Package-/actions/workflows/ci.yml/badge.svg)](https://github.com/HariRudraPratapSingh/NPM-Package-/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/env-checker.svg)](https://www.npmjs.com/package/env-checker)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js Version](https://img.shields.io/node/v/env-checker.svg)](https://nodejs.org)

---

## The Problem

Every engineering team has lost hours to the classic *"works on my machine"* trap during developer onboarding, CI pipeline setup, or local branch switching:

- **Missing or Empty Secrets**: A newly committed feature requires a new API key in `.env.example`, but existing developers crash at runtime because their local `.env` was never updated.
- **Node.js Runtime Mismatches**: A developer runs Node v16 or v22 on a project strictly requiring `>=18.0.0 <21.0.0`, triggering subtle runtime syntax bugs.
- **Missing Global Binaries**: The app requires `git`, `docker`, or `pnpm` in `$PATH`, but fails midway through execution with cryptic child process errors.
- **Port Collisions**: Port `3000` or `5432` is already silently occupied by a zombie process or local database instance.

Existing tools only solve small pieces (e.g., `dotenv-safe` only validates environment files, bash scripts break on Windows, and manual checklists are forgotten).

**`env-checker` provides a single, lightning-fast, zero-config cross-platform CLI that validates your entire environment in milliseconds.**

---

## Features

- 🚀 **Zero-Config by Default**: Automatically infers requirements from `package.json` (`engines`, `packageManager`), `.nvmrc`, and `.env.example`.
- 🔍 **4-Pillar Verification**:
  1. **Runtime**: Node.js semver compatibility check.
  2. **Package Manager**: npm, pnpm, yarn, or bun detection and version enforcement.
  3. **Environment Variables**: `.env` vs `.env.example` disparity checking, missing variable alerts, and type validation (`string`, `number`, `boolean`, `url`, `email`).
  4. **System Binaries**: Verifies required CLI tools exist in `$PATH` with optional semver constraints.
  5. **Network Ports**: TCP port availability scanner using non-intrusive Node sockets.
- 🔄 **One-Command Auto-Sync**: Sync missing keys from `.env.example` into `.env` with `env-check sync`.
- 🤖 **Machine-Readable**: Full `--json` support for CI/CD pipelines, devcontainers, and automation scripts.
- 🛡️ **Cross-Platform**: Tested and verified on macOS, Linux, and Windows.
- 🎨 **Graceful UX**: Supports `NO_COLOR`, detects TTY capabilities, and avoids raw stack traces unless `--debug` is explicitly passed.

---

## Installation

### Run instantly with `npx` (No installation required)

```bash
npx env-check
```

### Install globally

```bash
npm install -g env-checker
# or
pnpm add -g env-checker
# or
yarn global add env-checker
```

### Add to your project (Recommended for teams)

```bash
npm install --save-dev env-checker
```

Add a pre-dev or pre-flight script to your `package.json`:

```json
{
  "scripts": {
    "predev": "env-check",
    "dev": "next dev",
    "prebuild": "env-check --strict"
  }
}
```

---

## Quick Start & Usage

### 1. Validate Environment (`env-check` or `env-check check`)

Run the pre-flight verification in any repository:

```bash
env-check
```

#### Sample Terminal Output:

```text
⚡ env-checker Pre-flight System Verification
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Runtime Environment
  ✔ Node.js Runtime: Node.js v20.10.0 satisfies '>=18.0.0'

Package Manager
  ✔ Package Manager: Package manager is pnpm v8.15.0

Environment Variables
  ✖ Environment File (.env): Found 2 variable issue(s)
      • Variable 'STRIPE_SECRET_KEY' is missing from .env
      • Variable 'PORT' must be of type 'number' (found 'three-thousand')
      ↳ Review your '.env' against '.env.example'.

System Binaries & Tools
  ✔ CLI Tool: git: Found 'git' in PATH (2.39.5)
  ✔ CLI Tool: docker: Found 'docker' in PATH (24.0.7)

Network Ports
  ✔ Port 3000: Port 3000 is free as expected

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Summary: 5 passed, 1 failed, 0 warnings (total 6 checks, 42ms)

✖ Pre-flight verification failed. Fix the issues above.
```

Exit code: `1` on failure, `0` on success.

---

### 2. Synchronize `.env` with `.env.example` (`env-check sync`)

Appends any missing variables from `.env.example` into your local `.env`:

```bash
# Preview what would be synced without modifying files
env-check sync --dry-run

# Apply sync
env-check sync
```

Output:

```text
✔ Synced 2 missing variable(s) into '.env':
  + STRIPE_SECRET_KEY
  + REDIS_URL
```

---

### 3. Generate Project Configuration (`env-check init`)

Bootstrap an `.envcheck.json` file tailored to your current project:

```bash
env-check init
```

Use `--dry-run` to preview the generated config without writing:

```bash
env-check init --dry-run
```

---

## Command-Line Flags

| Flag | Description | Default |
| --- | --- | --- |
| `-c, --config <path>` | Path to custom configuration file | Auto-detected |
| `-e, --env-file <path>` | Path to target `.env` file | `.env` |
| `-x, --example-file <path>` | Path to template `.env.example` file | `.env.example` |
| `--dry-run` | Simulate execution without modifying any files | `false` |
| `--json` | Format output as machine-readable JSON | `false` |
| `--strict` | Treat warnings as failures (returns exit code 1) | `false` |
| `--debug` | Show raw stack traces and debug diagnostics on errors | `false` |
| `-v, --version` | Display current CLI version | — |
| `-h, --help` | Display command help and available options | — |

---

## Configuration Reference (`.envcheck.json`)

While `env-checker` works zero-config, you can create an `.envcheck.json` for fine-grained enforcement:

```json
{
  "$schema": "https://raw.githubusercontent.com/rangxr/env-checker/main/schema.json",
  "node": ">=18.0.0 <23.0.0",
  "packageManager": "pnpm@>=8.0.0",
  "env": {
    "files": [".env"],
    "exampleFiles": [".env.example"],
    "required": ["DATABASE_URL", "JWT_SECRET", "PORT"],
    "types": {
      "PORT": "number",
      "DATABASE_URL": "url",
      "ADMIN_EMAIL": "email",
      "ENABLE_ANALYTICS": "boolean"
    },
    "allowEmpty": false
  },
  "binaries": [
    { "name": "git", "version": ">=2.20.0" },
    { "name": "docker", "optional": true, "message": "Docker is recommended for local database containers" }
  ],
  "ports": [
    { "port": 3000, "description": "Local Web App", "expectedStatus": "free" },
    { "port": 5432, "description": "PostgreSQL", "expectedStatus": "free" }
  ]
}
```

### Supported Variable Types:
- `string`: Non-empty string.
- `number`: Valid numerical value (integer or float).
- `boolean`: `"true"`, `"false"`, `"1"`, or `"0"`.
- `url`: Valid URL with protocol (e.g., `postgres://...` or `https://...`).
- `email`: Standard email address format.

---

## Machine-Readable JSON Mode (`--json`)

Perfect for CI steps or integration with other dev tools:

```bash
env-check --json
```

```json
{
  "success": false,
  "timestamp": "2026-11-22T22:30:00.000Z",
  "durationMs": 35,
  "summary": {
    "total": 5,
    "passed": 4,
    "failed": 1,
    "warnings": 0,
    "skipped": 0
  },
  "checks": [
    {
      "id": "runtime-node",
      "category": "node",
      "title": "Node.js Runtime",
      "status": "pass",
      "message": "Node.js v20.10.0 satisfies '>=18.0.0'",
      "expected": ">=18.0.0",
      "actual": "v20.10.0"
    },
    {
      "id": "env-vars-.env",
      "category": "env",
      "title": "Environment File (.env)",
      "status": "fail",
      "message": "Found 1 variable issue(s)",
      "details": ["Variable 'DATABASE_URL' is missing from .env"],
      "help": "Review your '.env' against '.env.example'."
    }
  ],
  "dryRun": false
}
```

---

## Programmatic API

You can also use `env-checker` as a TypeScript / JavaScript module:

```typescript
import {
  loadConfig,
  checkNodeVersion,
  validateEnvVariables,
  readEnvFile,
  runCheckCommand
} from "env-checker";

// Run complete check programmatically
const exitCode = await runCheckCommand({ json: true, strict: true });

// Or use individual validation primitives
const envVars = await readEnvFile(".env");
const nodeCheck = checkNodeVersion(">=18.0.0");
console.log(nodeCheck.status); // "pass" | "fail"
```

---

## Frequently Asked Questions (FAQ)

#### Q: How does this compare to `dotenv-safe`?
`dotenv-safe` only verifies `.env` keys at application runtime inside Node.js. `env-checker` is a complete pre-flight CLI that checks your entire environment before anything runs: Node version, package manager, CLI binaries (like docker, git), port availability, and `.env` variables with type enforcement.

#### Q: Does `env-checker` send any environment variables over the network?
**Never.** `env-checker` runs 100% locally on your machine. No telemetry, no network calls, and no data leaves your workstation.

#### Q: How does it handle Windows?
`env-checker` uses Node's standard `path` resolution, handles Windows line endings (`\r\n`), checks executables via Windows command shells, and adapts Unicode status icons when running in legacy Windows consoles.

#### Q: How do I disable colors in CI?
`env-checker` automatically respects the `NO_COLOR` standard and disables formatting when stdout is not a TTY or when `--json` is supplied.

---

## License

[MIT](LICENSE) © Rangxr
