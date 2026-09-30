import { Router, type IRouter } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { playerScoresTable, gameHistoryTable, pushSubscriptionsTable, scoreBonusClaimsTable, scoreSubmissionClaimsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { sendPushToPlayer } from "../lib/pushHelper";
import { recordTrustedAnalyticsEvent } from "./analytics";
import { resolveCosmetic } from "../lib/inventoryCatalog";
import { SubmitScoreBody, GetLeaderboardQueryParams } from "@workspace/api-zod";
import { scoreLimiter } from "../middlewares/rateLimit";
import { verifyClaimedIdentity, requirePlayerIdentity, type AuthedRequest } from "../lib/playerAuth";
import { sumVerifiedBasePersistent, consumeScoreVoucherJtis, ceilingFromBase, absoluteCeiling } from "../lib/scoreToken";
import { applyAuthoritativeSeasonEventsInTransaction } from "./season";
import { recordHalloweenEventInTransaction, isHalloweenPreviewAuthorized } from "./halloween";
import {
  isHappyHourActiveForTzOffset,
  isHappyHourActiveForTimeZone,
  HAPPY_HOUR_MULTIPLIER,
} from "../lib/happyHour";


function bonusTokenSetHash(playerId: string, tokens: unknown): string | null {
  if (!Array.isArray(tokens) || tokens.length === 0) return null;
  const normalized = tokens
    .filter((token): token is string => typeof token === "string" && token.length > 0)
    .sort();
  if (normalized.length !== tokens.length) return null;
  return crypto.createHash("sha256").update(playerId + "\n" + normalized.join("\n")).digest("hex");
}

export function calcCoinGain(score: number, won: boolean, mode: string, isBonus: boolean): number {
  if (isBonus) return 0;
  const base = Math.max(1, Math.floor(score / 30));
  const winBonus = won ? 3 : 0;
  const modeBonus = mode === "multiplayer" ? 2 : mode === "daily" ? 1 : 0;
  return base + winBonus + modeBonus;
}

export async function lookupPlayerTimezone(playerId: string): Promise<{ timeZone: string | null; tzOffset: number | null }> {
  try {
    const rows = await db
      .select({ timeZone: pushSubscriptionsTable.timeZone, tz: pushSubscriptionsTable.tzOffsetMinutes })
      .from(pushSubscriptionsTable)
      .where(sql`${pushSubscriptionsTable.playerId} = ${playerId}
              AND ${pushSubscriptionsTable.enabled} = TRUE`)
      .orderBy(sql`CASE WHEN ${pushSubscriptionsTable.timeZone} IS NOT NULL THEN 0 ELSE 1 END`)
      .limit(1);
    return { timeZone: rows[0]?.timeZone ?? null, tzOffset: rows[0]?.tz ?? null };
  } catch {
    return { timeZone: null, tzOffset: null };
  }
}
const router: IRouter = Router();

const LEVEL_THRESHOLDS = [
  0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200,
  4000, 5000, 6200, 7600, 9200, 11000, 13000, 15500, 18500, 22000,
];

export function calcLevel(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

export function calcXpGain(score: number, won: boolean, mode: string): number {
  const base = Math.max(0, Math.floor(score / 5));
  const winBonus = won ? 30 : 0;
  const modeBonus = mode === "multiplayer" ? 20 : mode === "daily" ? 15 : 0;
  return base + winBonus + modeBonus;
}

export function getTitle(rank: number): string {
  if (rank === 1) return "👑 Leyenda";
  if (rank <= 3) return "🏆 Campeón";
  if (rank <= 10) return "⭐ Estrella";
  if (rank <= 25) return "🔥 Experto";
  if (rank <= 50) return "💪 Veterano";
  if (rank <= 100) return "🎯 Aspirante";
  return "🌱 Novato";
}

export function appendStreakDay(prevJson: string | null | undefined, today: string): string {
  let days: string[] = [];
  try { days = JSON.parse(prevJson ?? "[]"); } catch {}
  if (!days.includes(today)) days.push(today);
  days = [...new Set(days)].sort().slice(-30);
  return JSON.stringify(days);
}

export function calculateStreak(
  lastPlayedDate: string | null,
  currentStreak: number
): { newStreak: number; updatedToday: boolean } {
  const today = new Date().toISOString().split("T")[0];
  if (lastPlayedDate === today) {
    return { newStreak: currentStreak, updatedToday: false };
  }
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
  const newStreak = lastPlayedDate === yesterday ? currentStreak + 1 : 1;
  return { newStreak, updatedToday: true };
}

function equippedAvatarGlyph(id: unknown): string | null {
  if (typeof id !== "string" || !id) return null;
  const cosmetic = resolveCosmetic(id);
  return cosmetic?.kind === "avatar" ? cosmetic.glyph : null;
}

function parseAchievementCount(json: unknown): number {
  try {
    const parsed = JSON.parse((json as string) ?? "[]");
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

// ============================================================
// RANKING GLOBAL
// ============================================================
router.get("/scores", async (req, res) => {
  const query = GetLeaderboardQueryParams.safeParse(req.query);
  const limit = query.success ? (query.data.limit ?? 20) : 20;

  const rows = await db.execute(sql`
    SELECT *, RANK() OVER (ORDER BY total_score DESC) AS rank_position
    FROM player_scores
    ORDER BY total_score DESC, player_id ASC
    LIMIT ${limit}
  `);

  const players = rows.rows as Array<Record<string, unknown>>;

  const totalRows = await db.execute(sql`
    SELECT COUNT(*) AS count FROM player_scores
  `);
  const total = Number((totalRows.rows[0] as any)?.count ?? 0);

  res.json({
    players: players.map((p, i) => ({
      id: p.id,
      playerId: p.player_id,
      playerName: p.player_name,
      avatarColor: p.avatar_color,
      picture: p.profile_picture ?? null,
      avatarFrame: p.equipped_frame ?? null,
      avatarGlyph: equippedAvatarGlyph(p.equipped_avatar),
      totalScore: p.total_score,
      gamesPlayed: p.games_played,
      wins: p.wins,
      currentStreak: p.current_streak ?? 0,
      longestStreak: p.longest_streak ?? 0,
      isPremium: p.is_premium ?? false,
      achievementCount: parseAchievementCount(p.achievements_json),
      title: getTitle(i + 1),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      rank: Number(p.rank_position ?? (i + 1)),
    })),
    total,
  });
});

// ============================================================
// RANKING SEMANAL
// ============================================================
router.get("/weekly", async (req, res) => {
  const rows = await db.execute(sql`
    SELECT
      gh.player_id        AS "playerId",
      ps.player_name      AS "playerName",
      ps.avatar_color     AS "avatarColor",
      ps.equipped_avatar AS "equippedAvatar",
      ps.equipped_title AS "equippedTitle",
      ps.current_streak   AS "currentStreak",
      ps.profile_picture AS "picture",
      ps.equipped_frame AS "equippedFrame",
      ps.is_premium       AS "isPremium",
      ps.achievements_json AS "achievementsJson",
      SUM(gh.score)       AS "totalScore",
      COUNT(*)            AS "gamesPlayed",
      SUM(CASE WHEN gh.won THEN 1 ELSE 0 END) AS "wins",
      RANK() OVER (ORDER BY SUM(gh.score) DESC) AS "rank"
    FROM game_history gh
    LEFT JOIN player_scores ps ON gh.player_id = ps.player_id
    WHERE gh.created_at >= date_trunc('week', NOW() AT TIME ZONE 'UTC')
    GROUP BY gh.player_id, ps.player_name, ps.avatar_color, ps.profile_picture, ps.equipped_avatar, ps.equipped_frame, ps.equipped_title, ps.current_streak, ps.is_premium, ps.achievements_json
    ORDER BY SUM(gh.score) DESC, gh.player_id ASC
    LIMIT 100
  `);

  const players = (rows.rows as Array<Record<string, unknown>>).map((p, i) => ({
    playerId:      p.playerId,
    playerName:    p.playerName ?? "—",
    avatarColor:   p.avatarColor ?? "#e53e3e",
    avatarGlyph:  equippedAvatarGlyph(p.equippedAvatar),
    totalScore:    Number(p.totalScore ?? 0),
    gamesPlayed:   Number(p.gamesPlayed ?? 0),
    wins:          Number(p.wins ?? 0),
    picture:         p.picture ?? null,
    avatarFrame:     p.equippedFrame ?? null,
    equippedTitle:   p.equippedTitle ?? null,
    currentStreak: Number(p.currentStreak ?? 0),
    isPremium:     p.isPremium ?? false,
    achievementCount: parseAchievementCount(p.achievementsJson),
    title:         getTitle(Number(p.rank ?? (i + 1))),
    rank:          Number(p.rank ?? (i + 1)),
  }));

  const now = new Date();
  const day = now.getUTCDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const nextReset = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday
  ));

  res.json({ players, nextReset: nextReset.toISOString() });
});

// ============================================================
// POSICIÓN PERSONAL SEMANAL (PRIVADA)
// ============================================================
router.get("/weekly/me", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const playerId = req.playerId!;
  const rows = await db.execute(sql`
    WITH period_scores AS (
      SELECT player_id, SUM(score) AS total_score, COUNT(*) AS games_played,
             SUM(CASE WHEN won THEN 1 ELSE 0 END) AS wins
      FROM game_history
      WHERE created_at >= date_trunc('week', NOW() AT TIME ZONE 'UTC')
      GROUP BY player_id
    )
    SELECT ps.player_id AS "playerId", p.player_name AS "playerName",
           p.avatar_color AS "avatarColor", p.profile_picture AS "picture", p.equipped_frame AS "equippedFrame", p.equipped_avatar AS "equippedAvatar", p.equipped_title AS "equippedTitle", ps.total_score AS "totalScore",
           ps.games_played AS "gamesPlayed", ps.wins AS wins,
           1 + (SELECT COUNT(*) FROM period_scores higher WHERE higher.total_score > ps.total_score) AS rank
    FROM period_scores ps
    LEFT JOIN player_scores p ON p.player_id = ps.player_id
    WHERE ps.player_id = ${playerId}
    LIMIT 1
  `);

  const row = rows.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    res.json({ playerId, rank: null, totalScore: 0, gamesPlayed: 0, wins: 0 });
    return;
  }
  res.json({
    playerId: row.playerId, playerName: row.playerName ?? "—",
    avatarColor: row.avatarColor ?? "#e53e3e", picture: row.picture ?? null, avatarFrame: row.equippedFrame ?? null, avatarGlyph: equippedAvatarGlyph(row.equippedAvatar), equippedTitle: row.equippedTitle ?? null, totalScore: Number(row.totalScore ?? 0),
    gamesPlayed: Number(row.gamesPlayed ?? 0), wins: Number(row.wins ?? 0),
    rank: Number(row.rank ?? 0),
  });
});
// ============================================================
// RANKING MENSUAL
// ============================================================
router.get("/monthly", async (_req, res) => {
  const rows = await db.execute(sql`
    SELECT
      gh.player_id        AS "playerId",
      ps.player_name      AS "playerName",
      ps.avatar_color     AS "avatarColor",
      ps.profile_picture  AS "picture",
      ps.equipped_frame   AS "equippedFrame",
      ps.current_streak   AS "currentStreak",
      ps.is_premium       AS "isPremium",
      ps.achievements_json AS "achievementsJson",
      SUM(gh.score)       AS "totalScore",
      COUNT(*)            AS "gamesPlayed",
      SUM(CASE WHEN gh.won THEN 1 ELSE 0 END) AS "wins",
      RANK() OVER (ORDER BY SUM(gh.score) DESC) AS "rank"
    FROM game_history gh
    LEFT JOIN player_scores ps ON gh.player_id = ps.player_id
    WHERE gh.created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
    GROUP BY gh.player_id, ps.player_name, ps.avatar_color, ps.profile_picture, ps.equipped_frame, ps.equipped_avatar, ps.equipped_title, ps.current_streak, ps.is_premium, ps.achievements_json
    ORDER BY SUM(gh.score) DESC
    LIMIT 100
  `);

  const players = (rows.rows as Array<Record<string, unknown>>).map((p, i) => ({
    playerId:      p.playerId,
    playerName:    p.playerName ?? "—",
    avatarColor:   p.avatarColor ?? "#e53e3e",
    totalScore:    Number(p.totalScore ?? 0),
    gamesPlayed:   Number(p.gamesPlayed ?? 0),
    wins:          Number(p.wins ?? 0),
    currentStreak: Number(p.currentStreak ?? 0),
    isPremium:     p.isPremium ?? false,
    achievementCount: parseAchievementCount(p.achievementsJson),
    title:         getTitle(Number(p.rank ?? (i + 1))),
    rank:         i + 1,
  }));

  const now = new Date();
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  res.json({ players, nextReset: nextReset.toISOString() });
});

