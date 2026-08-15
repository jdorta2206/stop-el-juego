import crypto from "crypto";

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
    const b = Number(baseStr);
    if (!Number.isSafeInteger(exp) || exp <= now) continue;
    if (!Number.isFinite(b) || b < 0 || b > 100_000) continue;
    if (usedJti.has(jti)) continue;

    usedJti.set(jti, exp);
    validBases.push(Math.floor(b));
  }

  validBases.sort((a, b) => b - a);
  const cap = Number.isFinite(maxTokens) ? Math.max(0, Math.floor(maxTokens)) : validBases.length;
  const counted = validBases.slice(0, cap);
  return { base: counted.reduce((sum, n) => sum + n, 0), verified: counted.length };
}

export function ceilingFromBase(base: number): number {
  return base * 4 + 50;
}
