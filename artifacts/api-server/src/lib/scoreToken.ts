import crypto from "crypto";
import { db, scoreVoucherUsesTable } from "@workspace/db";
import { lt } from "drizzle-orm";

// ── Score vouchers (anti-cheat for Solo & Daily submissions) ────────────────
const TTL_MS = 30 * 60 * 1000;
const KIND_ROUND = "r";
const MAX_TOKEN_BATCH = 64;
const MAX_TOKEN_LENGTH = 2048;

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

export type ScoreVoucherMode = "solo" | "daily" | "multiplayer";

export function issueScoreToken(
  base: number,
  collectionWords: Array<{ word: string; category: string }> = [],
  mode: ScoreVoucherMode = "solo",
  aiBase = 0,
): string | null {
  const secret = getSigningSecret();
  if (!secret) return null;
  const safeBase = Math.max(0, Math.min(100_000, Math.floor(base)));
  const exp = Date.now() + TTL_MS;
  const jti = crypto.randomBytes(9).toString("base64url");
  const safeCollectionWords = collectionWords
    .filter((entry) => typeof entry?.word === "string" && typeof entry?.category === "string")
    .slice(0, 16)
    .map((entry) => ({
      word: entry.word.trim().slice(0, 80),
      category: entry.category.trim().slice(0, 80),
    }))
    .filter((entry) => entry.word.length > 0 && entry.category.length > 0);
  const safeMode: ScoreVoucherMode =
    mode === "daily" || mode === "multiplayer" ? mode : "solo";
  const safeAiBase = Math.max(0, Math.min(100_000, Math.floor(aiBase)));
  const collectionData = Buffer.from(JSON.stringify(safeCollectionWords), "utf8").toString("base64url");
  const payload = `${safeBase}.${KIND_ROUND}.${exp}.${jti}.${safeMode}.${safeAiBase}.${collectionData}`;
  return `${payload}.${sign(secret, payload)}`;
}

type VerifiedVoucher = {
  base: number;
  exp: number;
  jti: string;
  mode: ScoreVoucherMode | null;
  aiBase: number | null;
  collectionWords: Array<{ word: string; category: string }>;
};

function parseVerifiedVoucher(
  token: unknown,
  secret: string,
  now: number,
): VerifiedVoucher | null {
  if (typeof token !== "string" || token.length > MAX_TOKEN_LENGTH) return null;
  const parts = token.split(".");
  if (parts.length !== 5 && parts.length !== 6 && parts.length !== 7 && parts.length !== 8) return null;

  const [baseStr, kind, expStr, jti] = parts;
  const mode = parts.length >= 7
    ? (parts[4] === "daily" || parts[4] === "multiplayer" || parts[4] === "solo" ? parts[4] : null)
    : null;
  const hasAiBase = parts.length === 8;
  const aiBaseStr = hasAiBase ? parts[5] : "0";
  const collectionData = hasAiBase ? parts[6] : parts.length === 7 ? parts[5] : parts.length === 6 ? parts[4] : "";
  const sig = hasAiBase ? parts[7] : parts.length === 7 ? parts[6] : parts.length === 6 ? parts[5] : parts[4];
  if (kind !== KIND_ROUND || !jti || !sig) return null;

  const payload = hasAiBase
    ? `${baseStr}.${kind}.${expStr}.${jti}.${parts[4]}.${aiBaseStr}.${collectionData}`
    : parts.length === 7
      ? `${baseStr}.${kind}.${expStr}.${jti}.${parts[4]}.${collectionData}`
      : parts.length === 6
        ? `${baseStr}.${kind}.${expStr}.${jti}.${collectionData}`
        : `${baseStr}.${kind}.${expStr}.${jti}`;
  const expected = sign(secret, payload);

  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }

  const exp = Number(expStr);
  const b = Number(baseStr);
  const aiBase = hasAiBase ? Number(aiBaseStr) : null;
  if (!Number.isSafeInteger(exp) || exp <= now) return null;
  if (!Number.isFinite(b) || !Number.isSafeInteger(b) || b < 0 || b > 100_000) return null;
  if (aiBase !== null && (!Number.isFinite(aiBase) || !Number.isSafeInteger(aiBase) || aiBase < 0 || aiBase > 100_000)) return null;

  let collectionWords: Array<{ word: string; category: string }> = [];
  if (collectionData) {
    try {
      const parsed = JSON.parse(Buffer.from(collectionData, "base64url").toString("utf8"));
      if (Array.isArray(parsed)) {
        collectionWords = parsed
          .filter((entry) => entry && typeof entry.word === "string" && typeof entry.category === "string")
          .slice(0, 16)
          .map((entry) => ({
            word: entry.word.trim().slice(0, 80),
            category: entry.category.trim().slice(0, 80),
          }))
          .filter((entry) => entry.word.length > 0 && entry.category.length > 0);
      }
    } catch {
      return null;
    }
  }

  return { base: b, exp, jti, mode, aiBase, collectionWords };
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

