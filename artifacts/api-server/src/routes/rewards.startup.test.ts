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
  it("gates API routes during bootstrap except health, version and AdMob handshake", () => {
    expect(appSource).toContain('app.use("/api", (req, res, next) => {');
    expect(appSource).toContain("if (indexesReady()) return next()");
    expect(appSource).toContain('path === "/rewards/admob-ssv"');
    expect(appSource).toContain('path === "/rewards/admob-result"');
    expect(appSource).toContain("/^\\/rewards\\/admob-result");
    expect(appSource).toContain('status(503).json({ error: "Service is starting"');
    expect(routerSource).not.toContain("indexesReady()");
  });

  it("keeps AdMob result and SSV routes available while indexes are being built", () => {
    const resultStart = rewardsSource.indexOf('router.post("/admob-result"');
    const ssvStart = rewardsSource.indexOf('router.get("/admob-ssv"');
    const routeGate = rewardsSource.indexOf("router.use((_req, res, next) => {", ssvStart);
    expect(resultStart).toBeGreaterThanOrEqual(0);
    expect(ssvStart).toBeGreaterThan(resultStart);
    expect(routeGate).toBeGreaterThan(ssvStart);

    const resultRoutes = rewardsSource.slice(resultStart, ssvStart);
    const ssvRoute = rewardsSource.slice(ssvStart, routeGate);
    expect(resultRoutes).not.toContain("indexesReady()");
    expect(resultRoutes).toContain("await ensureAdmobRewardTable()");
    expect(ssvRoute).not.toContain("indexesReady()");
    expect(ssvRoute).toContain("await ensureAdmobRewardTable()");
    expect(ssvRoute).toMatch(/if \(!hasCustomData\)\s*\{\s*res\.status\(200\)\.send\("ok"\)/);
  });

  it("reopens an unverified request when a late signed SSV callback confirms the reward", () => {
    expect(rewardsSource).toMatch(/consumed_at = CASE\s+WHEN admob_reward_requests\.rewarded = false THEN NULL\s+ELSE admob_reward_requests\.consumed_at\s+END/);
  });
});
