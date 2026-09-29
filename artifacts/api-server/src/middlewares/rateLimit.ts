import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

interface RateLimitStore {
  increment: (key: string) => Promise<{ totalHits: number; resetTime: Date }>;
  decrement: (key: string) => Promise<void>;
  resetKey: (key: string) => Promise<void>;
}

class PgRateLimitStore implements RateLimitStore {
  private readonly prefix: string;
  private readonly windowMs: number;
  private cleanupTimer: ReturnType<typeof setInterval>;

  constructor(prefix: string, windowMs: number) {
    this.prefix = prefix;
    this.windowMs = windowMs;
    this.cleanupTimer = setInterval(() => {
      void db.execute(sql\`
        DELETE FROM api_rate_limits
        WHERE bucket_key LIKE \${this.prefix + ":%"}
          AND window_start < NOW() - (\${this.windowMs}::double precision * interval '1 millisecond')
      \`).catch((err) => console.error("[rate-limit] cleanup failed:", err));
    }, Math.max(windowMs, 60_000));
    this.cleanupTimer.unref?.();
  }

  async increment(key: string) {
    const bucketKey = \`\${this.prefix}:\${key}\`;
    const result = await db.execute(sql\`
      INSERT INTO api_rate_limits (bucket_key, window_start, hits)
      VALUES (\${bucketKey}, NOW(), 1)
      ON CONFLICT (bucket_key) DO UPDATE
      SET
        hits = CASE
          WHEN api_rate_limits.window_start <= NOW() -
            (\${this.windowMs}::double precision * interval '1 millisecond')
          THEN 1
          ELSE api_rate_limits.hits + 1
        END,
        window_start = CASE
          WHEN api_rate_limits.window_start <= NOW() -
            (\${this.windowMs}::double precision * interval '1 millisecond')
          THEN NOW()
          ELSE api_rate_limits.window_start
        END
      RETURNING hits, window_start
    \`);
    const row = result.rows[0] as { hits: number | string; window_start: string | Date };
    const windowStart = new Date(row.window_start);
    return { totalHits: Number(row.hits), resetTime: new Date(windowStart.getTime() + this.windowMs) };
  }

  async decrement(key: string) {
    await db.execute(sql\`
      UPDATE api_rate_limits SET hits = GREATEST(0, hits - 1)
      WHERE bucket_key = \${this.prefix + ":" + key}
    \`);
  }

  async resetKey(key: string) {
    await db.execute(sql\`
      DELETE FROM api_rate_limits WHERE bucket_key = \${this.prefix + ":" + key}
    \`);
  }
}

function playerKey(req: Request): string {
  const pid =
    (req.body && (req.body as any).playerId) ||
    (req.query && (req.query as any).playerId) ||
    "";
  return \`\${pid || "anon"}|\${ipKeyGenerator(req.ip ?? "")}\`;
}

const baseOpts = {
  standardHeaders: "draft-7" as const,
  legacyHeaders: false,
  skip: (req: Request) => req.path === "/health",
  message: { error: "Too many requests, slow down a bit ⏳" },
};

function limiter(prefix: string, windowMs: number, limit: number, keyGenerator: (req: Request) => string) {
  return rateLimit({
    ...baseOpts,
    windowMs,
    limit,
    keyGenerator,
    store: new PgRateLimitStore(prefix, windowMs),
  });
}

export const generalLimiter = limiter("general", 60_000, 240, playerKey);
export const writeLimiter = limiter("write", 60_000, 120, playerKey);
export const presenceLimiter = limiter("presence", 60_000, 90, playerKey);
export const authLimiter = limiter("auth", 5 * 60_000, 20, (req) => ipKeyGenerator(req.ip ?? ""));
export const scoreLimiter = limiter("score", 5 * 60_000, 30, playerKey);
export const inviteLimiter = limiter("invite", 5 * 60_000, 20, (req) => ipKeyGenerator(req.ip ?? ""));
export const contactLimiter = limiter("contact", 10 * 60_000, 5, (req) => ipKeyGenerator(req.ip ?? ""));
export const roomJoinLimiter = limiter("room-join", 60_000, 60, (req) => ipKeyGenerator(req.ip ?? ""));
