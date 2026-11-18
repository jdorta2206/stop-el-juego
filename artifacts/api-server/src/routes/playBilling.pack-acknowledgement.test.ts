import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const routeSource = readFileSync(resolve(currentDir, "playBilling.ts"), "utf8");
const serviceSource = readFileSync(resolve(currentDir, "../lib/playBillingService.ts"), "utf8");
const clientSource = readFileSync(
  resolve(currentDir, "../../../stop-game/src/lib/playBilling.ts"),
  "utf8",
);

describe("Google Play World Cup pack acknowledgement retry", () => {
  it("grants the pack before attempting acknowledgement", () => {
    const grantIndex = routeSource.indexOf("const grantResult = await grantWorldCupPack(claimedPlayerId)");
    const acknowledgeIndex = routeSource.indexOf("const acknowledged = await acknowledgeProduct(", grantIndex);

    expect(grantIndex).toBeGreaterThanOrEqual(0);
    expect(acknowledgeIndex).toBeGreaterThan(grantIndex);
  });

  it("returns an explicit retryable response when acknowledgement fails after granting", () => {
    const pendingStart = routeSource.indexOf("if (!acknowledged)", routeSource.indexOf('router.post("/verify-pack"'));
    const pendingEnd = routeSource.indexOf("\n    }", pendingStart);
    const pendingBlock = routeSource.slice(pendingStart, pendingEnd);

    expect(pendingBlock).toContain('res.setHeader("Retry-After", "30")');
    expect(pendingBlock).toContain("res.status(503)");
    expect(pendingBlock).toContain("granted: true");
    expect(pendingBlock).toContain("acknowledgementPending: true");
  });

  it("treats an already acknowledged purchase as successful without another API call", () => {
    expect(serviceSource).toContain("if (alreadyAcknowledged) return true;");
  });

  it("reports acknowledgement failure instead of silently treating it as success", () => {
    const start = serviceSource.indexOf("export async function acknowledgeProduct(");
    const end = serviceSource.indexOf("\n}\n", start);
    const acknowledgeBlock = serviceSource.slice(start, end);

    expect(acknowledgeBlock).toContain("return false;");
    expect(acknowledgeBlock).toContain("return true;");
  });

  it("does not consume the permanent pack in the client and accepts granted-but-pending responses", () => {
    expect(clientSource).not.toContain("service.consume");
    expect(clientSource).toContain("data.granted !== true");
    expect(clientSource).toContain("data.acknowledgementPending === true");
    expect(clientSource).toContain('response.complete("success")');
  });
});
