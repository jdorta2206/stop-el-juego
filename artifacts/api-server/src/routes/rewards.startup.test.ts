import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const readSource = (relativePath: string) => readFileSync(resolve(currentDir, relativePath), "utf8");
const appSource = readSource("../app.ts");
const routerSource = readSource("./index.ts");
const rewardsSource = readSource("./rewards.ts");

describe("AdMob SSV startup availability", () => {
  it("does not put a blanket indexesReady 503 gate in front of /api", () => {
    expect(appSource).not.toMatch(/app\.use\(["']\/api["'][\s\S]*?indexesReady\(\)/);
    expect(routerSource).not.toMatch(/router\.use\([\s\S]*?indexesReady\(\)/);
  });

  it("keeps the AdMob verification probe ahead of rewards readiness middleware", () => {
    const routeStart = rewardsSource.indexOf('router.get("/admob-ssv"');
    const routeGate = rewardsSource.indexOf("router.use((_req, res, next) => {", routeStart);
    expect(routeStart).toBeGreaterThanOrEqual(0);
    expect(routeGate).toBeGreaterThan(routeStart);
    const ssvRoute = rewardsSource.slice(routeStart, routeGate);
    expect(ssvRoute).not.toContain("indexesReady()");
    expect(ssvRoute).toMatch(/if \(!hasCustomData\)\s*\{\s*res\.status\(200\)\.send\("ok"\)/);
  });
});
