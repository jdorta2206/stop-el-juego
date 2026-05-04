import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";

// Compose key from playerId (body/query) + IP. Falls back to IP only.
// IPv6-safe via `ipKeyGenerator` helper from express-rate-limit.
function playerKey(req: Request): string {
  const pid =
    (req.body && (req.body as any).playerId) ||
    (req.query && (req.query as any).playerId) ||
    "";
  return `${pid || "anon"}|${ipKeyGenerator(req.ip ?? "")}`;
}

const baseOpts = {
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
  // Skip when behind a healthy LB during health checks
  skip: (req: Request) => req.path === "/health",
  message: { error: "Too many requests, slow down a bit ⏳" },
};

// Generic API limiter — broad protection (e.g. ranking, room reads).
// 240 req / min / key (room polling at 0.6/s plus headroom for SSE actions).
export const generalLimiter = rateLimit({
  ...baseOpts,
  windowMs: 60_000,
  limit: 240,
  keyGenerator: playerKey,
});

// Hot-path write limiter for room actions (results, vote, react, typing, spy).
// 120 req / min / key — enough for active gameplay, blocks brute-force scripts.
export const writeLimiter = rateLimit({
  ...baseOpts,
  windowMs: 60_000,
  limit: 120,
  keyGenerator: playerKey,
});

// Aggressive limiter for "expensive" endpoints (presence ping, typing pings).
// 60 req / min / key — 1 per second sustained.
export const presenceLimiter = rateLimit({
  ...baseOpts,
  windowMs: 60_000,
  limit: 90,
  keyGenerator: playerKey,
});

// Auth limiter — 20 attempts / 5 min / IP. Blocks credential stuffing.
export const authLimiter = rateLimit({
  ...baseOpts,
  windowMs: 5 * 60_000,
  limit: 20,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? ""),
});

// Score-submit limiter — 30 req / 5 min / playerId. Blocks score spam.
export const scoreLimiter = rateLimit({
  ...baseOpts,
  windowMs: 5 * 60_000,
  limit: 30,
  keyGenerator: playerKey,
});