// ============================================================
// POSICIÓN PERSONAL MENSUAL (PRIVADA)
// ============================================================
router.get("/monthly/me", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const playerId = req.playerId!;
  const rows = await db.execute(sql`
    WITH period_scores AS (
      SELECT player_id, SUM(score) AS total_score, COUNT(*) AS games_played,
             SUM(CASE WHEN won THEN 1 ELSE 0 END) AS wins
      FROM game_history
      WHERE created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
      GROUP BY player_id
    )
    SELECT ps.player_id AS "playerId", p.player_name AS "playerName",
           p.avatar_color AS "avatarColor", p.profile_picture AS "picture", p.equipped_frame AS "equippedFrame", p.equipped_avatar AS "equippedAvatar", p.equipped_title AS "equippedTitle", ps.total_score AS "totalScore",
           ps.games_played AS "gamesPlayed", ps.wins AS wins,
           1 + (SELECT COUNT(*) FROM period_scores higher WHERE higher.total_score > ps.total_score) AS rank
    FROM period_scores ps
    LEFT JOIN player_scores p ON p.player_id = ps.player_id
    WHERE ps.player_id = ${playerId}
    LIMIT 1
  `);

  const row = rows.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    res.json({ playerId, rank: null, totalScore: 0, gamesPlayed: 0, wins: 0 });
    return;
  }
  res.json({
    playerId: row.playerId, playerName: row.playerName ?? "—",
    avatarColor: row.avatarColor ?? "#e53e3e", picture: row.picture ?? null, avatarFrame: row.equippedFrame ?? null, avatarGlyph: equippedAvatarGlyph(row.equippedAvatar), equippedTitle: row.equippedTitle ?? null, totalScore: Number(row.totalScore ?? 0),
    gamesPlayed: Number(row.gamesPlayed ?? 0), wins: Number(row.wins ?? 0),
    rank: Number(row.rank ?? 0),
  });
});
// ============================================================
// PERFIL DE JUGADOR
// ============================================================
router.get("/profile/:playerId", async (req, res) => {
  const { playerId } = req.params;

  const scoreRows = await db
    .select()
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);

  if (scoreRows.length === 0) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const ps = scoreRows[0];

  const [rankRow, monthlyRow, modeRows, recentRows] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*) AS cnt FROM player_scores WHERE total_score > ${ps.totalScore}
    `),
    db.execute(sql`
      SELECT COALESCE(SUM(score), 0) AS monthly_score
      FROM game_history
      WHERE player_id = ${playerId}
        AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
    `),
    db.execute(sql`
      SELECT
        mode,
        COUNT(*)                                      AS games,
        COALESCE(SUM(score), 0)                       AS total_score,
        COALESCE(MAX(score), 0)                       AS best_score,
        SUM(CASE WHEN won THEN 1 ELSE 0 END)          AS wins
      FROM game_history
      WHERE player_id = ${playerId}
      GROUP BY mode
    `),
    db.execute(sql`
      SELECT id, score, letter, mode, won, created_at
      FROM game_history
      WHERE player_id = ${playerId}
      ORDER BY created_at DESC
      LIMIT 20
    `),
  ]);

  const globalRank = Number((rankRow.rows[0] as any)?.cnt ?? 0) + 1;
  const monthlyScore = Number((monthlyRow.rows[0] as any)?.monthly_score ?? 0);

  const modeStats: Record<string, any> = {};
  for (const row of modeRows.rows as any[]) {
    modeStats[row.mode] = {
      games: Number(row.games),
      totalScore: Number(row.total_score),
      bestScore: Number(row.best_score),
      wins: Number(row.wins),
    };
  }

  const recentGames = (recentRows.rows as any[]).map(r => ({
    id: r.id,
    score: Number(r.score),
    letter: r.letter,
    mode: r.mode,
    won: r.won,
    createdAt: r.created_at,
  }));

  res.json({
    playerId: ps.playerId,
    playerName: ps.playerName,
    avatarColor: ps.avatarColor,
    picture: ps.profilePicture ?? null,
    avatarFrame: ps.equippedFrame ?? null,
    avatarGlyph: equippedAvatarGlyph(ps.equippedAvatar),
    equippedTitle: ps.equippedTitle ?? null,
    totalScore: ps.totalScore,
    gamesPlayed: ps.gamesPlayed,
    wins: ps.wins,
    currentStreak: ps.currentStreak ?? 0,
    longestStreak: ps.longestStreak ?? 0,
    isPremium: ps.isPremium ?? false,
    xp: ps.xp ?? 0,
    level: ps.level ?? 1,
    coins: ps.coins ?? 0,
    globalRank,
    monthlyScore,
    modeStats,
    recentGames,
  });
});

// ============================================================
// POST /scores
// ============================================================
router.post("/scores", scoreLimiter, async (req, res) => {
  const body = SubmitScoreBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { playerId, playerName, avatarColor, score: rawScore, letter, mode, won, bonus, scoreTokens, submissionId } = body.data;

  if (!await verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }

  const isBonus = bonus === true;

  // Every authoritative client submission carries a stable ID for the logical
  // score write. A retry must resolve to the already-accepted write rather than
  // crediting score/XP/coins/history a second time. Legacy requests without an
  // ID are still accepted only when they carry server vouchers (those vouchers
  // already provide replay protection); unverified offline requests must use
  // the idempotency key.
  if (typeof submissionId === "string" && !/^[A-Za-z0-9._:-]{8,160}$/.test(submissionId)) {
    res.status(400).json({ error: "INVALID_SUBMISSION_ID" });
    return;
  }
  if (!submissionId && !isBonus && (!Array.isArray(scoreTokens) || scoreTokens.length === 0)) {
    res.status(422).json({ error: "SUBMISSION_ID_REQUIRED" });
    return;
  }
  if (submissionId) {
    const [priorClaim] = await db
      .select({ id: scoreSubmissionClaimsTable.id })
      .from(scoreSubmissionClaimsTable)
      .where(sql`${scoreSubmissionClaimsTable.playerId} = ${playerId}
        AND ${scoreSubmissionClaimsTable.submissionId} = ${submissionId}
        AND ${scoreSubmissionClaimsTable.isBonus} = ${isBonus}`)
      .limit(1);
    if (priorClaim) {
      const [currentPlayer] = await db
        .select()
        .from(playerScoresTable)
        .where(eq(playerScoresTable.playerId, playerId))
        .limit(1);
      if (!currentPlayer) {
        res.status(409).json({ error: "SUBMISSION_ALREADY_CLAIMED" });
        return;
      }
      res.status(201).json({
        ...currentPlayer,
        rank: 0,
        rewards: { xpAwarded: 0, coinsAwarded: 0, happyHourActive: false, multiplier: 1 },
      });
      return;
    }
  }
  // Keep the bonus claim identity outside the validation block because the
  // same value is atomically consumed inside the transaction below.
  let bonusClaimTokenSetHash: string | null = null;

  // A rewarded-video bonus must consume a server-issued, single-use claim
  // created from the exact voucher set that funded the original score.
  if (isBonus) {
    if (mode !== "solo") {
      res.status(422).json({ error: "INVALID_BONUS_MODE" });
      return;
    }
    bonusClaimTokenSetHash = bonusTokenSetHash(playerId, scoreTokens);
    if (!bonusClaimTokenSetHash) {
      res.status(422).json({ error: "BONUS_PROOF_REQUIRED" });
      return;
    }
    await db.delete(scoreBonusClaimsTable).where(sql`${scoreBonusClaimsTable.expiresAt} < NOW()`);
    const [availableClaim] = await db
      .select({ tokenSetHash: scoreBonusClaimsTable.tokenSetHash, maxScore: scoreBonusClaimsTable.maxScore })
      .from(scoreBonusClaimsTable)
      .where(sql`${scoreBonusClaimsTable.tokenSetHash} = ${bonusClaimTokenSetHash} AND ${scoreBonusClaimsTable.playerId} = ${playerId}`)
      .limit(1);
    if (!availableClaim || rawScore <= 0 || rawScore > availableClaim.maxScore) {
      res.status(422).json({ error: "INVALID_BONUS_SCORE" });
      return;
    }
  }

  const existingForBonus = isBonus
    ? await db.select().from(playerScoresTable).where(eq(playerScoresTable.playerId, playerId)).limit(1)
    : [];

  const { base: verifiedBase, verified, collectionWords, mode: certifiedMode, aiBase: certifiedAiBase, voucherJtis } = isBonus
    ? { base: 0, verified: 0, collectionWords: [] as Array<{ word: string; category: string }>, mode: null, aiBase: 0 }
    // /ranking/scores is the client solo leaderboard path. Keep its voucher
    // count cap independent of the client-supplied `mode`; otherwise a caller
    // could request `multiplayer` and raise the cap from 3 rounds to 12.
    : await sumVerifiedBasePersistent(scoreTokens, 3);
  // A request that supplies vouchers must prove at least one fresh voucher.
  // Otherwise a replay of an already-consumed token set would fall through
  // to the offline absolute ceiling and could credit the same score again.
  const suppliedTokens = Array.isArray(scoreTokens) && scoreTokens.length > 0;
  if (!isBonus && suppliedTokens && verified === 0) {
    res.status(422).json({ error: "INVALID_SCORE_VOUCHER" });
    return;
  }
  // Offline submissions legitimately have no round voucher. They are still
  // bounded by the absolute per-mode ceiling below; only requests with no
  // vouchers at all use that fallback.
  const ceiling = isBonus
    ? existingForBonus[0].totalScore
    : (verified > 0 ? ceilingFromBase(verifiedBase) : absoluteCeiling(certifiedMode ?? "solo"));
  const cappedRaw = Math.max(0, Math.min(rawScore, ceiling));
  // 🔒 Never trust the request body for the multiplayer multiplier. It is
  // derived only from the HMAC-signed voucher metadata. Legacy vouchers have
  // no certified mode and therefore can never receive the x1.5 multiplier.
  const score = certifiedMode === "multiplayer" ? Math.round(cappedRaw * 1.5) : cappedRaw;
  // 🔒 Rewards must use the same authoritative mode as the score. Never let
  // the request body select the multiplayer XP/coin rules for a Solo voucher.
  const effectiveMode = certifiedMode ?? "solo";

  const existing = await db
    .select()
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);

  const oldTotal = existing.length > 0 ? existing[0].totalScore : 0;
  const newTotal = oldTotal + score;

  const today = new Date().toISOString().split("T")[0];
  let authoritativeStreak = existing[0]?.currentStreak ?? 0;

  // 🔒 For voucher-backed Solo submissions, the win/loss result must come
  // from the server-signed AI score, not from the client body. Legacy/offline
  // submissions have no trusted AI score and therefore cannot claim a win.
  const authoritativeWon = !isBonus && certifiedMode === "solo" && verified > 0 && certifiedAiBase !== null
    ? verifiedBase > certifiedAiBase
    : false;
  const effectiveWon = authoritativeWon;

  const overtaken = score > 0 && newTotal > oldTotal
    ? await db
        .select({ playerId: playerScoresTable.playerId, playerName: playerScoresTable.playerName })
        .from(playerScoresTable)
        .where(
          sql`${playerScoresTable.totalScore} > ${oldTotal}
          AND ${playerScoresTable.totalScore} <= ${newTotal}
          AND ${playerScoresTable.playerId} != ${playerId}`
        )
    : [];

  const baseXpGain = calcXpGain(score, effectiveWon, effectiveMode);
  const baseCoinGain = calcCoinGain(score, effectiveWon, effectiveMode, isBonus);
  const playerTimezone = await lookupPlayerTimezone(playerId);
  const happyHourActive = playerTimezone.timeZone
    ? isHappyHourActiveForTimeZone(playerTimezone.timeZone)
    : playerTimezone.tzOffset !== null && isHappyHourActiveForTzOffset(playerTimezone.tzOffset);
  const xpMultiplier = happyHourActive ? HAPPY_HOUR_MULTIPLIER : 1;
  const coinMultiplier = happyHourActive ? HAPPY_HOUR_MULTIPLIER : 1;
  const xpGain = baseXpGain * xpMultiplier;
  const coinGain = baseCoinGain * coinMultiplier;
  const newXp = (existing[0]?.xp ?? 0) + xpGain;
  const newLevel = calcLevel(newXp);

  let player;
  let duplicateSubmission = false;
  if (isBonus) {
    const bonusResult = await db.transaction(async (tx) => {
      if (submissionId) {
        const [claim] = await tx
          .insert(scoreSubmissionClaimsTable)
          .values({ playerId, submissionId, isBonus: true })
          .onConflictDoNothing()
          .returning({ id: scoreSubmissionClaimsTable.id });
        if (!claim) {
          duplicateSubmission = true;
          const [currentPlayer] = await tx
            .select()
            .from(playerScoresTable)
            .where(eq(playerScoresTable.playerId, playerId))
            .limit(1);
          return currentPlayer ?? null;
        }
      }

      const [claimed] = await tx
        .delete(scoreBonusClaimsTable)
        .where(sql`${scoreBonusClaimsTable.tokenSetHash} = ${bonusClaimTokenSetHash} AND ${scoreBonusClaimsTable.playerId} = ${playerId}`)
        .returning({
          tokenSetHash: scoreBonusClaimsTable.tokenSetHash,
          maxScore: scoreBonusClaimsTable.maxScore,
        });
      if (!claimed || rawScore <= 0 || rawScore > claimed.maxScore) return null;

      if (existing.length > 0) {
        const [updated] = await tx
          .update(playerScoresTable)
          .set({
            playerName,
            avatarColor: avatarColor ?? existing[0].avatarColor,
            totalScore: sql`${playerScoresTable.totalScore} + ${score}`,
            xp: sql`${playerScoresTable.xp} + ${xpGain}`,
            level: sql`GREATEST(${playerScoresTable.level}, ${newLevel})`,
            updatedAt: new Date(),
          })
          .where(eq(playerScoresTable.playerId, playerId))
          .returning();
        if (!updated) throw new Error("BONUS_SCORE_UPDATE_FAILED");
        await tx.insert(gameHistoryTable).values({
          playerId,
          score,
          letter,
          mode: mode ?? "solo",
          won: effectiveWon,
        });
        return updated;
      }

      const [created] = await tx
        .insert(playerScoresTable)
        .values({
          playerId,
          playerName,
          avatarColor: avatarColor ?? "#e53e3e",
          totalScore: score,
          gamesPlayed: 0,
          wins: 0,
          currentStreak: 0,
          longestStreak: 0,
          lastPlayedDate: null,
          streakDaysJson: "[]",
          xp: xpGain,
          level: calcLevel(xpGain),
          coins: coinGain,
        })
        .onConflictDoUpdate({
          target: playerScoresTable.playerId,
          set: {
            playerName,
            avatarColor: avatarColor ?? "#e53e3e",
            totalScore: sql`${playerScoresTable.totalScore} + ${score}`,
            gamesPlayed: sql`${playerScoresTable.gamesPlayed}`,
            wins: sql`${playerScoresTable.wins}`,
            xp: sql`${playerScoresTable.xp} + ${xpGain}`,
            level: sql`GREATEST(${playerScoresTable.level}, ${calcLevel(xpGain)})`,
            coins: sql`${playerScoresTable.coins} + ${coinGain}`,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!created) throw new Error("BONUS_SCORE_INSERT_FAILED");
      await tx.insert(gameHistoryTable).values({
        playerId,
        score,
        letter,
        mode: mode ?? "solo",
        won: effectiveWon,
      });
      return created;
    });

    if (!bonusResult) {
      res.status(422).json({ error: "INVALID_BONUS_SCORE" });
      return;
    }
    player = bonusResult;
    if (duplicateSubmission) {
      res.status(201).json({
        ...player,
        rank: 0,
        rewards: { xpAwarded: 0, coinsAwarded: 0, happyHourActive: false, multiplier: 1 },
      });
      return;
    }
  } else {
    try {
      player = await db.transaction(async (tx) => {
      if (submissionId) {
        const [claim] = await tx
          .insert(scoreSubmissionClaimsTable)
          .values({ playerId, submissionId, isBonus: false })
          .onConflictDoNothing()
          .returning({ id: scoreSubmissionClaimsTable.id });
        if (!claim) {
          duplicateSubmission = true;
          const [currentPlayer] = await tx
            .select()
            .from(playerScoresTable)
            .where(eq(playerScoresTable.playerId, playerId))
            .limit(1);
          return currentPlayer ?? null;
        }
      }

      if (!isBonus) {
        await applyAuthoritativeSeasonEventsInTransaction(tx, playerId, [
          { type: "play_game", value: 1 },
          ...(effectiveWon ? [{ type: "win_game", value: 1 }] : []),
          { type: "round_score", value: score },
          ...(collectionWords.length > 0 ? [{ type: "valid_words", value: collectionWords.length }] : []),
        ]);
      }

      if (verified > 0 && voucherJtis.length > 0) {
        await consumeScoreVoucherJtis(tx, voucherJtis);
      }

      const lockedRows = await tx
        .select()
        .from(playerScoresTable)
        .where(eq(playerScoresTable.playerId, playerId))
        .for("update");
      const lockedExisting = lockedRows[0];
      const lockedToday = new Date().toISOString().split("T")[0];
      const { newStreak: lockedStreak, updatedToday: lockedUpdatedToday } = calculateStreak(
        lockedExisting?.lastPlayedDate ?? null,
        lockedExisting?.currentStreak ?? 0,
      );
      const lockedLongest = Math.max(lockedExisting?.longestStreak ?? 0, lockedStreak);
      const lockedStreakDaysJson = lockedUpdatedToday
        ? appendStreakDay(lockedExisting?.streakDaysJson, lockedToday)
        : undefined;
      authoritativeStreak = lockedStreak;

      if (!isBonus) {
        await applyAuthoritativeSeasonEventsInTransaction(tx, playerId, [
          { type: "streak", value: lockedStreak },
        ]);
      }

      let txPlayer;
      if (existing.length > 0) {
    const [updated] = await tx
      .update(playerScoresTable)
      .set({
        playerName,
        avatarColor: avatarColor ?? existing[0].avatarColor,
        totalScore: sql`${playerScoresTable.totalScore} + ${score}`,
        ...(isBonus ? {} : {
          gamesPlayed: sql`${playerScoresTable.gamesPlayed} + 1`,
          wins: sql`${playerScoresTable.wins} + ${effectiveWon ? 1 : 0}`,
        }),
        xp: sql`${playerScoresTable.xp} + ${xpGain}`,
        // Concurrency hardening: another simultaneous score submission may have
        // advanced XP/level after the snapshot above. Never allow this request
        // to overwrite a newer, higher level with a stale lower one.
        level: sql`GREATEST(${playerScoresTable.level}, ${newLevel})`,
        ...(coinGain > 0 ? { coins: sql`${playerScoresTable.coins} + ${coinGain}` } : {}),
        ...(!isBonus && lockedUpdatedToday ? {
          currentStreak: lockedStreak,
          longestStreak: lockedLongest,
          lastPlayedDate: lockedToday,
          streakDaysJson: lockedStreakDaysJson,
        } : {}),
        updatedAt: new Date(),
      })
      .where(eq(playerScoresTable.playerId, playerId))
      .returning();
    txPlayer = updated;
      } else {
    // First-time players can receive two legitimate score submissions at nearly
    // the same instant (for example, two tabs or a reconnect retry). The old
    // plain INSERT could lose that race with a unique-key error and turn a
    // successful game into a 500. Keep the first row and atomically add the
    // concurrent submission instead.
    const [created] = await tx
      .insert(playerScoresTable)
      .values({
        playerId,
        playerName,
        avatarColor: avatarColor ?? "#e53e3e",
        totalScore: score,
        gamesPlayed: isBonus ? 0 : 1,
        wins: isBonus ? 0 : (effectiveWon ? 1 : 0),
        currentStreak: isBonus ? 0 : 1,
        longestStreak: isBonus ? 0 : 1,
        lastPlayedDate: isBonus ? null : today,
        streakDaysJson: isBonus ? "[]" : JSON.stringify([today]),
        xp: xpGain,
        level: calcLevel(xpGain),
        coins: coinGain,
      })
      .onConflictDoUpdate({
        target: playerScoresTable.playerId,
        set: {
          playerName,
          avatarColor: avatarColor ?? "#e53e3e",
          totalScore: sql`${playerScoresTable.totalScore} + ${score}`,
          gamesPlayed: sql`${playerScoresTable.gamesPlayed} + ${isBonus ? 0 : 1}`,
          wins: sql`${playerScoresTable.wins} + ${isBonus || !effectiveWon ? 0 : 1}`,
          xp: sql`${playerScoresTable.xp} + ${xpGain}`,
          level: sql`GREATEST(${playerScoresTable.level}, ${calcLevel(xpGain)})`,
          coins: sql`${playerScoresTable.coins} + ${coinGain}`,
          updatedAt: new Date(),
        },
      })
      .returning();
    txPlayer = created;
      }

      if (!txPlayer) throw new Error("SCORE_UPDATE_FAILED");
      await tx.insert(gameHistoryTable).values({
        playerId,
        score,
        letter,
        mode: effectiveMode,
        won: effectiveWon,
      });

      // Halloween Solo completion is part of the same transaction as the
      // score/history mutation. If the transaction rolls back, Halloween progress
      // rolls back too; if it commits, the completion cannot be lost in a process
      // crash between two independent transactions.
      if (certifiedMode === "solo" && Array.isArray(scoreTokens) && scoreTokens.length > 0) {
        const halloweenEventKey = bonusTokenSetHash(playerId, scoreTokens);
        if (halloweenEventKey) {
          await recordHalloweenEventInTransaction(
            tx,
            playerId,
            "game_completed",
            `solo:${halloweenEventKey}`,
            isHalloweenPreviewAuthorized(req),
          );
        }
      }

      // Keep voucher-backed collection words in the same transaction as the score.
      if (!isBonus && verified > 0 && scoreTokens) {
        const tokenSetHash = bonusTokenSetHash(playerId, scoreTokens);
        if (tokenSetHash) {
          await tx.insert(scoreBonusClaimsTable).values({
            tokenSetHash,
            playerId,
            maxScore: score,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          }).onConflictDoNothing();
        }
      }

      if (collectionWords.length > 0) {
        const collectionRows = await tx.execute(sql`
          SELECT id, collected_words_json
          FROM player_scores
          WHERE player_id = ${playerId}
          FOR UPDATE
        `) as unknown as { rows?: Array<{ id: number; collected_words_json: string }> };
        const collectionRow = collectionRows.rows?.[0];
        if (!collectionRow) throw new Error("COLLECTION_PLAYER_NOT_FOUND");

        let current: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(collectionRow.collected_words_json ?? "{}");
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            current = parsed as Record<string, unknown>;
          }
        } catch {}

        for (const entry of collectionWords) {
          const word = entry.word.trim().slice(0, 80);
          const category = entry.category.trim().slice(0, 80);
          if (!word || !category || Object.keys(current).length >= 500) break;
          if (!Object.prototype.hasOwnProperty.call(current, word)) current[word] = category;
        }

        await tx.update(playerScoresTable)
          .set({ collectedWordsJson: JSON.stringify(current), updatedAt: new Date() })
          .where(eq(playerScoresTable.id, collectionRow.id));
      }

      return txPlayer;
      });
    } catch (error) {
      if (error instanceof Error && error.message === "SCORE_VOUCHER_CONFLICT") {
        res.status(422).json({ error: "INVALID_SCORE_VOUCHER" });
        return;
      }
      throw error;
    }
    if (duplicateSubmission) {
      res.status(201).json({
        ...player,
        rank: 0,
        rewards: { xpAwarded: 0, coinsAwarded: 0, happyHourActive: false, multiplier: 1 },
      });
      return;
    }
  }

  if (overtaken.length > 0) {
    await Promise.allSettled(
      overtaken.map(op =>
        sendPushToPlayer(op.playerId, {
          title: "¡Te han superado! 😤",
          body: `${playerName} acaba de quitarte el puesto en el ranking global. ¡Hora de vengarse!`,
          url: "/ranking",
        })
      )
    );
  }

  if (!isBonus) {
    void recordTrustedAnalyticsEvent({
      eventName: "game_complete",
      playerId,
      mode: effectiveMode,
      metadata: { source: "server_score_submission" },
    }).catch((err) => console.error("[analytics] trusted game_complete failed:", err));


  }

  res.status(201).json({
    ...player,
    rank: 0,
    rewards: {
      xpAwarded: xpGain,
      coinsAwarded: coinGain,
      happyHourActive,
      multiplier: happyHourActive ? HAPPY_HOUR_MULTIPLIER : 1,
    },
  });
});

// ============================================================
// GET /scores/:playerId
// ============================================================
router.get("/scores/:playerId", async (req, res) => {
  const { playerId } = req.params;

  const scores = await db
    .select()
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);

  if (scores.length === 0) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const ps = scores[0];

  const [rankRow, bestRow, recentGames] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*) AS cnt FROM player_scores WHERE total_score > ${ps.totalScore}
    `),
    db.execute(sql`
      SELECT COALESCE(MAX(score), 0) AS best FROM game_history WHERE player_id = ${playerId}
    `),
    db
      .select()
      .from(gameHistoryTable)
      .where(eq(gameHistoryTable.playerId, playerId))
      .orderBy(desc(gameHistoryTable.createdAt))
      .limit(10),
  ]);

  const globalRank = Number((rankRow.rows[0] as any)?.cnt ?? 0) + 1;
  const bestScore = Number((bestRow.rows[0] as any)?.best ?? 0);

  // Public endpoint: never expose billing identifiers, inventory, collection,
  // streak internals, or other private persistence fields from player_scores.
  res.json({
    score: {
      playerId: ps.playerId,
      playerName: ps.playerName,
      avatarColor: ps.avatarColor,
      totalScore: ps.totalScore,
      gamesPlayed: ps.gamesPlayed,
      wins: ps.wins,
      isPremium: ps.isPremium,
      currentStreak: ps.currentStreak,
      longestStreak: ps.longestStreak,
      xp: ps.xp,
      level: ps.level,
      coins: ps.coins,
      equippedAvatar: ps.equippedAvatar,
      equippedFrame: ps.equippedFrame,
      equippedBackground: ps.equippedBackground,
      equippedTitle: ps.equippedTitle,
      rank: globalRank,
      globalRank,
      bestScore,
    },
    recentGames,
  });
});

