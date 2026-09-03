import crypto from "crypto";
import { db, scoreVoucherUsesTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";

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
      "[scoreToken] SESSION_SECRET missing or too short (<16 chars). Score vouchers are disabled; submissions use the absolute ceiling.",
    );
  }
  return null;
}

// Fast local cache only. PostgreSQL is authoritative for replay prevention.
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
 * Verifies vouchers and burns valid JTIs persistently.
 *
 * Important availability rule: if PostgreSQL is temporarily unavailable, we
 * do NOT throw and do NOT block score submission. Vouchers are simply not
 * counted for that request, so the caller uses its existing absolute ceiling.
 * This preserves gameplay availability while keeping the database authoritative
 * whenever it is healthy.
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
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) continue;
    } catch {
      continue;
    }

    const exp = Number(expStr);
    const base = Number(baseStr);
    if (!Number.isFinite(exp) || exp <= now) continue;
    if (!Number.isFinite(base) || base < 0 || base > 100_000) continue;
    if (usedJti.has(jti)) continue;
    candidates.push({ base, jti, exp });
  }

  if (candidates.length === 0) return { base: 0, verified: 0 };

  // Burn every valid voucher, including surplus beyond maxTokens. Each insert
  // is atomic because jti has a UNIQUE index. Only a newly inserted row counts.
  const accepted: number[] = [];
  let databaseAvailable = true;
  try {
    // Remove expired ledger rows opportunistically; failure is harmless.
    try {
      await db.delete(scoreVoucherUsesTable).where(lt(scoreVoucherUsesTable.expiresAt, new Date(now)));
    } catch {
      // Best effort only.
    }

    for (const candidate of candidates) {
      const inserted = await db
        .insert(scoreVoucherUsesTable)
        .values({
          jti: candidate.jti,
          expiresAt: new Date(candidate.exp),
        })
        .onConflictDoNothing({ target: scoreVoucherUsesTable.jti })
        .returning({ id: scoreVoucherUsesTable.id });

      if (inserted.length > 0) {
        accepted.push(candidate.base);
        usedJti.set(candidate.jti, candidate.exp);
      }
    }
  } catch (err) {
    databaseAvailable = false;
    console.error("[scoreToken] persistent voucher ledger unavailable; vouchers ignored for this submission:", err instanceof Error ? err.message : err);
  }

  if (!databaseAvailable) return { base: 0, verified: 0 };

  accepted.sort((a, b) => b - a);
  const cap = Number.isFinite(maxTokens) ? Math.max(0, Math.floor(maxTokens)) : accepted.length;
  const counted = accepted.slice(0, cap);
  return {
    base: counted.reduce((sum, value) => sum + value, 0),
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
