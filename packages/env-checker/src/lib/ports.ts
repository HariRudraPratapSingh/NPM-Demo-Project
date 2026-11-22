import net from "node:net";
import { PortRequirement, CheckItem } from "./types.js";

export function isPortAvailable(
  port: number,
  host = "127.0.0.1",
  timeoutMs = 1500
): Promise<boolean> {
  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    }, timeoutMs);

    const server = net.createServer();
    server.unref();

    server.once("error", (err: NodeJS.ErrnoException) => {
      clearTimeout(timer);
      if (!resolved) {
        resolved = true;
        resolve(false);
      }
    });

    server.listen(port, host, () => {
      server.close(() => {
        clearTimeout(timer);
        if (!resolved) {
          resolved = true;
          resolve(true);
        }
      });
    });
  });
}

export async function checkPortRequirement(req: PortRequirement): Promise<CheckItem> {
  const host = req.host || "127.0.0.1";
  const expected = req.expectedStatus || "free";
  const available = await isPortAvailable(req.port, host);
  const actual = available ? "free" : "in-use";

  const passed = expected === actual;
  const desc = req.description ? ` (${req.description})` : "";

  return {
    id: `port-${req.port}`,
    category: "port",
    title: `Port ${req.port}${desc}`,
    status: passed ? "pass" : "fail",
    message: passed
      ? `Port ${req.port} is ${actual} as expected`
      : `Port ${req.port} is ${actual}, but expected to be ${expected}`,
    expected,
    actual,
    help:
      !passed && actual === "in-use"
        ? `Kill the process occupying port ${req.port} or reconfigure your application port.`
        : undefined
  };
}
