import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { sanitizeDiagnosticText } from "../../../stop-game/src/lib/diagnosticPrivacy";

const currentDir = dirname(fileURLToPath(import.meta.url));
const mainSource = readFileSync(
  resolve(currentDir, "../../../stop-game/src/main.tsx"),
  "utf8",
);

describe("browser network failure diagnostics", () => {
  it("captures unhandled fetch failures with their original stack", () => {
    expect(mainSource).toContain('window.addEventListener("unhandledrejection"');
    expect(mainSource).toContain("reportUnexpectedNetworkFailure(event.reason");
    expect(mainSource).toContain("trackClientError(safeValue, null");
    expect(mainSource).toContain('phase: "global_network_failure"');
  });

  it("captures rejected fetch URLs without changing the original rejection", () => {
    expect(mainSource).toContain("const nativeFetch = window.fetch.bind(window)");
    expect(mainSource).toContain("window.fetch = (input: RequestInfo | URL");
    expect(mainSource).toContain('source: "fetch_rejection"');
    expect(mainSource).toContain("resource_url: requestUrl");
    expect(mainSource).toContain("throw error;");
    expect(mainSource).toContain('parsed.pathname === "/api/analytics/client-error"');
  });

  it("captures resource load location without recording query strings", () => {
    expect(mainSource).toContain('window.addEventListener("error"');
    expect(mainSource).toContain("parsed.origin + parsed.pathname");
    expect(mainSource).toContain("filename: sanitizeDiagnosticText(event.filename)");
    expect(mainSource).toContain("safeValue.stack = sanitizeDiagnosticText(value.stack)");
    expect(mainSource).not.toContain("resource_url: rawUrl");
    expect(mainSource).toContain("resource_tag: target.tagName.toLowerCase()");
  });

  it("deduplicates repeated browser errors and bounds in-memory diagnostics", () => {
    expect(mainSource).toContain("reportedNetworkFailures.has(signature)");
    expect(mainSource).toContain("reportedNetworkFailures.size > 50");
  });
});


describe("diagnostic URL privacy", () => {
  it("removes query strings and fragments from URLs in filenames and stacks", () => {
    expect(sanitizeDiagnosticText("https://cdn.example/app.js?token=secret#chunk"))
      .toBe("https://cdn.example/app.js");
    expect(sanitizeDiagnosticText("Error at https://cdn.example/app.js?sig=secret:12:4"))
      .toBe("Error at https://cdn.example/app.js");
  });

  it("preserves useful paths and returns null for missing locations", () => {
    expect(sanitizeDiagnosticText("https://cdn.example/assets/game.js"))
      .toBe("https://cdn.example/assets/game.js");
    expect(sanitizeDiagnosticText(null)).toBeNull();
  });
});
