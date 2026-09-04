import crypto from "crypto";
import { db, scoreVoucherUsesTable } from "@workspace/db";
import { lt } from "drizzle-orm";

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
    console.error("[scoreToken] SESSION_SECRET missing or too short (<16 chars). Score vouchers are disabled; submissions use the absolute ceiling.");
  }
  return null;
}

const usedJti = new Map<string, number>();
function pruneUsed(now: number): void {
  if (usedJti.size < 1024) return;
  for (const [jti, exp] of usedJti) if (exp <= now) usedJti.delete(jti);
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
 * PostgreSQL is authoritative for voucher replay prevention. A database
 * failure does not throw from this helper: vouchers are ignored and callers
 * retain their existing absolute ceiling, keeping normal gameplay available.
 *
 * All voucher burns happen in one transaction. If the database fails after
 * burning one or more vouchers, the transaction rolls them all back so a
 * legitimate submission can never lose vouchers without receiving credit.
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

  try {
    const accepted = await db.transaction(async (tx) => {
      // Cleanup is deliberately inside the same transaction as the burns.
      // If anything fails, the whole transaction rolls back.
      await tx
        .delete(scoreVoucherUsesTable)
        .where(lt(scoreVoucherUsesTable.expiresAt, new Date(now)));

      const newlyAccepted: Array<{ base: number; jti: string; exp: number }> = [];
      for (const candidate of candidates) {
        const inserted = await tx
          .insert(scoreVoucherUsesTable)
          .values({ jti: candidate.jti, expiresAt: new Date(candidate.exp) })
          .onConflictDoNothing({ target: scoreVoucherUsesTable.jti })
          .returning({ id: scoreVoucherUsesTable.id });

        if (inserted.length > 0) newlyAccepted.push(candidate);
      }
      return newlyAccepted;
    });

    for (const candidate of accepted) {
      usedJti.set(candidate.jti, candidate.exp);
    }

    accepted.sort((a, b) => b.base - a.base);
    const cap = Number.isFinite(maxTokens) ? Math.max(0, Math.floor(maxTokens)) : accepted.length;
    const counted = accepted.slice(0, cap);
    return { base: counted.reduce((sum, value) => sum + value.base, 0), verified: counted.length };
  } catch (err) {
    console.error("[scoreToken] persistent voucher ledger unavailable; vouchers ignored for this submission:", err instanceof Error ? err.message : err);
    return { base: 0, verified: 0 };
  }
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
