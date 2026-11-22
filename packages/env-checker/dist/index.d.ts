type CheckStatus = "pass" | "fail" | "warn" | "skip";
type CheckCategory = "node" | "packageManager" | "env" | "binary" | "port";
interface CheckItem {
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
interface CheckSummary {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    skipped: number;
}
interface CheckResult {
    success: boolean;
    timestamp: string;
    durationMs: number;
    summary: CheckSummary;
    checks: CheckItem[];
    dryRun?: boolean;
}
interface BinaryRequirement {
    name: string;
    version?: string;
    flag?: string;
    optional?: boolean;
    message?: string;
}
interface PortRequirement {
    port: number;
    host?: string;
    description?: string;
    expectedStatus?: "free" | "in-use";
}
interface EnvValidationOptions {
    files?: string[];
    exampleFiles?: string[];
    required?: string[];
    types?: Record<string, "string" | "number" | "boolean" | "url" | "email">;
    allowEmpty?: boolean;
}
interface EnvCheckConfig {
    $schema?: string;
    node?: string;
    packageManager?: string | {
        name: string;
        version?: string;
    };
    env?: EnvValidationOptions;
    binaries?: BinaryRequirement[];
    ports?: PortRequirement[];
}
interface CLIOptions {
    config?: string;
    envFile?: string;
    exampleFile?: string;
    dryRun?: boolean;
    json?: boolean;
    strict?: boolean;
    debug?: boolean;
}

declare class EnvCheckError extends Error {
    readonly exitCode: number;
    readonly code: string;
    constructor(message: string, code?: string, exitCode?: number);
}
declare function handleError(error: unknown, debug?: boolean): void;

interface ParsedVersion {
    major: number;
    minor: number;
    patch: number;
    raw: string;
}
declare function extractVersion(raw: string): string | null;
declare function parseSemver(input: string): ParsedVersion | null;
declare function compareSemver(a: string | ParsedVersion, b: string | ParsedVersion): number;
declare function satisfiesRange(versionStr: string, rangeStr: string): boolean;

interface EnvEntry {
    key: string;
    value: string;
    comment?: string;
    line: number;
}
interface EnvValidationIssue {
    key: string;
    type: "missing" | "empty" | "invalid_type";
    expected?: string;
    actual?: string;
    message: string;
}
declare function parseEnvContent(content: string): Map<string, string>;
declare function readEnvFile(filePath: string): Promise<Map<string, string> | null>;
declare function validateType(value: string, type: "string" | "number" | "boolean" | "url" | "email"): boolean;
declare function validateEnvVariables(options: {
    actual: Map<string, string>;
    example?: Map<string, string>;
    required?: string[];
    types?: Record<string, "string" | "number" | "boolean" | "url" | "email">;
    allowEmpty?: boolean;
}): EnvValidationIssue[];

declare function checkNodeVersion(requiredRange?: string): CheckItem;
declare function detectPackageManager(): {
    name: string;
    version?: string;
};
declare function checkPackageManagerRequirement(required?: string | {
    name: string;
    version?: string;
}): CheckItem | null;
declare function checkBinaryRequirement(req: BinaryRequirement): CheckItem;

declare function isPortAvailable(port: number, host?: string, timeoutMs?: number): Promise<boolean>;
declare function checkPortRequirement(req: PortRequirement): Promise<CheckItem>;

declare function findConfigFile(cwd: string): Promise<string | null>;
declare function inferProjectConfig(cwd: string): Promise<EnvCheckConfig>;
declare function loadConfig(customConfigPath?: string, cwd?: string): Promise<{
    config: EnvCheckConfig;
    configPath: string | null;
    isAutoInferred: boolean;
}>;

declare function getStatusBadge(status: CheckStatus): string;
declare function renderHumanReport(result: CheckResult, dryRun?: boolean): string;
declare function renderJsonReport(result: CheckResult): string;

declare function runCheckCommand(options: CLIOptions): Promise<number>;

interface InitOptions extends CLIOptions {
    force?: boolean;
}
declare function runInitCommand(options: InitOptions): Promise<number>;

declare function runSyncCommand(options: CLIOptions): Promise<number>;

export { type BinaryRequirement, type CLIOptions, type CheckCategory, type CheckItem, type CheckResult, type CheckStatus, type CheckSummary, type EnvCheckConfig, EnvCheckError, type EnvEntry, type EnvValidationIssue, type EnvValidationOptions, type ParsedVersion, type PortRequirement, checkBinaryRequirement, checkNodeVersion, checkPackageManagerRequirement, checkPortRequirement, compareSemver, detectPackageManager, extractVersion, findConfigFile, getStatusBadge, handleError, inferProjectConfig, isPortAvailable, loadConfig, parseEnvContent, parseSemver, readEnvFile, renderHumanReport, renderJsonReport, runCheckCommand, runInitCommand, runSyncCommand, satisfiesRange, validateEnvVariables, validateType };