/** Verify score vouchers without consuming them. Consumption is performed
 * inside the caller's score transaction so a failed score write cannot burn
 * the player's vouchers. */
export async function sumVerifiedBasePersistent(
  tokens: unknown,
  maxTokens = Number.POSITIVE_INFINITY,
): Promise<{
  base: number;
  verified: number;
  collectionWords: Array<{ word: string; category: string }>;
  mode: ScoreVoucherMode | null;
  aiBase: number | null;
  voucherJtis: string[];
}> {
  const empty = { base: 0, verified: 0, collectionWords: [], mode: null, aiBase: 0, voucherJtis: [] as string[] };
  if (!Array.isArray(tokens) || tokens.length === 0 || tokens.length > MAX_TOKEN_BATCH) return empty;
  const secret = getSigningSecret();
  if (!secret) return empty;

  const now = Date.now();
  const cap = Number.isFinite(maxTokens) ? Math.max(0, Math.floor(maxTokens)) : tokens.length;
  if (cap === 0) return empty;

  await db.delete(scoreVoucherUsesTable).where(lt(scoreVoucherUsesTable.expiresAt, new Date(now)));

  const validBases: Array<{
    base: number;
    jti: string;
    mode: ScoreVoucherMode | null;
    aiBase: number | null;
    collectionWords: Array<{ word: string; category: string }>;
  }> = [];

  for (const token of tokens) {
    const voucher = parseVerifiedVoucher(token, secret, now);
    if (!voucher) continue;
    validBases.push({
      base: voucher.base,
      jti: voucher.jti,
      mode: voucher.mode,
      aiBase: voucher.aiBase,
      collectionWords: voucher.collectionWords,
    });
  }

  validBases.sort((a, b) => b.base - a.base);
  const counted = validBases.slice(0, cap);
  const certifiedModes = new Set(counted.map((entry) => entry.mode).filter(Boolean));
  const mode = certifiedModes.size === 1 ? (Array.from(certifiedModes)[0] as ScoreVoucherMode) : null;

  return {
    base: counted.reduce((sum, entry) => sum + entry.base, 0),
    verified: counted.length,
    collectionWords: counted.flatMap((entry) => entry.collectionWords),
    mode,
    aiBase: counted.every((entry) => entry.aiBase !== null)
      ? counted.reduce((sum, entry) => sum + (entry.aiBase ?? 0), 0)
      : null,
    // Only consume vouchers that actually contributed to the capped score.\n    // Extra valid vouchers in the request must remain available for a later retry/game.\n    voucherJtis: counted.map((entry) => entry.jti),
  };
}

/** Atomically burns the verified voucher JTIs in the caller's transaction. */
export async function consumeScoreVoucherJtis(tx: any, jtis: string[]): Promise<void> {
  if (jtis.length === 0) return;
  let consumed = 0;
  for (const jti of jtis) {
    const [row] = await tx
      .insert(scoreVoucherUsesTable)
      .values({ jti, expiresAt: new Date(Date.now() + TTL_MS) })
      .onConflictDoNothing()
      .returning({ jti: scoreVoucherUsesTable.jti });
    if (row) consumed++;
  }
  if (consumed !== jtis.length) {
    throw new Error("SCORE_VOUCHER_CONFLICT");
  }
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
