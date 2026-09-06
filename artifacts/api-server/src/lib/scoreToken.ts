import crypto from "crypto";
import { db, scoreVoucherUsesTable } from "@workspace/db";
import { lt } from "drizzle-orm";

const TTL_MS = 30 * 60 * 1000;
const KIND_ROUND = "r";
const MAX_ROUNDS_BY_MODE: Record<string, number> = { daily: 1, solo: 3, multiplayer: 12 };

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
      "[scoreToken] SESSION_SECRET missing or too short (<16 chars). Score vouchers are disabled.",
    );
  }
  return null;
}

/** True when the server is capable of issuing and verifying score vouchers. */
export function isScoreTokenConfigured(): boolean {
  return getSigningSecret() !== null;
}

// Kept for backwards-compatible local/unit-test callers. Production score
// submission uses the durable DB ledger below, so a process restart cannot
// make a previously consumed voucher valid again.
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

type VerifiedVoucher = { base: number; exp: number; jti: string };

function parseVerifiedVoucher(token: unknown, secret: string, now: number): VerifiedVoucher | null {
  if (typeof token !== "string" || token.length > 512) return null;
  const parts = token.split(".");
  if (parts.length !== 5) return null;
  const [baseStr, kind, expStr, jti, sig] = parts;
  if (kind !== KIND_ROUND || !jti || !sig) return null;

  const expected = sign(secret, `${baseStr}.${kind}.${expStr}.${jti}`);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch (error) {
    console.warn("[scoreToken] malformed voucher signature", error);
    return null;
  }

  const exp = Number(expStr);
  const b = Number(baseStr);
  if (!Number.isSafeInteger(exp) || exp <= now) return null;
  if (!Number.isFinite(b) || !Number.isSafeInteger(b) || b < 0 || b > 100_000) return null;
  return { base: b, exp, jti };
}

/**
 * Legacy in-process verification helper. It remains available for tests and
 * non-economic callers; ranking score submission uses sumVerifiedBasePersistent.
 */
export function sumVerifiedBase(
  tokens: unknown,
  maxTokens = Number.POSITIVE_INFINITY,
): { base: number; verified: number } {
  if (!Array.isArray(tokens) || tokens.length === 0) return { base: 0, verified: 0 };
  const secret = getSigningSecret();
  if (!secret) return { base: 0, verified: 0 };
  const now = Date.now();
  pruneUsed(now);
  const validBases: number[] = [];
  const cap = Number.isFinite(maxTokens) ? Math.max(0, Math.floor(maxTokens)) : tokens.length;
  if (cap === 0) return { base: 0, verified: 0 };

  const candidates = tokens.slice(0, cap);
  for (const token of candidates) {
    const voucher = parseVerifiedVoucher(token, secret, now);
    if (!voucher || usedJti.has(voucher.jti)) continue;
    usedJti.set(voucher.jti, voucher.exp);
    validBases.push(voucher.base);
  }

  validBases.sort((a, b) => b - a);
  const counted = validBases.slice(0, cap);
  return { base: counted.reduce((sum, n) => sum + n, 0), verified: counted.length };
}

/**
 * Production verifier. Every accepted JTI is atomically inserted into the
 * persistent ledger. A unique constraint makes concurrent requests and
 * post-restart replays fail closed.
 */
export async function sumVerifiedBasePersistent(
  tokens: unknown,
  maxTokens = Number.POSITIVE_INFINITY,
): Promise<{ base: number; verified: number }> {
  if (!Array.isArray(tokens) || tokens.length === 0) return { base: 0, verified: 0 };
  const secret = getSigningSecret();
  if (!secret) return { base: 0, verified: 0 };
  const now = Date.now();
  const cap = Number.isFinite(maxTokens) ? Math.max(0, Math.floor(maxTokens)) : tokens.length;
  if (cap === 0) return { base: 0, verified: 0 };

  // Keep the small ledger bounded. This only removes already-expired entries.
  await db.delete(scoreVoucherUsesTable).where(lt(scoreVoucherUsesTable.expiresAt, new Date(now)));

  const validBases: number[] = [];
  const candidates = tokens.slice(0, cap);
  for (const token of candidates) {
    const voucher = parseVerifiedVoucher(token, secret, now);
    if (!voucher) continue;

    const claimed = await db.insert(scoreVoucherUsesTable).values({
      jti: voucher.jti,
      expiresAt: new Date(voucher.exp),
    }).onConflictDoNothing().returning({ jti: scoreVoucherUsesTable.jti });

    if (claimed.length === 0) continue;
    validBases.push(voucher.base);
  }

  validBases.sort((a, b) => b - a);
  const counted = validBases.slice(0, cap);
  return { base: counted.reduce((sum, n) => sum + n, 0), verified: counted.length };
}

export function ceilingFromBase(base: number): number {
  return Math.max(0, Math.floor(base)) * 4 + 50;
}