export default router;

    LEFT JOIN player_scores ps ON gh.player_id = ps.player_id
    WHERE gh.created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
    GROUP BY gh.player_id, ps.player_name, ps.avatar_color, ps.profile_picture, ps.equipped_frame, ps.equipped_avatar, ps.equipped_title, ps.current_streak, ps.is_premium, ps.achievements_json
    ORDER BY SUM(gh.score) DESC
    LIMIT 100
  `);

  const players = (rows.rows as Array<Record<string, unknown>>).map((p, i) => ({
    playerId:      p.playerId,
    playerName:    p.playerName ?? "—",
    avatarColor:   p.avatarColor ?? "#e53e3e",
    totalScore:    Number(p.totalScore ?? 0),
    gamesPlayed:   Number(p.gamesPlayed ?? 0),
    wins:          Number(p.wins ?? 0),
    currentStreak: Number(p.currentStreak ?? 0),
    isPremium:     p.isPremium ?? false,
    achievementCount: parseAchievementCount(p.achievementsJson),
    title:         getTitle(i + 1),
    rank:         i + 1,
  }));

  const now = new Date();
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  res.json({ players, nextReset: nextReset.toISOString() });
});

// ============================================================
// POSICIÓN PERSONAL MENSUAL (PRIVADA)
// ============================================================
router.get("/monthly/me", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const playerId = req.playerId!;
  const rows = await db.execute(sql`
    WITH period_scores AS (
      SELECT player_id, SUM(score) AS total_score, COUNT(*) AS games_played,
             SUM(CASE WHEN won THEN 1 ELSE 0 END) AS wins
      FROM game_history
      WHERE created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
      GROUP BY player_id
    )
    SELECT ps.player_id AS "playerId", p.player_name AS "playerName",
           p.avatar_color AS "avatarColor", p.profile_picture AS "picture", p.equipped_frame AS "equippedFrame", p.equipped_avatar AS "equippedAvatar", p.equipped_title AS "equippedTitle", ps.total_score AS "totalScore",
           ps.games_played AS "gamesPlayed", ps.wins AS wins,
           1 + (SELECT COUNT(*) FROM period_scores higher WHERE higher.total_score > ps.total_score) AS rank
    FROM period_scores ps
    LEFT JOIN player_scores p ON p.player_id = ps.player_id
    WHERE ps.player_id = ${playerId}
    LIMIT 1
  `);

  const row = rows.rows[0] as Record<string, unknown> | undefined;
  if (!row) {
    res.json({ playerId, rank: null, totalScore: 0, gamesPlayed: 0, wins: 0 });
    return;
  }
  res.json({
    playerId: row.playerId, playerName: row.playerName ?? "—",
    avatarColor: row.avatarColor ?? "#e53e3e", picture: row.picture ?? null, avatarFrame: row.equippedFrame ?? null, avatarGlyph: equippedAvatarGlyph(row.equippedAvatar), equippedTitle: row.equippedTitle ?? null, totalScore: Number(row.totalScore ?? 0),
    gamesPlayed: Number(row.gamesPlayed ?? 0), wins: Number(row.wins ?? 0),
    rank: Number(row.rank ?? 0),
  });
});
// ============================================================
// PERFIL DE JUGADOR
// ============================================================
router.get("/profile/:playerId", async (req, res) => {
  const { playerId } = req.params;

  const scoreRows = await db
    .select()
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);

  if (scoreRows.length === 0) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const ps = scoreRows[0];

  const [rankRow, monthlyRow, modeRows, recentRows] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*) AS cnt FROM player_scores WHERE total_score > ${ps.totalScore}
    `),
    db.execute(sql`
      SELECT COALESCE(SUM(score), 0) AS monthly_score
      FROM game_history
      WHERE player_id = ${playerId}
        AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
    `),
    db.execute(sql`
      SELECT
        mode,
        COUNT(*)                                      AS games,
        COALESCE(SUM(score), 0)                       AS total_score,
        COALESCE(MAX(score), 0)                       AS best_score,
        SUM(CASE WHEN won THEN 1 ELSE 0 END)          AS wins
      FROM game_history
      WHERE player_id = ${playerId}
      GROUP BY mode
    `),
    db.execute(sql`
      SELECT id, score, letter, mode, won, created_at
      FROM game_history
      WHERE player_id = ${playerId}
      ORDER BY created_at DESC
      LIMIT 20
    `),
  ]);

  const globalRank = Number((rankRow.rows[0] as any)?.cnt ?? 0) + 1;
  const monthlyScore = Number((monthlyRow.rows[0] as any)?.monthly_score ?? 0);

  const modeStats: Record<string, any> = {};
  for (const row of modeRows.rows as any[]) {
    modeStats[row.mode] = {
      games: Number(row.games),
      totalScore: Number(row.total_score),
      bestScore: Number(row.best_score),
      wins: Number(row.wins),
    };
  }

  const recentGames = (recentRows.rows as any[]).map(r => ({
    id: r.id,
    score: Number(r.score),
    letter: r.letter,
    mode: r.mode,
    won: r.won,
    createdAt: r.created_at,
  }));

  res.json({
    playerId: ps.playerId,
    playerName: ps.playerName,
    avatarColor: ps.avatarColor,
    picture: ps.profilePicture ?? null,
    avatarFrame: ps.equippedFrame ?? null,
    avatarGlyph: equippedAvatarGlyph(ps.equippedAvatar),
    equippedTitle: ps.equippedTitle ?? null,
    totalScore: ps.totalScore,
    gamesPlayed: ps.gamesPlayed,
    wins: ps.wins,
    currentStreak: ps.currentStreak ?? 0,
    longestStreak: ps.longestStreak ?? 0,
    isPremium: ps.isPremium ?? false,
    xp: ps.xp ?? 0,
    level: ps.level ?? 1,
    coins: ps.coins ?? 0,
    globalRank,
    monthlyScore,
    modeStats,
    recentGames,
  });
});

