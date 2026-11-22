export type CheckStatus = "pass" | "fail" | "warn" | "skip";

export type CheckCategory = "node" | "packageManager" | "env" | "binary" | "port";

export interface CheckItem {
  id: string;
  category: CheckCategory;
  title: string;
  status: CheckStatus;
  message: string;
  expected?: string;
  actual?: string;
  details?: string[];
  help?: string;
}

export interface CheckSummary {
  total: number;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
}

export interface CheckResult {
  success: boolean;
  timestamp: string;
  durationMs: number;
  summary: CheckSummary;
  checks: CheckItem[];
  dryRun?: boolean;
}

export interface BinaryRequirement {
  name: string;
  version?: string;
  flag?: string;
  optional?: boolean;
  message?: string;
}

export interface PortRequirement {
  port: number;
  host?: string;
  description?: string;
  expectedStatus?: "free" | "in-use";
}

export interface EnvValidationOptions {
  files?: string[];
  exampleFiles?: string[];
  required?: string[];
  types?: Record<string, "string" | "number" | "boolean" | "url" | "email">;
  allowEmpty?: boolean;
}

export interface EnvCheckConfig {
  $schema?: string;
  node?: string;
  packageManager?: string | { name: string; version?: string };
  env?: EnvValidationOptions;
  binaries?: BinaryRequirement[];
  ports?: PortRequirement[];
}

export interface CLIOptions {
  config?: string;
  envFile?: string;
  exampleFile?: string;
  dryRun?: boolean;
  json?: boolean;
  strict?: boolean;
  debug?: boolean;
}
