import { describe, it, expect } from "vitest";
import { parseEnvContent, validateType, validateEnvVariables } from "../src/lib/env-parser.js";

describe("Environment Parser & Validator", () => {
  it("parses diverse .env formats", () => {
    const raw = `
      # Database connection
      PORT=3000
      HOST="localhost"
      export API_KEY='secret-key-123'
      DB_URL=postgres://user:pass@localhost:5432/app?ssl=true # inline comment
      EMPTY_VAL=
      VAL_WITH_EQUALS=base64==value
    `;

    const parsed = parseEnvContent(raw);
    expect(parsed.get("PORT")).toBe("3000");
    expect(parsed.get("HOST")).toBe("localhost");
    expect(parsed.get("API_KEY")).toBe("secret-key-123");
    expect(parsed.get("DB_URL")).toBe("postgres://user:pass@localhost:5432/app?ssl=true");
    expect(parsed.get("EMPTY_VAL")).toBe("");
    expect(parsed.get("VAL_WITH_EQUALS")).toBe("base64==value");
  });

  it("validates data types accurately", () => {
    expect(validateType("3000", "number")).toBe(true);
    expect(validateType("abc", "number")).toBe(false);

    expect(validateType("true", "boolean")).toBe(true);
    expect(validateType("FALSE", "boolean")).toBe(true);
    expect(validateType("1", "boolean")).toBe(true);
    expect(validateType("not-bool", "boolean")).toBe(false);

    expect(validateType("https://api.example.com", "url")).toBe(true);
    expect(validateType("invalid-url", "url")).toBe(false);

    expect(validateType("test@example.com", "email")).toBe(true);
    expect(validateType("bad-email@", "email")).toBe(false);
  });

  it("identifies missing and empty variables against example template", () => {
    const actual = new Map<string, string>([
      ["PORT", "3000"],
      ["DATABASE_URL", ""]
    ]);

    const example = new Map<string, string>([
      ["PORT", "8080"],
      ["DATABASE_URL", "postgres://..."],
      ["API_SECRET", "xyz"]
    ]);

    const issues = validateEnvVariables({
      actual,
      example,
      types: {
        PORT: "number"
      }
    });

    expect(issues).toHaveLength(2);
    // DATABASE_URL is empty
    expect(issues.some((i) => i.key === "DATABASE_URL" && i.type === "empty")).toBe(true);
    // API_SECRET is missing
    expect(issues.some((i) => i.key === "API_SECRET" && i.type === "missing")).toBe(true);
  });
});