// ============================================================
// POST /scores
// ============================================================
router.post("/scores", scoreLimiter, async (req, res) => {
  const body = SubmitScoreBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { playerId, playerName, avatarColor, score: rawScore, letter, mode, won, bonus, scoreTokens, submissionId } = body.data;

  if (!await verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }

  const isBonus = bonus === true;

  // Every authoritative client submission carries a stable ID for the logical
  // score write. A retry must resolve to the already-accepted write rather than
  // crediting score/XP/coins/history a second time. Legacy requests without an
  // ID are still accepted only when they carry server vouchers (those vouchers
  // already provide replay protection); unverified offline requests must use
  // the idempotency key.
  if (typeof submissionId === "string" && !/^[A-Za-z0-9._:-]{8,160}$/.test(submissionId)) {
    res.status(400).json({ error: "INVALID_SUBMISSION_ID" });
    return;
  }
  if (!submissionId && !isBonus && (!Array.isArray(scoreTokens) || scoreTokens.length === 0)) {
    res.status(422).json({ error: "SUBMISSION_ID_REQUIRED" });
    return;
  }
  if (submissionId) {
    const [priorClaim] = await db
      .select({ id: scoreSubmissionClaimsTable.id })
      .from(scoreSubmissionClaimsTable)
      .where(sql`${scoreSubmissionClaimsTable.playerId} = ${playerId}
        AND ${scoreSubmissionClaimsTable.submissionId} = ${submissionId}
        AND ${scoreSubmissionClaimsTable.isBonus} = ${isBonus}`)
      .limit(1);
    if (priorClaim) {
      const [currentPlayer] = await db
        .select()
        .from(playerScoresTable)
        .where(eq(playerScoresTable.playerId, playerId))
        .limit(1);
      if (!currentPlayer) {
        res.status(409).json({ error: "SUBMISSION_ALREADY_CLAIMED" });
        return;
      }
      res.status(201).json({
        ...currentPlayer,
        rank: 0,
        rewards: { xpAwarded: 0, coinsAwarded: 0, happyHourActive: false, multiplier: 1 },
      });
      return;
    }
  }
  // Keep the bonus claim identity outside the validation block because the
  // same value is atomically consumed inside the transaction below.
  let bonusClaimTokenSetHash: string | null = null;

  // A rewarded-video bonus must consume a server-issued, single-use claim
  // created from the exact voucher set that funded the original score.
  if (isBonus) {
    if (mode !== "solo") {
      res.status(422).json({ error: "INVALID_BONUS_MODE" });
      return;
    }
    bonusClaimTokenSetHash = bonusTokenSetHash(playerId, scoreTokens);
    if (!bonusClaimTokenSetHash) {
      res.status(422).json({ error: "BONUS_PROOF_REQUIRED" });
      return;
    }
    await db.delete(scoreBonusClaimsTable).where(sql`${scoreBonusClaimsTable.expiresAt} < NOW()`);
    const [availableClaim] = await db
      .select({ tokenSetHash: scoreBonusClaimsTable.tokenSetHash, maxScore: scoreBonusClaimsTable.maxScore })
      .from(scoreBonusClaimsTable)
      .where(sql`${scoreBonusClaimsTable.tokenSetHash} = ${bonusClaimTokenSetHash} AND ${scoreBonusClaimsTable.playerId} = ${playerId}`)
      .limit(1);
    if (!availableClaim || rawScore <= 0 || rawScore > availableClaim.maxScore) {
      res.status(422).json({ error: "INVALID_BONUS_SCORE" });
      return;
    }
  }

  const existingForBonus = isBonus
    ? await db.select().from(playerScoresTable).where(eq(playerScoresTable.playerId, playerId)).limit(1)
    : [];

  const { base: verifiedBase, verified, collectionWords, mode: certifiedMode, aiBase: certifiedAiBase, voucherJtis } = isBonus
    ? { base: 0, verified: 0, collectionWords: [] as Array<{ word: string; category: string }>, mode: null, aiBase: 0 }
    // /ranking/scores is the client solo leaderboard path. Keep its voucher
    // count cap independent of the client-supplied `mode`; otherwise a caller
    // could request `multiplayer` and raise the cap from 3 rounds to 12.
    : await sumVerifiedBasePersistent(scoreTokens, 3);
  // A request that supplies vouchers must prove at least one fresh voucher.
  // Otherwise a replay of an already-consumed token set would fall through
  // to the offline absolute ceiling and could credit the same score again.
  const suppliedTokens = Array.isArray(scoreTokens) && scoreTokens.length > 0;
  if (!isBonus && suppliedTokens && verified === 0) {
    res.status(422).json({ error: "INVALID_SCORE_VOUCHER" });
    return;
  }
  // Offline submissions legitimately have no round voucher. They are still
  // bounded by the absolute per-mode ceiling below; only requests with no
  // vouchers at all use that fallback.
  const ceiling = isBonus
    ? existingForBonus[0].totalScore
    : (verified > 0 ? ceilingFromBase(verifiedBase) : absoluteCeiling(certifiedMode ?? "solo"));
  const cappedRaw = Math.max(0, Math.min(rawScore, ceiling));
  // 🔒 Never trust the request body for the multiplayer multiplier. It is
  // derived only from the HMAC-signed voucher metadata. Legacy vouchers have
  // no certified mode and therefore can never receive the x1.5 multiplier.
  const score = certifiedMode === "multiplayer" ? Math.round(cappedRaw * 1.5) : cappedRaw;
  // 🔒 Rewards must use the same authoritative mode as the score. Never let
  // the request body select the multiplayer XP/coin rules for a Solo voucher.
  const effectiveMode = certifiedMode ?? "solo";

  const existing = await db
    .select()
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);

  const oldTotal = existing.length > 0 ? existing[0].totalScore : 0;
  const newTotal = oldTotal + score;

  const today = new Date().toISOString().split("T")[0];
  let authoritativeStreak = existing[0]?.currentStreak ?? 0;

  // 🔒 For voucher-backed Solo submissions, the win/loss result must come
  // from the server-signed AI score, not from the client body. Legacy/offline
  // submissions have no trusted AI score and therefore cannot claim a win.
  const authoritativeWon = !isBonus && certifiedMode === "solo" && verified > 0 && certifiedAiBase !== null
    ? verifiedBase > certifiedAiBase
    : false;
  const effectiveWon = authoritativeWon;

  const overtaken = score > 0 && newTotal > oldTotal
    ? await db
        .select({ playerId: playerScoresTable.playerId, playerName: playerScoresTable.playerName })
        .from(playerScoresTable)
        .where(
          sql`${playerScoresTable.totalScore} > ${oldTotal}
          AND ${playerScoresTable.totalScore} <= ${newTotal}
          AND ${playerScoresTable.playerId} != ${playerId}`
        )
    : [];

  const baseXpGain = calcXpGain(score, effectiveWon, effectiveMode);
  const baseCoinGain = calcCoinGain(score, effectiveWon, effectiveMode, isBonus);
  const playerTimezone = await lookupPlayerTimezone(playerId);
  const happyHourActive = playerTimezone.timeZone
    ? isHappyHourActiveForTimeZone(playerTimezone.timeZone)
    : playerTimezone.tzOffset !== null && isHappyHourActiveForTzOffset(playerTimezone.tzOffset);
  const xpMultiplier = happyHourActive ? HAPPY_HOUR_MULTIPLIER : 1;
  const coinMultiplier = happyHourActive ? HAPPY_HOUR_MULTIPLIER : 1;
  const xpGain = baseXpGain * xpMultiplier;
  const coinGain = baseCoinGain * coinMultiplier;
  const newXp = (existing[0]?.xp ?? 0) + xpGain;
  const newLevel = calcLevel(newXp);

  let player;
  let duplicateSubmission = false;
  if (isBonus) {
    const bonusResult = await db.transaction(async (tx) => {
      if (submissionId) {
        const [claim] = await tx
          .insert(scoreSubmissionClaimsTable)
          .values({ playerId, submissionId, isBonus: true })
          .onConflictDoNothing()
          .returning({ id: scoreSubmissionClaimsTable.id });
        if (!claim) {
          duplicateSubmission = true;
          const [currentPlayer] = await tx
            .select()
            .from(playerScoresTable)
            .where(eq(playerScoresTable.playerId, playerId))
            .limit(1);
          return currentPlayer ?? null;
        }
      }

      const [claimed] = await tx
        .delete(scoreBonusClaimsTable)
        .where(sql`${scoreBonusClaimsTable.tokenSetHash} = ${bonusClaimTokenSetHash} AND ${scoreBonusClaimsTable.playerId} = ${playerId}`)
        .returning({
          tokenSetHash: scoreBonusClaimsTable.tokenSetHash,
          maxScore: scoreBonusClaimsTable.maxScore,
        });
      if (!claimed || rawScore <= 0 || rawScore > claimed.maxScore) return null;

      if (existing.length > 0) {
        const [updated] = await tx
          .update(playerScoresTable)
          .set({
            playerName,
            avatarColor: avatarColor ?? existing[0].avatarColor,
            totalScore: sql`${playerScoresTable.totalScore} + ${score}`,
            xp: sql`${playerScoresTable.xp} + ${xpGain}`,
            level: sql`GREATEST(${playerScoresTable.level}, ${newLevel})`,
            updatedAt: new Date(),
          })
          .where(eq(playerScoresTable.playerId, playerId))
          .returning();
        if (!updated) throw new Error("BONUS_SCORE_UPDATE_FAILED");
        await tx.insert(gameHistoryTable).values({
          playerId,
          score,
          letter,
          mode: mode ?? "solo",
          won: effectiveWon,
        });
        return updated;
      }

      const [created] = await tx
        .insert(playerScoresTable)
        .values({
          playerId,
          playerName,
          avatarColor: avatarColor ?? "#e53e3e",
          totalScore: score,
          gamesPlayed: 0,
          wins: 0,
          currentStreak: 0,
          longestStreak: 0,
          lastPlayedDate: null,
          streakDaysJson: "[]",
          xp: xpGain,
          level: calcLevel(xpGain),
          coins: coinGain,
        })
        .onConflictDoUpdate({
          target: playerScoresTable.playerId,
          set: {
            playerName,
            avatarColor: avatarColor ?? "#e53e3e",
            totalScore: sql`${playerScoresTable.totalScore} + ${score}`,
            gamesPlayed: sql`${playerScoresTable.gamesPlayed}`,
            wins: sql`${playerScoresTable.wins}`,
            xp: sql`${playerScoresTable.xp} + ${xpGain}`,
            level: sql`GREATEST(${playerScoresTable.level}, ${calcLevel(xpGain)})`,
            coins: sql`${playerScoresTable.coins} + ${coinGain}`,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!created) throw new Error("BONUS_SCORE_INSERT_FAILED");
      await tx.insert(gameHistoryTable).values({
        playerId,
        score,
        letter,
        mode: mode ?? "solo",
        won: effectiveWon,
      });
      return created;
    });

    if (!bonusResult) {
      res.status(422).json({ error: "INVALID_BONUS_SCORE" });
      return;
    }
    player = bonusResult;
    if (duplicateSubmission) {
      res.status(201).json({
        ...player,
        rank: 0,
        rewards: { xpAwarded: 0, coinsAwarded: 0, happyHourActive: false, multiplier: 1 },
      });
      return;
    }
  } else {
    try {
      player = await db.transaction(async (tx) => {
      if (submissionId) {
        const [claim] = await tx
          .insert(scoreSubmissionClaimsTable)
          .values({ playerId, submissionId, isBonus: false })
          .onConflictDoNothing()
          .returning({ id: scoreSubmissionClaimsTable.id });
        if (!claim) {
          duplicateSubmission = true;
          const [currentPlayer] = await tx
            .select()
            .from(playerScoresTable)
            .where(eq(playerScoresTable.playerId, playerId))
            .limit(1);
          return currentPlayer ?? null;
        }
      }

      if (!isBonus) {
        await applyAuthoritativeSeasonEventsInTransaction(tx, playerId, [
          { type: "play_game", value: 1 },
          ...(effectiveWon ? [{ type: "win_game", value: 1 }] : []),
          { type: "round_score", value: score },
          ...(collectionWords.length > 0 ? [{ type: "valid_words", value: collectionWords.length }] : []),
        ]);
      }

      if (verified > 0 && voucherJtis.length > 0) {
        await consumeScoreVoucherJtis(tx, voucherJtis);
      }

      const lockedRows = await tx
        .select()
        .from(playerScoresTable)
        .where(eq(playerScoresTable.playerId, playerId))
        .for("update");
      const lockedExisting = lockedRows[0];
      const lockedToday = new Date().toISOString().split("T")[0];
      const { newStreak: lockedStreak, updatedToday: lockedUpdatedToday } = calculateStreak(
        lockedExisting?.lastPlayedDate ?? null,
        lockedExisting?.currentStreak ?? 0,
      );
      const lockedLongest = Math.max(lockedExisting?.longestStreak ?? 0, lockedStreak);
      const lockedStreakDaysJson = lockedUpdatedToday
        ? appendStreakDay(lockedExisting?.streakDaysJson, lockedToday)
        : undefined;
      authoritativeStreak = lockedStreak;

      if (!isBonus) {
        await applyAuthoritativeSeasonEventsInTransaction(tx, playerId, [
          { type: "streak", value: lockedStreak },
        ]);
      }

      let txPlayer;
      if (existing.length > 0) {
    const [updated] = await tx
      .update(playerScoresTable)
      .set({
        playerName,
        avatarColor: avatarColor ?? existing[0].avatarColor,
        totalScore: sql`${playerScoresTable.totalScore} + ${score}`,
        ...(isBonus ? {} : {
          gamesPlayed: sql`${playerScoresTable.gamesPlayed} + 1`,
          wins: sql`${playerScoresTable.wins} + ${effectiveWon ? 1 : 0}`,
        }),
        xp: sql`${playerScoresTable.xp} + ${xpGain}`,
        // Concurrency hardening: another simultaneous score submission may have
        // advanced XP/level after the snapshot above. Never allow this request
        // to overwrite a newer, higher level with a stale lower one.
        level: sql`GREATEST(${playerScoresTable.level}, ${newLevel})`,
        ...(coinGain > 0 ? { coins: sql`${playerScoresTable.coins} + ${coinGain}` } : {}),
        ...(!isBonus && lockedUpdatedToday ? {
          currentStreak: lockedStreak,
          longestStreak: lockedLongest,
          lastPlayedDate: lockedToday,
          streakDaysJson: lockedStreakDaysJson,
        } : {}),
        updatedAt: new Date(),
      })
      .where(eq(playerScoresTable.playerId, playerId))
      .returning();
    txPlayer = updated;
      } else {
    // First-time players can receive two legitimate score submissions at nearly
    // the same instant (for example, two tabs or a reconnect retry). The old
    // plain INSERT could lose that race with a unique-key error and turn a
    // successful game into a 500. Keep the first row and atomically add the
    // concurrent submission instead.
    const [created] = await tx
      .insert(playerScoresTable)
      .values({
        playerId,
        playerName,
        avatarColor: avatarColor ?? "#e53e3e",
        totalScore: score,
        gamesPlayed: isBonus ? 0 : 1,
        wins: isBonus ? 0 : (effectiveWon ? 1 : 0),
        currentStreak: isBonus ? 0 : 1,
        longestStreak: isBonus ? 0 : 1,
        lastPlayedDate: isBonus ? null : today,
        streakDaysJson: isBonus ? "[]" : JSON.stringify([today]),
        xp: xpGain,
        level: calcLevel(xpGain),
        coins: coinGain,
      })
      .onConflictDoUpdate({
        target: playerScoresTable.playerId,
        set: {
          playerName,
          avatarColor: avatarColor ?? "#e53e3e",
          totalScore: sql`${playerScoresTable.totalScore} + ${score}`,
          gamesPlayed: sql`${playerScoresTable.gamesPlayed} + ${isBonus ? 0 : 1}`,
          wins: sql`${playerScoresTable.wins} + ${isBonus || !effectiveWon ? 0 : 1}`,
          xp: sql`${playerScoresTable.xp} + ${xpGain}`,
          level: sql`GREATEST(${playerScoresTable.level}, ${calcLevel(xpGain)})`,
          coins: sql`${playerScoresTable.coins} + ${coinGain}`,
          updatedAt: new Date(),
        },
      })
      .returning();
    txPlayer = created;
      }

      if (!txPlayer) throw new Error("SCORE_UPDATE_FAILED");
      await tx.insert(gameHistoryTable).values({
        playerId,
        score,
        letter,
        mode: effectiveMode,
        won: effectiveWon,
      });

      // Halloween Solo completion is part of the same transaction as the
      // score/history mutation. If the transaction rolls back, Halloween progress
      // rolls back too; if it commits, the completion cannot be lost in a process
      // crash between two independent transactions.
      if (certifiedMode === "solo" && Array.isArray(scoreTokens) && scoreTokens.length > 0) {
        const halloweenEventKey = bonusTokenSetHash(playerId, scoreTokens);
        if (halloweenEventKey) {
          await recordHalloweenEventInTransaction(
            tx,
            playerId,
            "game_completed",
            `solo:${halloweenEventKey}`,
            isHalloweenPreviewAuthorized(req),
          );
        }
      }

      // Keep voucher-backed collection words in the same transaction as the score.
      if (!isBonus && verified > 0 && scoreTokens) {
        const tokenSetHash = bonusTokenSetHash(playerId, scoreTokens);
        if (tokenSetHash) {
          await tx.insert(scoreBonusClaimsTable).values({
            tokenSetHash,
            playerId,
            maxScore: score,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          }).onConflictDoNothing();
        }
      }

      if (collectionWords.length > 0) {
        const collectionRows = await tx.execute(sql`
          SELECT id, collected_words_json
          FROM player_scores
          WHERE player_id = ${playerId}
          FOR UPDATE
        `) as unknown as { rows?: Array<{ id: number; collected_words_json: string }> };
        const collectionRow = collectionRows.rows?.[0];
        if (!collectionRow) throw new Error("COLLECTION_PLAYER_NOT_FOUND");

        let current: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(collectionRow.collected_words_json ?? "{}");
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            current = parsed as Record<string, unknown>;
          }
        } catch {}

        for (const entry of collectionWords) {
          const word = entry.word.trim().slice(0, 80);
          const category = entry.category.trim().slice(0, 80);
          if (!word || !category || Object.keys(current).length >= 500) break;
          if (!Object.prototype.hasOwnProperty.call(current, word)) current[word] = category;
        }

        await tx.update(playerScoresTable)
          .set({ collectedWordsJson: JSON.stringify(current), updatedAt: new Date() })
          .where(eq(playerScoresTable.id, collectionRow.id));
      }

      return txPlayer;
      });
    } catch (error) {
      if (error instanceof Error && error.message === "SCORE_VOUCHER_CONFLICT") {
        res.status(422).json({ error: "INVALID_SCORE_VOUCHER" });
        return;
      }
      throw error;
    }
    if (duplicateSubmission) {
      res.status(201).json({
        ...player,
        rank: 0,
        rewards: { xpAwarded: 0, coinsAwarded: 0, happyHourActive: false, multiplier: 1 },
      });
      return;
    }
  }

  if (overtaken.length > 0) {
    await Promise.allSettled(
      overtaken.map(op =>
        sendPushToPlayer(op.playerId, {
          title: "¡Te han superado! 😤",
          body: `${playerName} acaba de quitarte el puesto en el ranking global. ¡Hora de vengarse!`,
          url: "/ranking",
        })
      )
    );
  }

  if (!isBonus) {
    void recordTrustedAnalyticsEvent({
      eventName: "game_complete",
      playerId,
      mode: effectiveMode,
      metadata: { source: "server_score_submission" },
    }).catch((err) => console.error("[analytics] trusted game_complete failed:", err));


  }

  res.status(201).json({
    ...player,
    rank: 0,
    rewards: {
      xpAwarded: xpGain,
      coinsAwarded: coinGain,
      happyHourActive,
      multiplier: happyHourActive ? HAPPY_HOUR_MULTIPLIER : 1,
    },
  });
});

