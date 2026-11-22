# PreFlight Sentinel ⚡
### Real-Time Pre-Flight Environment Validator Prototype

A production-ready prototype demonstrating the practical usage of the **`env-checker`** NPM package ([GitHub Repository: HariRudraPratapSingh/NPM-Package-](https://github.com/HariRudraPratapSingh/NPM-Package-)).

---

## 💡 Overview

Modern development teams lose valuable time debugging issues caused by *"works on my machine"* syndrome: missing `.env` keys after branch merges, wrong Node.js versions, uninstalled global binaries (`git`, `docker`), or port collisions.

This prototype demonstrates how **`env-checker`** solves these challenges across two critical workflows:
1. **Startup Gatekeeper (Fail-Fast Engine)**: Inspects the system and environment before server initialization. If requirements are not satisfied, it emits clear diagnostics and prevents broken boots.
2. **Interactive Web Diagnostic Dashboard**: A live browser dashboard (`http://localhost:3000`) providing real-time telemetry, live configuration inspection, one-click `.env` synchronization, and an interactive **Fault Injection Playground**.

---

## 🌟 Key Features

- **Runtime Semver Validation**: Guarantees Node.js matches requirements (`>=18.0.0`).
- **Strict Environment Typing**: Validates `.env` variables against schema-defined types:
  - `number` (e.g., `PORT=3000`)
  - `url` (e.g., `DATABASE_URL=postgres://...`)
  - `email` (e.g., `ADMIN_EMAIL=devops@...`)
  - `boolean` (e.g., `ENABLE_ANALYTICS=true`)
  - `string` (e.g., `JWT_SECRET=...`)
- **System Binary Detection**: Verifies presence of CLI tools in `$PATH` (`git`, `node`, `docker`).
- **TCP Port Scanner**: Validates that required ports are available before binding.
- **Auto-Sync (`env-check sync`)**: Synchronizes missing keys from `.env.example` into `.env` automatically without overwriting existing secrets.
- **Fault Injection Simulator**: Interactive UI buttons to break variables and watch `env-checker` detect the disparity in real-time.
- **Dual Interface**: Full programmatic JavaScript/TypeScript API (`import { ... } from "env-checker"`) and CLI binary (`env-check`, `env-check --json`, `env-check --strict`).

---

## 📁 Project Structure

```text
.
├── .envcheck.json           # env-checker enforcement schema & rules
├── .env.example             # Clean template configuration
├── .env                     # Local active environment variables
├── package.json             # Scripts & dependency definitions
├── packages/
│   └── env-checker/         # The env-checker npm package (TypeScript source & compiled dist)
├── public/
│   └── index.html           # Interactive real-time diagnostic dashboard
├── src/
│   ├── gatekeeper.js        # Programmatic integration with env-checker
│   └── server.js            # Express application with startup gatekeeper
├── test/
│   └── app.test.js          # Automated test suite
└── README.md                # Project documentation
```

---

## 🚀 Quick Start

### 1. Run Automated Tests
Verify both programmatic and CLI capabilities of `env-checker`:
```bash
npm test
```

### 2. Run Pre-Flight Verification via CLI
```bash
# Standard terminal report
npm run env:check

# Machine-readable JSON output (ideal for CI/CD)
npm run env:check:json

# Strict mode (treats warnings as exit code 1)
npm run env:check:strict
```

### 3. Launch the Prototype Web Application
```bash
npm start
```
> Notice how the startup gatekeeper automatically audits your environment in terminal before opening `http://localhost:3000`!

Open your browser to:
**[http://localhost:3000](http://localhost:3000)**

---

## 🧪 Interactive Fault Injection Playground

Inside the web dashboard, test `env-checker`'s detection speed and accuracy using the built-in simulator:

1. **Click "Delete DATABASE_URL"**: Notice the status immediately changes to **FAIL** with an exact description of the missing secret.
2. **Click "Corrupt PORT"**: Sets `PORT=three-thousand`. `env-checker` flags a type mismatch error: *Variable 'PORT' must be of type 'number'*.
3. **Click "Corrupt DB Protocol"**: Sets an invalid URL string. `env-checker` flags *Variable 'DATABASE_URL' must be of type 'url'*.
4. **Click "Auto-Sync .env"**: Triggers `env-check sync` to repair missing keys from `.env.example`.
5. **Click "Restore Defaults"**: Restores `.env` to the initial clean baseline.

---

## 💻 Programmatic Usage Example

```javascript
import {
  checkNodeVersion,
  readEnvFile,
  validateEnvVariables,
  runSyncCommand
} from "env-checker";

// 1. Verify Node Runtime
const nodeCheck = checkNodeVersion(">=18.0.0");
console.log(nodeCheck.status); // "pass"

// 2. Validate .env against rules
const env = await readEnvFile(".env");
const issues = validateEnvVariables({
  actual: env,
  required: ["DATABASE_URL", "PORT"],
  types: {
    PORT: "number",
    DATABASE_URL: "url"
  }
});

if (issues.length > 0) {
  console.error("Environment issues detected:", issues);
}

// 3. Auto-sync missing keys
await runSyncCommand();
```

---

## 📜 NPM Package Reference

- **Package Source**: [HariRudraPratapSingh/NPM-Package-](https://github.com/HariRudraPratapSingh/NPM-Package-)
- **Package Name**: `env-checker`
- **CLI Commands**: `env-check [check|init|sync]`
