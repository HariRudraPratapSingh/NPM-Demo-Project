import { describe, it, expect } from "vitest";
import { parseSemver, extractVersion, compareSemver, satisfiesRange } from "../src/lib/semver.js";

describe("Semver Utility", () => {
  it("extracts versions from CLI output", () => {
    expect(extractVersion("v20.10.0")).toBe("20.10.0");
    expect(extractVersion("git version 2.39.5 (Apple Git-154)")).toBe("2.39.5");
    expect(extractVersion("Docker version 24.0.7, build afdd53b")).toBe("24.0.7");
    expect(extractVersion("npm 10.2.4")).toBe("10.2.4");
    expect(extractVersion("no version here")).toBeNull();
  });

  it("parses semver strings accurately", () => {
    expect(parseSemver("18.0.0")).toEqual({ major: 18, minor: 0, patch: 0, raw: "18.0.0" });
    expect(parseSemver("v20.11.2")).toEqual({ major: 20, minor: 11, patch: 2, raw: "v20.11.2" });
    expect(parseSemver("18")).toEqual({ major: 18, minor: 0, patch: 0, raw: "18" });
  });

  it("compares semver versions correctly", () => {
    expect(compareSemver("18.0.0", "20.0.0")).toBe(-1);
    expect(compareSemver("20.0.0", "18.0.0")).toBe(1);
    expect(compareSemver("18.5.1", "18.5.1")).toBe(0);
    expect(compareSemver("18.5.2", "18.5.1")).toBe(1);
    expect(compareSemver("18.5.0", "18.6.0")).toBe(-1);
  });

  it("evaluates semver ranges correctly", () => {
    // Greater-than / equal ranges
    expect(satisfiesRange("18.19.0", ">=18.0.0")).toBe(true);
    expect(satisfiesRange("16.20.0", ">=18.0.0")).toBe(false);

    // Bounded ranges
    expect(satisfiesRange("20.9.0", ">=18.0.0 <22.0.0")).toBe(true);
    expect(satisfiesRange("22.1.0", ">=18.0.0 <22.0.0")).toBe(false);

    // Caret ranges
    expect(satisfiesRange("18.2.0", "^18.0.0")).toBe(true);
    expect(satisfiesRange("19.0.0", "^18.0.0")).toBe(false);

    // Tilde ranges
    expect(satisfiesRange("18.1.5", "~18.1.0")).toBe(true);
    expect(satisfiesRange("18.2.0", "~18.1.0")).toBe(false);

    // Wildcards
    expect(satisfiesRange("18.5.0", "18.x")).toBe(true);
    expect(satisfiesRange("20.0.0", "18.x")).toBe(false);

    // OR branches
    expect(satisfiesRange("18.18.0", "18.x || 20.x")).toBe(true);
    expect(satisfiesRange("20.10.0", "18.x || 20.x")).toBe(true);
    expect(satisfiesRange("22.0.0", "18.x || 20.x")).toBe(false);
  });
});
