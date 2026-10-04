import { Router, type IRouter } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { playerScoresTable, gameHistoryTable, scoreBonusClaimsTable, scoreSubmissionIdempotencyTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { sendPushToPlayer } from "../lib/pushHelper";
import { recordTrustedAnalyticsEvent } from "./analytics";
import { resolveCosmetic } from "../lib/inventoryCatalog";
import { SubmitScoreBody, GetLeaderboardQueryParams } from "@workspace/api-zod";
import { scoreLimiter } from "../middlewares/rateLimit";
import { verifyClaimedIdentity, requirePlayerIdentity, type AuthedRequest } from "../lib/playerAuth";
import { verifyScoreVouchers, claimScoreVouchersTx, ceilingFromBase, absoluteCeiling } from "../lib/scoreToken";
import { applyAuthoritativeSeasonEventsTx, getOrCreateActiveSeason, getOrCreateProgress } from "./season";
import {
  isHappyHourActiveUtc,
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

function offlineSubmissionRequestHash(input: {
  playerId: string;
  playerName: string;
  avatarColor?: string;
  score: number;
  letter: string;
  mode: string;
  won?: boolean;
  bonus?: boolean;
  scoreTokens?: string[];
}): string {
  const canonical = JSON.stringify({
    playerId: input.playerId,
    playerName: input.playerName,
    avatarColor: input.avatarColor ?? null,
    score: input.score,
    letter: input.letter,
    mode: input.mode,
    won: input.won ?? false,
    bonus: input.bonus ?? false,
    scoreTokens: Array.isArray(input.scoreTokens) ? [...input.scoreTokens].sort() : [],
  });
  return crypto.createHash("sha256").update(canonical).digest("hex");
}

function calcCoinGain(score: number, won: boolean, mode: string, isBonus: boolean): number {
  if (isBonus) return 0;
  const base = Math.max(1, Math.floor(score / 30));
  const winBonus = won ? 3 : 0;
  const modeBonus = mode === "multiplayer" ? 2 : mode === "daily" ? 1 : 0;
  return base + winBonus + modeBonus;
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
    SELECT *
    FROM player_scores
    ORDER BY total_score DESC
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
      rank: 1 + (rows.rows as Array<Record<string, unknown>>).findIndex((row) => Number(row.total_score) === Number(p.total_score)),
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
      SUM(CASE WHEN gh.won THEN 1 ELSE 0 END) AS "wins"
    FROM game_history gh
    LEFT JOIN player_scores ps ON gh.player_id = ps.player_id
    WHERE gh.created_at >= date_trunc('week', NOW() AT TIME ZONE 'UTC')
    GROUP BY gh.player_id, ps.player_name, ps.avatar_color, ps.profile_picture, ps.equipped_avatar, ps.equipped_frame, ps.equipped_title, ps.current_streak, ps.is_premium, ps.achievements_json
    ORDER BY SUM(gh.score) DESC
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
    title:         getTitle(i + 1),
    rank:          1 + (rows.rows as Array<Record<string, unknown>>).findIndex((row) => Number(row.totalScore) === Number(p.totalScore)),
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
      SUM(CASE WHEN gh.won THEN 1 ELSE 0 END) AS "wins"
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
    title:         getTitle(i + 1),
    rank:         1 + (rows.rows as Array<Record<string, unknown>>).findIndex((row) => Number(row.totalScore) === Number(p.totalScore)),
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

  const { playerId, playerName, avatarColor, score: rawScore, letter, mode, won, bonus, rewardRequestId, scoreTokens } = body.data;
  const offlineSubmissionId = body.data.offlineSubmissionId;
  const offlineSubmissionHash = offlineSubmissionId
    ? offlineSubmissionRequestHash(body.data)
    : null;
  // Offline submissions must be voucher-free: the offline path is explicitly
  // bounded by the absolute ceiling and therefore must never burn online
  // score vouchers before the idempotency guard runs.
  if (offlineSubmissionId && (bonus === true || (Array.isArray(scoreTokens) && scoreTokens.length > 0))) {
    res.status(422).json({ error: "INVALID_OFFLINE_SUBMISSION" });
    return;
  }


  if (!verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }

  const isBonus = bonus === true;
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
    if (!rewardRequestId) {
      res.status(422).json({ error: "BONUS_AD_PROOF_REQUIRED" });
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

  const verifiedVouchers = isBonus
    ? { vouchers: [], base: 0, verified: 0, collectionWords: [] as Array<{ word: string; category: string }>, mode: null, aiBase: 0 }
    // Verify now, but do not burn the vouchers until the score transaction commits.
    : await verifyScoreVouchers(scoreTokens, 3);
  const { base: verifiedBase, verified, collectionWords, mode: certifiedMode, aiBase: certifiedAiBase } = verifiedVouchers;
  const rewardClaimTokenSetHash = !isBonus && mode === "solo" && certifiedMode === "solo" && verified > 0 && Array.isArray(scoreTokens)
    ? bonusTokenSetHash(playerId, scoreTokens)
    : null;
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
  const lastPlayedDate = existing[0]?.lastPlayedDate ?? null;
  const { newStreak, updatedToday } = calculateStreak(lastPlayedDate, existing[0]?.currentStreak ?? 0);
  const newLongest = Math.max(existing[0]?.longestStreak ?? 0, newStreak);

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
  const happyHourActive = isHappyHourActiveUtc();
  const xpMultiplier = happyHourActive ? HAPPY_HOUR_MULTIPLIER : 1;
  const coinMultiplier = happyHourActive ? HAPPY_HOUR_MULTIPLIER : 1;
  const xpGain = baseXpGain * xpMultiplier;
  const coinGain = baseCoinGain * coinMultiplier;
  const newXp = (existing[0]?.xp ?? 0) + xpGain;
  const newLevel = calcLevel(newXp);

  const newStreakDaysJson = (!isBonus && updatedToday)
    ? appendStreakDay(existing[0]?.streakDaysJson, today)
    : undefined;

  // Season mission progress for a score submission is prepared before the
  // score transaction, but the actual mission mutation is performed inside
  // that same transaction so a rollback cannot leave season progress ahead
  // of the credited game.
  const scoreSeasonContext = !isBonus
    ? await getOrCreateActiveSeason().then(async (season) => ({
        seasonId: season.id,
        progressId: (await getOrCreateProgress(playerId, season.id)).id,
      }))
    : null;

  let player;
  if (isBonus) {
    const bonusResult = await db.transaction(async (tx) => {
      const adRows = await tx.execute(sql`
        SELECT request_id, player_id, rewarded, placement, consumed_at, created_at
        FROM admob_reward_requests
        WHERE request_id = ${rewardRequestId}
          AND player_id = ${playerId}
          AND rewarded = true
          AND consumed_at IS NULL
          AND placement = 'double_points'
          AND created_at >= NOW() - INTERVAL '10 minutes'
        FOR UPDATE
      `) as unknown as { rows?: Array<{
        request_id: string;
        player_id: string;
        rewarded: boolean;
        placement: string;
        consumed_at: Date | null;
        created_at: Date;
      }> };
      if (!adRows.rows?.[0]) return null;

      const [claimed] = await tx
        .delete(scoreBonusClaimsTable)
        .where(sql`${scoreBonusClaimsTable.tokenSetHash} = ${bonusClaimTokenSetHash} AND ${scoreBonusClaimsTable.playerId} = ${playerId}`)
        .returning({
          tokenSetHash: scoreBonusClaimsTable.tokenSetHash,
          maxScore: scoreBonusClaimsTable.maxScore,
        });
      if (!claimed || rawScore <= 0 || rawScore > claimed.maxScore) return null;

      await tx.execute(sql`
        UPDATE admob_reward_requests
        SET consumed_at = NOW()
        WHERE request_id = ${rewardRequestId}
          AND player_id = ${playerId}
          AND rewarded = true
          AND consumed_at IS NULL
      `);
      if (existing.length > 0) {
        const [updated] = await tx
          .update(playerScoresTable)
          .set({
            playerName,
            avatarColor: avatarColor ?? existing[0].avatarColor,
            totalScore: sql`${playerScoresTable.totalScore} + ${score}`,
            xp: sql`${playerScoresTable.xp} + ${xpGain}`,
            level: sql`GREATEST(${playerScoresTable.level}, ${newLevel})`,
            ...(coinGain > 0 ? { coins: sql`${playerScoresTable.coins} + ${coinGain}` } : {}),
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
      // Correct level from the post-update XP while the transaction still owns
      // the player row lock. The pre-request `newLevel` can be stale under
      // concurrent rewarded-score submissions.
      const bonusLevelRows = await tx.execute(sql`
        SELECT xp, level FROM player_scores WHERE player_id = ${playerId} FOR UPDATE
      `) as unknown as { rows?: Array<{ xp: number; level: number }> };
      const bonusLevelRow = bonusLevelRows.rows?.[0];
      if (bonusLevelRow) {
        const authoritativeLevel = calcLevel(bonusLevelRow.xp ?? 0);
        if (authoritativeLevel > (bonusLevelRow.level ?? 1)) {
          await tx.update(playerScoresTable)
            .set({ level: authoritativeLevel, updatedAt: new Date() })
            .where(eq(playerScoresTable.playerId, playerId));
        }
      }
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
      // Re-read after the upsert so a concurrent first-time bonus submission
      // also ends with the level implied by the committed XP.
      const createdLevelRows = await tx.execute(sql`
        SELECT xp, level FROM player_scores WHERE player_id = ${playerId} FOR UPDATE
      `) as unknown as { rows?: Array<{ xp: number; level: number }> };
      const createdLevelRow = createdLevelRows.rows?.[0];
      if (createdLevelRow) {
        const authoritativeLevel = calcLevel(createdLevelRow.xp ?? 0);
        if (authoritativeLevel > (createdLevelRow.level ?? 1)) {
          await tx.update(playerScoresTable)
            .set({ level: authoritativeLevel, updatedAt: new Date() })
            .where(eq(playerScoresTable.playerId, playerId));
        }
      }
      return created;
    });

    if (!bonusResult) {
      res.status(422).json({ error: "INVALID_BONUS_SCORE" });
      return;
    }
    player = bonusResult;
  } else {
    const transactionResult = await db.transaction(async (tx) => {
      // Keep the lock order identical to season rollover:
      // advisory Season lock -> player_scores row lock -> season_progress row.
      // Without this, rollover could deadlock with a concurrent score submit.
      if (scoreSeasonContext) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(${scoreSeasonContext.seasonId}::bigint)`);
      }

      if (offlineSubmissionId) {
        const [idempotencyInserted] = await tx
          .insert(scoreSubmissionIdempotencyTable)
          .values({
            submissionId: offlineSubmissionId,
            playerId,
            requestHash: offlineSubmissionHash!,
            responseJson: "{}",
          })
          .onConflictDoNothing()
          .returning({ submissionId: scoreSubmissionIdempotencyTable.submissionId });

        if (!idempotencyInserted) {
          const [previous] = await tx
            .select({
              playerId: scoreSubmissionIdempotencyTable.playerId,
              requestHash: scoreSubmissionIdempotencyTable.requestHash,
              responseJson: scoreSubmissionIdempotencyTable.responseJson,
            })
            .from(scoreSubmissionIdempotencyTable)
            .where(eq(scoreSubmissionIdempotencyTable.submissionId, offlineSubmissionId))
            .limit(1);

          if (!previous || previous.playerId !== playerId || previous.requestHash !== offlineSubmissionHash) {
            throw new Error("OFFLINE_SUBMISSION_ID_REUSED");
          }
          if (!previous.responseJson || previous.responseJson === "{}") {
            throw new Error("OFFLINE_SUBMISSION_RESPONSE_MISSING");
          }

          let response: Record<string, unknown>;
          try {
            const parsed = JSON.parse(previous.responseJson);
            if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
              throw new Error("not an object");
            }
            response = parsed as Record<string, unknown>;
          } catch {
            throw new Error("OFFLINE_SUBMISSION_RESPONSE_INVALID");
          }

          return { duplicate: true as const, player: null, response };
        }
      }

      if (verifiedVouchers.vouchers.length > 0) {
        const claimedVouchers = await claimScoreVouchersTx(tx, verifiedVouchers.vouchers);
        if (!claimedVouchers) throw new Error("SCORE_VOUCHER_ALREADY_USED");
      }

      let txPlayer;
      let txNewStreak = newStreak;
      let txUpdatedToday = updatedToday;
      let txStreakDaysJson = newStreakDaysJson;

      if (existing.length > 0) {
    // Re-read the authoritative streak under the same row lock used for the
    // score update. The pre-transaction snapshot can be stale when two games
    // finish concurrently for the same player.
    const lockedStreak = await tx.execute(sql`
      SELECT current_streak, last_played_date, streak_days_json, xp
      FROM player_scores
      WHERE player_id = ${playerId}
      FOR UPDATE
    `) as unknown as { rows?: Array<{
      current_streak: number;
      last_played_date: string | null;
      streak_days_json: string;
      xp: number;
    }> };
    const streakRow = lockedStreak.rows?.[0];
    if (!streakRow) throw new Error("SCORE_PLAYER_LOCK_FAILED");

    const txStreak = calculateStreak(streakRow.last_played_date, streakRow.current_streak ?? 0);
    txNewStreak = txStreak.newStreak;
    txUpdatedToday = txStreak.updatedToday;
    txStreakDaysJson = txUpdatedToday
      ? appendStreakDay(streakRow.streak_days_json, today)
      : undefined;
    // Recalculate level from the XP held by the locked row; the request-level
    // snapshot can be stale when score submissions arrive concurrently.
    const txNewLevel = calcLevel((streakRow.xp ?? 0) + xpGain);

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
        level: sql`GREATEST(${playerScoresTable.level}, ${txNewLevel})`,
        ...(coinGain > 0 ? { coins: sql`${playerScoresTable.coins} + ${coinGain}` } : {}),
        ...(!isBonus && txUpdatedToday ? {
          currentStreak: txNewStreak,
          longestStreak: sql`GREATEST(${playerScoresTable.longestStreak}, ${txNewStreak})`,
          lastPlayedDate: today,
          streakDaysJson: txStreakDaysJson,
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
          ...(!isBonus ? {
            currentStreak: sql`GREATEST(${playerScoresTable.currentStreak}, 1)`,
            longestStreak: sql`GREATEST(${playerScoresTable.longestStreak}, 1)`,
            lastPlayedDate: today,
          } : {}),
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
        mode: mode ?? "solo",
        won: effectiveWon,
      });

      // Keep voucher-backed collection words in the same transaction as the score.
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

      if (rewardClaimTokenSetHash) {
        await tx.insert(scoreBonusClaimsTable).values({
          tokenSetHash: rewardClaimTokenSetHash,
          playerId,
          maxScore: score,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        }).onConflictDoNothing();
      }

      if (scoreSeasonContext) {
        await applyAuthoritativeSeasonEventsTx(
          tx,
          scoreSeasonContext.seasonId,
          scoreSeasonContext.progressId,
          [
            { type: "play_game", value: 1 },
            ...(effectiveWon ? [{ type: "win_game", value: 1 }] : []),
            { type: "round_score", value: score },
            { type: "streak", value: txNewStreak },
            ...(collectionWords.length > 0 ? [{ type: "valid_words", value: collectionWords.length }] : []),
          ],
        );
      }

      const response = {
        ...txPlayer,
        rank: 0,
        rewards: {
          xpAwarded: xpGain,
          coinsAwarded: coinGain,
          happyHourActive,
          multiplier: happyHourActive ? HAPPY_HOUR_MULTIPLIER : 1,
        },
      };

      if (offlineSubmissionId) {
        await tx
          .update(scoreSubmissionIdempotencyTable)
          .set({ responseJson: JSON.stringify(response) })
          .where(eq(scoreSubmissionIdempotencyTable.submissionId, offlineSubmissionId));
      }

      return { duplicate: false as const, player: txPlayer, response };
    });
    if (transactionResult.duplicate) {
      res.status(201).json(transactionResult.response);
      return;
    }
    player = transactionResult.player;
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
      mode: mode ?? "solo",
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
