import { describe, it, expect } from "vitest";
import { checkNodeVersion, checkBinaryRequirement } from "../src/lib/system.js";

describe("System & Binary Verification", () => {
  it("verifies current Node.js runtime against required range", () => {
    const passCheck = checkNodeVersion(">=18.0.0");
    expect(passCheck.status).toBe("pass");

    const failCheck = checkNodeVersion("<12.0.0");
    expect(failCheck.status).toBe("fail");
  });

  it("checks for existing binary in PATH", () => {
    const check = checkBinaryRequirement({
      name: "node",
      flag: "-v",
      version: ">=18.0.0"
    });
    expect(check.status).toBe("pass");
  });

  it("handles missing binaries gracefully with optional flag", () => {
    const missingOptional = checkBinaryRequirement({
      name: "non_existent_binary_xyz_123",
      optional: true
    });
    expect(missingOptional.status).toBe("warn");

    const missingRequired = checkBinaryRequirement({
      name: "non_existent_binary_xyz_123",
      optional: false
    });
    expect(missingRequired.status).toBe("fail");
  });
});
