import crypto from "crypto";

// ── Score vouchers (anti-cheat for Solo & Daily submissions) ────────────────
//
// The leaderboard endpoints used to trust the `score` the client posted, so a
// player could fabricate any total (and mint the coins/XP derived from it). To
// close that, `/game/validate` — which already computes the authoritative
// per-round base score on the server — now hands back a *signed, single-use
// voucher* attesting that base. The client collects each round's voucher and
// returns them when submitting the final game score. The submission endpoints
// then clamp the posted score to a realistic ceiling derived from the verified
// base, so fabricated scores get cut while every legitimate game (including the
// client-side modifier bonuses: steal, sabotage, bluff, FTUE) passes through.
//
// Vouchers are NOT bound to a player id on purpose: they only set a per-game
// ceiling, and a voucher requires real validated play to obtain, so there's
// nothing to gain by using someone else's. Single-use (jti) + a short TTL stop
// replay.
//
// 🔒 Anti-farming: a voucher is cheap to mint (one /validate call), so a script
// could stockpile thousands and pool them to inflate one submission. Two guards
// stop that: (1) `sumVerifiedBase` counts only the TOP-N vouchers by base where
// N is the mode's max rounds (a real game can't produce more rounds than that),
// so pooling extra vouchers never raises the ceiling beyond a legit game; and
// (2) every *valid* voucher in the batch is burned (marked used) even when not
// counted, so the surplus can't be replayed in a later submission.

const TTL_MS = 30 * 60 * 1000; // a game is short — vouchers expire quickly.
const KIND_ROUND = "r";

// Max scoring rounds a legit game of each mode can produce. Used to cap how many
// vouchers count toward a single submission's ceiling (see sumVerifiedBase).
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

// Process-local single-use registry. Production runs a single Railway replica,
// so an in-memory set is enough to stop voucher replay within its TTL. Pruned
// lazily once it grows, to avoid an unbounded map.
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

/**
 * Issue a single-use voucher attesting a round's server-computed base score.
 * Returns null when no signing secret is configured (the caller simply omits
 * the token and the submission falls back to the absolute ceiling).
 */
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
 * Verify a batch of vouchers and return the summed attested base of the valid
 * ones, counting at most `maxTokens` of them (the highest bases) so pooled /
 * farmed vouchers can't inflate the ceiling beyond a legit game. Invalid /
 * expired / replayed tokens are skipped (never throws) so a partly-bad batch
 * still yields its legit portion. EVERY valid voucher in the batch is marked
 * used — even the surplus beyond `maxTokens` — so it can't be replayed later.
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
  for (const token of tokens) {
    if (typeof token !== "string") continue;
    const parts = token.split(".");
    if (parts.length !== 5) continue;
    const [baseStr, kind, expStr, jti, sig] = parts;
    if (kind !== KIND_ROUND) continue;

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
    if (!Number.isFinite(exp) || exp <= now) continue;
    if (usedJti.has(jti)) continue;

    const b = Number(baseStr);
    if (!Number.isFinite(b) || b < 0) continue;

    // Burn every valid voucher so the surplus beyond the cap can't be reused.
    usedJti.set(jti, exp);
    validBases.push(b);
  }

  // Count only the top-N vouchers by base — a real game can't exceed N rounds.
  validBases.sort((a, b) => b - a);
  const cap = Number.isFinite(maxTokens) ? Math.max(0, Math.floor(maxTokens)) : validBases.length;
  const counted = validBases.slice(0, cap);
  const base = counted.reduce((sum, n) => sum + n, 0);
  return { base, verified: counted.length };
}

/**
 * Anti-cheat ceiling derived from the verified base. A legit game adds modifier
 * points on top of the validated word base (steal/sabotage transfer the AI's
 * points, bluff bonus, one-time FTUE catch-up), so we allow generous headroom —
 * only scores far above real play get clamped.
 */
export function ceilingFromBase(base: number): number {
  return base * 4 + 50;
}

// Absolute fallback ceilings for tokenless (offline / legacy-client)
// submissions, keyed by game mode. Set well above any legitimate game so real
// scores are never cut, but low enough to kill arbitrary injected totals.
const ABSOLUTE_SCORE_CEILING: Record<string, number> = {
  daily: 600,
  solo: 2000,
  multiplayer: 3000,
};

export function absoluteCeiling(mode: string | undefined): number {
  return ABSOLUTE_SCORE_CEILING[mode ?? "solo"] ?? ABSOLUTE_SCORE_CEILING["solo"];
}
