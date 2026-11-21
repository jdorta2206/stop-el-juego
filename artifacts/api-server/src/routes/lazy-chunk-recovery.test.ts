import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const appSource = readFileSync(
  resolve(currentDir, "../../../stop-game/src/App.tsx"),
  "utf8",
);
const errorBoundarySource = readFileSync(
  resolve(currentDir, "../../../stop-game/src/components/ErrorBoundary.tsx"),
  "utf8",
);

describe("lazy chunk recovery guards", () => {
  it("resets one-shot guards only after the lazy route subtree commits", () => {
    const suspenseStart = appSource.indexOf("<Suspense fallback=");
    const suspenseEnd = appSource.indexOf("</Suspense>", suspenseStart);
    expect(suspenseStart).toBeGreaterThanOrEqual(0);
    expect(suspenseEnd).toBeGreaterThan(suspenseStart);

    const suspenseContent = appSource.slice(suspenseStart, suspenseEnd);
    const routerIndex = suspenseContent.indexOf("<Router />");
    const resetIndex = suspenseContent.indexOf("<ChunkRecoveryReset />");

    expect(appSource).toContain("function ChunkRecoveryReset()");
    expect(suspenseContent).toContain("<Router />");
    expect(suspenseContent).toContain("<ChunkRecoveryReset />");
    expect(resetIndex).toBeGreaterThan(routerIndex);
    expect(appSource).toContain('sessionStorage.removeItem("stop_chunk_recovery_once")');
    expect(appSource).toContain('sessionStorage.removeItem("stop_lazy_default_boundary_recovery_once")');
  });

  it("lets the manual recovery action retry both automatic recovery paths", () => {
    expect(errorBoundarySource).toContain('sessionStorage.removeItem("stop_chunk_recovery_once")');
    expect(errorBoundarySource).toContain("sessionStorage.removeItem(LAZY_DEFAULT_RECOVERY_KEY)");
  });
});
