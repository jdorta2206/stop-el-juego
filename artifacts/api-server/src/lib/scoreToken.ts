import crypto from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

// ── Score vouchers (anti-cheat for Solo & Daily submissions) ────────────────
const TTL_MS = 30 * 60 * 1000;
const KIND_ROUND = "r";

const MAX_ROUNDS_BY_MODE: Record<string, number> = {
  daily: 1,
  solo: 3,
  multiplayer: 12,
};

export function maxRoundsForMode(mode: string | undefined): number {
  return MAX_ROUNDS_BY_MODE[mode ?? "solo"] ?? MAX_ROUNDS_BY_MODE["solo"];
}

let warnedMissingSecret = false;

function getSigningSecret(): string | null {
  const s = process.env["SESSION_SECRET"];
  if (s && s.length >= 16) return s;
  if (!warnedMissingSecret) {
    warnedMissingSecret = true;
    console.error(
      "[scoreToken] SESSION_SECRET missing or too short (<16 chars). Score " +
        "vouchers are disabled; submissions fall back to the absolute ceiling.",
    );
  }
  return null;
}

// Local fallback only. PostgreSQL is the authoritative replay registry; this
// remains as a graceful fallback if the registry table is temporarily unavailable.
const usedJti = new Map<string, number>();
function pruneUsed(now: number): void {
  if (usedJti.size < 1024) return;
  for (const [jti, exp] of usedJti) {
    if (exp <= now) usedJti.delete(jti);
  }
}

function sign(secret: string, payload: string): string {
  return crypto.createHmac("sha256", secret).update(payload).digest("base64url");
}

export function issueScoreToken(base: number): string | null {
  const secret = getSigningSecret();
  if (!secret) return null;
  const safeBase = Math.max(0, Math.min(100_000, Math.floor(base)));
  const exp = Date.now() + TTL_MS;
  const jti = crypto.randomBytes(9).toString("base64url");
  const payload = `${safeBase}.${KIND_ROUND}.${exp}.${jti}`;
  return `${payload}.${sign(secret, payload)}`;
}

/**
 * Verify and atomically burn vouchers in PostgreSQL. A voucher only counts if
 * its JTI is successfully inserted into the unique registry, so two concurrent
 * submissions (or multiple server replicas) cannot consume the same voucher.
 */
export async function sumVerifiedBase(
  tokens: unknown,
  maxTokens = Number.POSITIVE_INFINITY,
): Promise<{ base: number; verified: number }> {
  if (!Array.isArray(tokens) || tokens.length === 0) return { base: 0, verified: 0 };
  const secret = getSigningSecret();
  if (!secret) return { base: 0, verified: 0 };
  const now = Date.now();
  pruneUsed(now);

  const candidates: Array<{ base: number; jti: string; exp: number }> = [];
  for (const token of tokens) {
    if (typeof token !== "string") continue;
    const parts = token.split(".");
    if (parts.length !== 5) continue;
    const [baseStr, kind, expStr, jti, sig] = parts;
    if (kind !== KIND_ROUND || !jti || !sig) continue;

    const expected = sign(secret, `${baseStr}.${kind}.${expStr}.${jti}`);
    let ok = false;
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      ok = a.length === b.length && crypto.timingSafeEqual(a, b);
    } catch {
      ok = false;
    }
    if (!ok) continue;

    const exp = Number(expStr);
    const base = Number(baseStr);
    if (!Number.isFinite(exp) || exp <= now || !Number.isFinite(base) || base < 0) continue;
    candidates.push({ base, jti, exp });
  }

  if (candidates.length === 0) return { base: 0, verified: 0 };

  const accepted: Array<{ base: number; jti: string; exp: number }> = [];
  try {
    // Clean old entries opportunistically; failure is harmless.
    await db.execute(sql`DELETE FROM score_voucher_uses WHERE expires_at <= ${now}`);

    for (const candidate of candidates) {
      const result = await db.execute(sql`
        INSERT INTO score_voucher_uses (jti, expires_at)
        VALUES (${candidate.jti}, ${candidate.exp})
        ON CONFLICT (jti) DO NOTHING
        RETURNING jti
      `);
      if (result.rows.length > 0) accepted.push(candidate);
    }
  } catch (err: any) {
    // Never make a database-schema hiccup block legitimate gameplay. Fall back
    // to the existing process-local replay protection until the table is ready.
    console.error("[scoreToken] persistent voucher registry unavailable:", err?.message ?? err);
    const persistentFallback: typeof candidates = [];
    for (const candidate of candidates) {
      if (usedJti.has(candidate.jti)) continue;
      usedJti.set(candidate.jti, candidate.exp);
      persistentFallback.push(candidate);
    }
    accepted.push(...persistentFallback);
  }

  accepted.sort((a, b) => b.base - a.base);
  const cap = Number.isFinite(maxTokens) ? Math.max(0, Math.floor(maxTokens)) : accepted.length;
  const counted = accepted.slice(0, cap);
  return {
    base: counted.reduce((sum, item) => sum + item.base, 0),
    verified: counted.length,
  };
}

export function ceilingFromBase(base: number): number {
  return base * 4 + 50;
}

const ABSOLUTE_SCORE_CEILING: Record<string, number> = {
  daily: 600,
  solo: 2000,
  multiplayer: 3000,
};

export function absoluteCeiling(mode: string | undefined): number {
  return ABSOLUTE_SCORE_CEILING[mode ?? "solo"] ?? ABSOLUTE_SCORE_CEILING["solo"];
}
