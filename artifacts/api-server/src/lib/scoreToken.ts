import crypto from "crypto";
import { db, scoreVoucherUsesTable } from "@workspace/db";
import { lt } from "drizzle-orm";

// ── Score vouchers (anti-cheat for Solo & Daily submissions) ────────────────
const TTL_MS = 30 * 60 * 1000;
const KIND_ROUND = "r";
const MAX_TOKEN_BATCH = 64;
const MAX_TOKEN_LENGTH = 512;

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

export function isScoreTokenConfigured(): boolean {
  return getSigningSecret() !== null;
}

// Kept for backwards-compatible unit-test callers. Production submissions use
// sumVerifiedBasePersistent so replay protection survives process restarts.
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

type VerifiedVoucher = { base: number; exp: number; jti: string };

function parseVerifiedVoucher(
  token: unknown,
  secret: string,
  now: number,
): VerifiedVoucher | null {
  if (typeof token !== "string" || token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [baseStr, kind, expStr, jti, sig] = parts;
  if (kind !== KIND_ROUND || !jti || !sig) return null;

  const expected = sign(secret, `${baseStr}.${kind}.${expStr}.${jti}`);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  const exp = Number(expStr);
  const b = Number(baseStr);
  if (!Number.isSafeInteger(exp) || exp <= now) return null;
  if (!Number.isFinite(b) || !Number.isSafeInteger(b) || b < 0 || b > 100_000) return null;
  return { base: b, exp, jti };
}

/** Legacy in-process helper retained for tests. */
export function sumVerifiedBase(
  tokens: unknown,
  maxTokens = Number.POSITIVE_INFINITY,
): { base: number; verified: number } {
  if (!Array.isArray(tokens) || tokens.length === 0 || tokens.length > MAX_TOKEN_BATCH) {
    return { base: 0, verified: 0 };
  }
  const secret = getSigningSecret();
  if (!secret) return { base: 0, verified: 0 };
  const now = Date.now();
  pruneUsed(now);
  const cap = Number.isFinite(maxTokens) ? Math.max(0, Math.floor(maxTokens)) : tokens.length;
  if (cap === 0) return { base: 0, verified: 0 };

  const validBases: number[] = [];
  for (const token of tokens) {
    const voucher = parseVerifiedVoucher(token, secret, now);
    if (!voucher || usedJti.has(voucher.jti)) continue;
    usedJti.set(voucher.jti, voucher.exp);
    validBases.push(voucher.base);
  }

  validBases.sort((a, b) => b - a);
  const counted = validBases.slice(0, cap);
  return {
    base: counted.reduce((sum, n) => sum + n, 0),
    verified: counted.length,
  };
}

/**
 * Production verifier. Valid voucher JTIs are atomically burned in PostgreSQL.
 * The unique primary key makes concurrent submissions and post-restart replays
 * fail closed. All valid vouchers in the bounded batch are burned, while only
 * the highest maxTokens bases contribute to the score ceiling.
 */
export async function sumVerifiedBasePersistent(
  tokens: unknown,
  maxTokens = Number.POSITIVE_INFINITY,
): Promise<{ base: number; verified: number }> {
  if (!Array.isArray(tokens) || tokens.length === 0 || tokens.length > MAX_TOKEN_BATCH) {
    return { base: 0, verified: 0 };
  }
  const secret = getSigningSecret();
  if (!secret) return { base: 0, verified: 0 };

  const now = Date.now();
  const cap = Number.isFinite(maxTokens) ? Math.max(0, Math.floor(maxTokens)) : tokens.length;
  if (cap === 0) return { base: 0, verified: 0 };

  // Remove only expired ledger rows; active JTIs remain permanently protected.
  await db
    .delete(scoreVoucherUsesTable)
    .where(lt(scoreVoucherUsesTable.expiresAt, new Date(now)));

  const validBases: number[] = [];
  for (const token of tokens) {
    const voucher = parseVerifiedVoucher(token, secret, now);
    if (!voucher) continue;

    const claimed = await db
      .insert(scoreVoucherUsesTable)
      .values({ jti: voucher.jti, expiresAt: new Date(voucher.exp) })
      .onConflictDoNothing()
      .returning({ jti: scoreVoucherUsesTable.jti });

    if (claimed.length > 0) validBases.push(voucher.base);
  }

  validBases.sort((a, b) => b - a);
  const counted = validBases.slice(0, cap);
  return {
    base: counted.reduce((sum, n) => sum + n, 0),
    verified: counted.length,
  };
}

export function ceilingFromBase(base: number): number {
  return Math.max(0, Math.floor(base)) * 4 + 50;
}

const ABSOLUTE_SCORE_CEILING: Record<string, number> = {
  daily: 600,
  solo: 2000,
  multiplayer: 3000,
};

export function absoluteCeiling(mode: string | undefined): number {
  return ABSOLUTE_SCORE_CEILING[mode ?? "solo"] ?? ABSOLUTE_SCORE_CEILING["solo"];
}
