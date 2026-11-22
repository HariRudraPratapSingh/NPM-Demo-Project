import { promises as fs } from "node:fs";
import path from "node:path";

export interface EnvEntry {
  key: string;
  value: string;
  comment?: string;
  line: number;
}

export interface EnvValidationIssue {
  key: string;
  type: "missing" | "empty" | "invalid_type";
  expected?: string;
  actual?: string;
  message: string;
}

export function parseEnvContent(content: string): Map<string, string> {
  const result = new Map<string, string>();
  const lines = content.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i].trim();
    if (!rawLine || rawLine.startsWith("#")) {
      continue;
    }

    // Strip leading 'export ' if present
    let line = rawLine;
    if (line.startsWith("export ")) {
      line = line.slice(7).trim();
    }

    const eqIdx = line.indexOf("=");
    if (eqIdx === -1) {
      // Key with no value
      const key = line.trim();
      if (key) {
        result.set(key, "");
      }
      continue;
    }

    const key = line.slice(0, eqIdx).trim();
    let value = line.slice(eqIdx + 1).trim();

    // Handle quoted values
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      // Strip trailing inline comments if not quoted
      const commentIdx = value.indexOf(" #");
      if (commentIdx !== -1) {
        value = value.slice(0, commentIdx).trim();
      }
    }

    if (key) {
      result.set(key, value);
    }
  }

  return result;
}

export async function readEnvFile(filePath: string): Promise<Map<string, string> | null> {
  try {
    const content = await fs.readFile(path.resolve(filePath), "utf-8");
    return parseEnvContent(content);
  } catch {
    return null;
  }
}

export function validateType(
  value: string,
  type: "string" | "number" | "boolean" | "url" | "email"
): boolean {
  if (!value) return false;

  switch (type) {
    case "string":
      return value.trim().length > 0;
    case "number":
      return !isNaN(Number(value)) && !isNaN(parseFloat(value));
    case "boolean":
      return ["true", "false", "1", "0"].includes(value.toLowerCase().trim());
    case "url":
      try {
        const u = new URL(value);
        return Boolean(u.protocol);
      } catch {
        return false;
      }
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
    default:
      return true;
  }
}

export function validateEnvVariables(options: {
  actual: Map<string, string>;
  example?: Map<string, string>;
  required?: string[];
  types?: Record<string, "string" | "number" | "boolean" | "url" | "email">;
  allowEmpty?: boolean;
}): EnvValidationIssue[] {
  const issues: EnvValidationIssue[] = [];
  const { actual, example, required = [], types = {}, allowEmpty = false } = options;

  // 1. Check all required keys
  const keysToCheck = new Set<string>(required);
  if (example) {
    for (const key of example.keys()) {
      keysToCheck.add(key);
    }
  }

  for (const key of keysToCheck) {
    if (!actual.has(key)) {
      issues.push({
        key,
        type: "missing",
        message: `Variable '${key}' is missing from .env`
      });
      continue;
    }

    const val = actual.get(key) ?? "";
    if (!allowEmpty && val.trim() === "") {
      issues.push({
        key,
        type: "empty",
        message: `Variable '${key}' is defined but empty`
      });
      continue;
    }

    // 2. Check types
    const expectedType = types[key];
    if (expectedType && val.trim() !== "") {
      const isValid = validateType(val, expectedType);
      if (!isValid) {
        issues.push({
          key,
          type: "invalid_type",
          expected: expectedType,
          actual: val,
          message: `Variable '${key}' must be of type '${expectedType}' (found '${val}')`
        });
      }
    }
  }

  return issues;
}
