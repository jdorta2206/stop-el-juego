import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const mainSource = readFileSync(
  resolve(currentDir, "../../../stop-game/src/main.tsx"),
  "utf8",
);

describe("browser network failure diagnostics", () => {
  it("captures unhandled fetch failures with their original stack", () => {
    expect(mainSource).toContain('window.addEventListener("unhandledrejection"');
    expect(mainSource).toContain("reportUnexpectedNetworkFailure(event.reason");
    expect(mainSource).toContain("trackClientError(value, null");
    expect(mainSource).toContain('phase: "global_network_failure"');
  });

  it("captures resource load location without recording query strings", () => {
    expect(mainSource).toContain('window.addEventListener("error"');
    expect(mainSource).toContain("parsed.origin + parsed.pathname");
    expect(mainSource).not.toContain("resource_url: rawUrl");
    expect(mainSource).toContain("resource_tag: target.tagName.toLowerCase()");
  });

  it("deduplicates repeated browser errors and bounds in-memory diagnostics", () => {
    expect(mainSource).toContain("reportedNetworkFailures.has(signature)");
    expect(mainSource).toContain("reportedNetworkFailures.size > 50");
  });
});
