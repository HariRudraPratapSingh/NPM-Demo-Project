import { describe, it, expect } from "vitest";
import net from "node:net";
import { isPortAvailable, checkPortRequirement } from "../src/lib/ports.js";

describe("Port Checker", () => {
  it("detects when an unused port is available", async () => {
    const available = await isPortAvailable(49152);
    expect(available).toBe(true);
  });

  it("detects when a port is actively occupied", async () => {
    const testPort = 49153;
    const server = net.createServer();

    await new Promise<void>((resolve) => {
      server.listen(testPort, "127.0.0.1", () => resolve());
    });

    try {
      const available = await isPortAvailable(testPort);
      expect(available).toBe(false);

      const check = await checkPortRequirement({
        port: testPort,
        expectedStatus: "free"
      });
      expect(check.status).toBe("fail");
      expect(check.actual).toBe("in-use");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
