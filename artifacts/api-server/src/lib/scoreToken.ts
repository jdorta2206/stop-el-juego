import crypto from "crypto";

// ── Score vouchers (anti-cheat for Solo & Daily submissions) ────────────────
// Signed, single-use vouchers attest both the server-computed round base score
// and the AI difficulty actually used by /game/validate. This lets achievements
// and prestige stats rely on cryptographically verified difficulty instead of
// any client-supplied field.

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

export type AiDifficulty = "easy" | "expert";

/** Issue a signed voucher for the server-computed base score and AI difficulty. */
export function issueScoreToken(
  base: number,
  difficulty: AiDifficulty = "easy",
): string | null {
  const secret = getSigningSecret();
  if (!secret) return null;
  const safeBase = Math.max(0, Math.min(100_000, Math.floor(base)));
  const diffTag = difficulty === "expert" ? "x" : "e";
  const exp = Date.now() + TTL_MS;
  const jti = crypto.randomBytes(9).toString("base64url");
  const payload = `${safeBase}.${KIND_ROUND}.${diffTag}.${exp}.${jti}`;
  return `${payload}.${sign(secret, payload)}`;
}

/**
 * Verify vouchers and return the summed attested base plus whether every
 * counted voucher was issued for Expert difficulty. Every valid voucher is
 * burned, including surplus vouchers beyond maxTokens.
 */
export function sumVerifiedBase(
  tokens: unknown,
  maxTokens = Number.POSITIVE_INFINITY,
): { base: number; verified: number; allExpert: boolean } {
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return { base: 0, verified: 0, allExpert: false };
  }
  const secret = getSigningSecret();
  if (!secret) return { base: 0, verified: 0, allExpert: false };
  const now = Date.now();
  pruneUsed(now);

  const validEntries: { base: number; expert: boolean }[] = [];
  for (const token of tokens) {
    if (typeof token !== "string") continue;
    const parts = token.split(".");
    if (parts.length !== 6) continue;
    const [baseStr, kind, diffTag, expStr, jti, sig] = parts;
    if (kind !== KIND_ROUND || (diffTag !== "e" && diffTag !== "x")) continue;

    const expected = sign(secret, `${baseStr}.${kind}.${diffTag}.${expStr}.${jti}`);
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
    if (!Number.isFinite(exp) || exp <= now) continue;
    if (usedJti.has(jti)) continue;

    const b = Number(baseStr);
    if (!Number.isFinite(b) || b < 0) continue;

    usedJti.set(jti, exp);
    validEntries.push({ base: b, expert: diffTag === "x" });
  }

  validEntries.sort((a, b) => b.base - a.base);
  const cap = Number.isFinite(maxTokens)
    ? Math.max(0, Math.floor(maxTokens))
    : validEntries.length;
  const counted = validEntries.slice(0, cap);
  const base = counted.reduce((sum, e) => sum + e.base, 0);
  const allExpert = counted.length > 0 && counted.every((e) => e.expert);
  return { base, verified: counted.length, allExpert };
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