// ============================================================
// GET /scores/:playerId
// ============================================================
router.get("/scores/:playerId", async (req, res) => {
  const { playerId } = req.params;

  const scores = await db
    .select()
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);

  if (scores.length === 0) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const ps = scores[0];

  const [rankRow, bestRow, recentGames] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*) AS cnt FROM player_scores WHERE total_score > ${ps.totalScore}
    `),
    db.execute(sql`
      SELECT COALESCE(MAX(score), 0) AS best FROM game_history WHERE player_id = ${playerId}
    `),
    db
      .select()
      .from(gameHistoryTable)
      .where(eq(gameHistoryTable.playerId, playerId))
      .orderBy(desc(gameHistoryTable.createdAt))
      .limit(10),
  ]);

  const globalRank = Number((rankRow.rows[0] as any)?.cnt ?? 0) + 1;
  const bestScore = Number((bestRow.rows[0] as any)?.best ?? 0);

  // Public endpoint: never expose billing identifiers, inventory, collection,
  // streak internals, or other private persistence fields from player_scores.
  res.json({
    score: {
      playerId: ps.playerId,
      playerName: ps.playerName,
      avatarColor: ps.avatarColor,
      totalScore: ps.totalScore,
      gamesPlayed: ps.gamesPlayed,
      wins: ps.wins,
      isPremium: ps.isPremium,
      currentStreak: ps.currentStreak,
      longestStreak: ps.longestStreak,
      xp: ps.xp,
      level: ps.level,
      coins: ps.coins,
      equippedAvatar: ps.equippedAvatar,
      equippedFrame: ps.equippedFrame,
      equippedBackground: ps.equippedBackground,
      equippedTitle: ps.equippedTitle,
      rank: globalRank,
      globalRank,
      bestScore,
    },
    recentGames,
  });
});

export default router;
