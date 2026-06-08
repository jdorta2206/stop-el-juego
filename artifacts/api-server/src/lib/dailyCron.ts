import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { sendPushToAllSubscribers, sendPushToPlayer } from "./pushHelper";
import { SEASON_LENGTH_DAYS, themeForStartDate } from "./seasonConfig";
import { finalizePreviousSeason } from "../routes/season";
import {
  HAPPY_HOUR_PRE_LOCAL_MIN,
  HAPPY_HOUR_LIVE_LOCAL_MIN,
  HAPPY_HOUR_LAST_LOCAL_MIN,
} from "./happyHour";
import { getDailyDeals } from "./dailyShop";

const LANGUAGES = ["es", "en", "pt", "fr"] as const;

const DAILY_MSGS: Record<string, { title: string; body: string }> = {
  es: { title: "🎯 Reto Diario STOP", body: "¡Tu reto de hoy está listo! ¿Puedes ganarle a la IA?" },
  en: { title: "🎯 Daily STOP Challenge", body: "Today's challenge is ready! Can you beat the AI?" },
  pt: { title: "🎯 Desafio Diário STOP", body: "O desafio de hoje está pronto! Consegues bater a IA?" },
  fr: { title: "🎯 Défi Quotidien STOP", body: "Le défi du jour est prêt ! Tu peux battre l'IA ?" },
};

const CRON_KEY = "daily_notifications";
const STREAK_RESCUE_KEY = "streak_rescue_notifications";
const SEASON_ROLLOVER_KEY = "season_rollover";
const SEASON_CLAIM_KEY = "season_claim_notifications";

// Daily-deals nudge fires at ~10:00 each player's local time (deals already
// reset at 00:00 UTC, so they're fresh all morning). Timezone-aware via the
// same per-tz window + UTC-bucket lock as Happy Hour.
const DAILY_DEALS_LOCAL_MIN = 10 * 60; // 10:00 local

const DEALS_MSGS: Record<string, (pct: number) => { title: string; body: string }> = {
  es: (p) => ({ title: "🏷️ ¡Nuevas ofertas hoy!", body: `La tienda del día tiene hasta -${p}% de descuento. ¡Míralas antes de que cambien a medianoche!` }),
  en: (p) => ({ title: "🏷️ New deals today!", body: `Today's shop has up to -${p}% off. Check them out before they change at midnight!` }),
  pt: (p) => ({ title: "🏷️ Novas ofertas hoje!", body: `A loja do dia tem até -${p}% de desconto. Vê antes que mudem à meia-noite!` }),
  fr: (p) => ({ title: "🏷️ Nouvelles offres aujourd'hui !", body: `La boutique du jour a jusqu'à -${p}% de réduction. Regarde avant qu'elles changent à minuit !` }),
};

const SEASON_CLAIM_MSGS: Record<string, { title: string; body: string }> = {
  es: { title: "🏆 ¡Misiones listas para reclamar!", body: "Has completado misiones del Season Pass. Reclama el XP antes de que roten." },
  en: { title: "🏆 Missions ready to claim!", body: "You've completed Season Pass missions. Claim the XP before they rotate." },
  pt: { title: "🏆 Missões prontas para reclamar!", body: "Completaste missões do Season Pass. Reclama o XP antes de rodarem." },
  fr: { title: "🏆 Missions prêtes à réclamer !", body: "Tu as terminé des missions du Season Pass. Réclame l'XP avant qu'elles tournent." },
};

const STREAK_RESCUE_MSGS: Record<string, (streak: number) => { title: string; body: string }> = {
  es: (s) => ({ title: `🔥 ¡Salva tu racha de ${s} días!`, body: "Aún estás a tiempo. Una partida rápida y tu racha sigue viva." }),
  en: (s) => ({ title: `🔥 Save your ${s}-day streak!`, body: "You still have time. One quick game keeps your streak alive." }),
  pt: (s) => ({ title: `🔥 Salva a tua sequência de ${s} dias!`, body: "Ainda estás a tempo. Um jogo rápido e a tua sequência continua." }),
  fr: (s) => ({ title: `🔥 Sauve ta série de ${s} jours !`, body: "Tu as encore le temps. Une partie rapide suffit." }),
};

/**
 * Tries to claim the daily-notification lock for `today` in Postgres.
 * Returns true only on the FIRST instance to insert/update for this date.
 * Any subsequent instance (or restart) for the same date returns false.
 */
async function claimDailyLock(today: string, key: string = CRON_KEY): Promise<boolean> {
  try {
    // Insert if missing → claim. Else only update if the existing date is older → claim.
    // The atomic "WHERE last_run_date < $today" ensures only one wins the race.
    const result = await db.execute(sql`
      INSERT INTO cron_locks (lock_key, last_run_date, updated_at)
      VALUES (${key}, ${today}, NOW())
      ON CONFLICT (lock_key) DO UPDATE
        SET last_run_date = EXCLUDED.last_run_date, updated_at = NOW()
        WHERE cron_locks.last_run_date < EXCLUDED.last_run_date
      RETURNING last_run_date
    `);
    return (result as any).rowCount > 0;
  } catch (e) {
    console.error("[dailyCron] lock error:", e);
    return false;
  }
}

/**
 * Sends a "save your streak" push to every player whose streak is at risk:
 *   - current_streak >= 2 (so it's worth saving)
 *   - last_played_date is exactly yesterday (UTC) — they haven't played today yet
 * Looks up each player's preferred language from their first push subscription.
 */
async function sendStreakRescueNotifications() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

    // Players with a worth-saving streak who haven't played today
    const rows = await db.execute(sql`
      SELECT ps.player_id, ps.current_streak,
             COALESCE(MIN(sub.language), 'es') AS language
      FROM player_scores ps
      INNER JOIN push_subscriptions sub ON sub.player_id = ps.player_id
      WHERE ps.current_streak >= 2
        AND ps.last_played_date = ${yesterday}
      GROUP BY ps.player_id, ps.current_streak
      LIMIT 5000
    `);

    let sent = 0;
    for (const row of rows.rows as Array<{ player_id: string; current_streak: number; language: string }>) {
      const lang = STREAK_RESCUE_MSGS[row.language] ? row.language : "es";
      const msg = STREAK_RESCUE_MSGS[lang](row.current_streak);
      const n = await sendPushToPlayer(row.player_id, {
        ...msg,
        icon: "/images/icon-192.png",
        badge: "/images/badge-96.png",
        url: "/solo?mode=quick&auto=1",
      });
      sent += n;
    }
    console.log(`[streakRescueCron] Notifications sent: ${sent} (candidates: ${rows.rows.length}, date: ${today})`);
  } catch (e) {
    console.error("[streakRescueCron] Error:", e);
  }
}

/**
 * Sends a "claim your missions" push to every player who, in the currently
 * active season, has at least one mission that is `completed: true` but
 * `claimed: false`. Rotated nightly so XP doesn't evaporate when missions
 * roll over the next day.
 *
 * The eligibility filter is intentionally a coarse SQL prefilter
 * (`missions_json` LIKE '%"completed":true%') followed by a precise JSON
 * parse in code: missions are tiny and the prefilter cuts the candidate
 * set by ~98% without needing a Postgres jsonb column.
 */
interface SqlResult<T> {
  rows?: T[];
}

interface SeasonIdRow {
  id: number;
}

interface SeasonClaimCandidateRow {
  player_id: string;
  missions_json: string;
  language: string;
}

async function sendSeasonClaimNotifications() {
  try {
    const today = new Date().toISOString().slice(0, 10);

    // 1) Resolve the active season for `today`. If none exists we silently
    //    skip — the season rollover cron at 08:00 UTC will create one.
    const seasonRows = (await db.execute(sql`
      SELECT id FROM seasons
      WHERE start_date <= ${today} AND end_date >= ${today}
      ORDER BY id DESC LIMIT 1
    `)) as unknown as SqlResult<SeasonIdRow>;
    const activeSeason = seasonRows.rows?.[0];
    if (!activeSeason) {
      console.log(`[seasonClaimCron] No active season for ${today} — skipping`);
      return;
    }

    // 2) Pull progress rows that look like they have a completed mission AND
    //    belong to a player with at least one push subscription. The LIKE
    //    is a cheap prefilter; we re-validate by parsing the JSON below.
    const rows = (await db.execute(sql`
      SELECT sp.player_id,
             sp.missions_json,
             COALESCE(MIN(sub.language), 'es') AS language
      FROM season_progress sp
      INNER JOIN push_subscriptions sub ON sub.player_id = sp.player_id
      WHERE sp.season_id = ${activeSeason.id}
        AND sp.missions_json LIKE '%"completed":true%'
      GROUP BY sp.player_id, sp.missions_json
      LIMIT 10000
    `)) as unknown as SqlResult<SeasonClaimCandidateRow>;

    const candidateRows = rows.rows ?? [];
    let candidates = 0;
    let sent = 0;
    for (const row of candidateRows) {
      // Validate the JSON: must contain a mission that is BOTH completed
      // and not yet claimed. Skip silently on parse errors so a bad row
      // doesn't break the whole batch.
      let hasUnclaimed = false;
      try {
        const blob = JSON.parse(row.missions_json || "{}");
        const missions = Array.isArray(blob?.missions) ? blob.missions : [];
        hasUnclaimed = missions.some(
          (m: { completed?: boolean; claimed?: boolean }) =>
            m?.completed === true && m?.claimed !== true,
        );
      } catch {
        continue;
      }
      if (!hasUnclaimed) continue;
      candidates++;

      const lang = SEASON_CLAIM_MSGS[row.language] ? row.language : "es";
      const msg = SEASON_CLAIM_MSGS[lang];
      const n = await sendPushToPlayer(row.player_id, {
        ...msg,
        icon: "/images/icon-192.png",
        badge: "/images/badge-96.png",
        url: "/season",
      });
      sent += n;
    }
    console.log(
      `[seasonClaimCron] Notifications sent: ${sent} (eligible: ${candidates}, scanned: ${candidateRows.length}, season: ${activeSeason.id}, date: ${today})`,
    );
  } catch (e) {
    console.error("[seasonClaimCron] Error:", e);
  }
}

// Three rotating variants per language so the player never sees the same
// title twice in a row. Picked deterministically from the date so every
// player in the same timezone sees the same variant on a given day.
const DAILY_VARIANTS: Record<string, Array<{ title: string; body: string }>> = {
  es: [
    { title: "Tu reto STOP de hoy", body: "Misión nueva disponible. ¿Le ganas a la IA?" },
    { title: "Te toca jugar", body: "Una partida rápida y avanzas en el Pase." },
    { title: "Hora de tu STOP", body: "Tu racha sigue viva si juegas ahora." },
  ],
  en: [
    { title: "Today's STOP challenge", body: "New mission ready. Can you beat the AI?" },
    { title: "Time to play", body: "One quick game and you progress in the Pass." },
    { title: "STOP time", body: "Your streak stays alive if you play now." },
  ],
  pt: [
    { title: "O teu desafio STOP de hoje", body: "Missão nova disponível. Bates a IA?" },
    { title: "Hora de jogar", body: "Um jogo rápido e avanças no Passe." },
    { title: "Hora do teu STOP", body: "A tua sequência continua se jogares agora." },
  ],
  fr: [
    { title: "Ton défi STOP du jour", body: "Nouvelle mission. Bats-tu l'IA ?" },
    { title: "À toi de jouer", body: "Une partie rapide et tu avances dans le Pass." },
    { title: "L'heure de ton STOP", body: "Ta série reste en vie si tu joues maintenant." },
  ],
};

function variantForToday(lang: string): { title: string; body: string } {
  const list = DAILY_VARIANTS[lang] ?? DAILY_VARIANTS.es;
  // Day-of-year picks the variant — same across all subscriptions for the day.
  const dayOfYear = Math.floor(
    (Date.now() - Date.UTC(new Date().getUTCFullYear(), 0, 1)) / 86_400_000,
  );
  return list[dayOfYear % list.length];
}

interface SubscriptionWithPrefsRow {
  player_id: string;
  language: string;
  hour_local: number;
}

// Per-user daily reminder. Runs every 5 minutes; for each subscription it
// computes the player's local hour from (UTC now + tz_offset_minutes) and
// fires when the local hour matches `hour_local`. Mute and disable are
// filtered in SQL so the candidate set stays tiny.
async function sendPerUserDailyNotifications() {
  try {
    const now = Date.now();
    const utcNow = new Date(now);
    const utcHour = utcNow.getUTCHours();
    const utcMinute = utcNow.getUTCMinutes();

    // SQL filters to the few players whose local hour is the current
    // UTC hour right now, accounting for their stored offset.
    // Postgres `%` on negative integers returns negative results, which
    // would never match a 0–23 `hour_local`. We pre-add 10080 minutes
    // (7 days, > max possible |tz_offset_minutes| = 14*60) so the dividend
    // is always positive before mod — works for any timezone, including
    // far-west offsets around UTC midnight.
    const utcMinutesOfDay = utcHour * 60 + utcMinute;
    const rows = (await db.execute(sql`
      SELECT player_id, language, hour_local
      FROM push_subscriptions
      WHERE enabled = TRUE
        AND muted_until < ${now}
        AND hour_local = (((${utcMinutesOfDay}::int + tz_offset_minutes + 10080) / 60) % 24)
        AND (((${utcMinutesOfDay}::int + tz_offset_minutes + 10080) % 60) < 5)
      LIMIT 10000
    `)) as unknown as { rows?: SubscriptionWithPrefsRow[] };

    const candidates = rows.rows ?? [];
    if (candidates.length === 0) return;

    // Dedup per (player, lang) — a player may have multiple endpoints
    // (e.g. phone + desktop). sendPushToPlayer hits every endpoint
    // already, so we send the message once per player_id here.
    const seen = new Set<string>();
    let sent = 0;
    for (const row of candidates) {
      if (seen.has(row.player_id)) continue;
      seen.add(row.player_id);
      const lang = DAILY_VARIANTS[row.language] ? row.language : "es";
      const msg = variantForToday(lang);
      const n = await sendPushToPlayer(row.player_id, {
        ...msg,
        icon: "/images/icon-192.png",
        badge: "/images/badge-96.png",
        url: "/reto",
      });
      sent += n;
    }
    console.log(`[dailyCron] Per-user daily sent: ${sent} (candidates: ${candidates.length})`);
  } catch (e) {
    console.error("[dailyCron] per-user error:", e);
  }
}

/**
 * Per-user Happy Hour notifications. Three time slots, each fired when a
 * player's local minute-of-day matches the target (with a 5-min cron-cadence
 * tolerance window — same pattern as `sendPerUserDailyNotifications`).
 *
 *  pre  → 20:45 local  ("starts in 15 min")
 *  live → 21:00 local  ("ACTIVE now — x2 monedas y XP")
 *  last → 21:50 local  ("10 min left, ¡última oportunidad!")
 */
const HAPPY_HOUR_MSGS: Record<
  "pre" | "live" | "last",
  Record<string, { title: string; body: string }>
> = {
  pre: {
    es: { title: "⏰ Happy Hour en 15 min", body: "Monedas y XP x2 durante 1 hora. ¡Prepárate!" },
    en: { title: "⏰ Happy Hour in 15 min", body: "x2 coins and XP for 1 hour. Get ready!" },
    pt: { title: "⏰ Happy Hour em 15 min", body: "Moedas e XP x2 durante 1 hora. Prepara-te!" },
    fr: { title: "⏰ Happy Hour dans 15 min", body: "Pièces et XP x2 pendant 1 heure. Prêt ?" },
  },
  live: {
    es: { title: "⚡ ¡HAPPY HOUR ACTIVA!", body: "Monedas y XP x2 durante 60 min. ¡Juega ahora!" },
    en: { title: "⚡ HAPPY HOUR LIVE!", body: "x2 coins and XP for 60 min. Play now!" },
    pt: { title: "⚡ HAPPY HOUR ATIVA!", body: "Moedas e XP x2 durante 60 min. Joga já!" },
    fr: { title: "⚡ HAPPY HOUR EN COURS !", body: "Pièces et XP x2 pendant 60 min. Joue maintenant !" },
  },
  last: {
    es: { title: "⏳ Quedan 10 min de Happy Hour", body: "Una última partida x2 antes de que acabe." },
    en: { title: "⏳ 10 min of Happy Hour left", body: "One last x2 game before it ends." },
    pt: { title: "⏳ Restam 10 min de Happy Hour", body: "Um último jogo x2 antes que acabe." },
    fr: { title: "⏳ 10 min restantes de Happy Hour", body: "Une dernière partie x2 avant la fin." },
  },
};

async function sendHappyHourNotifications() {
  try {
    const now = Date.now();
    const utcNow = new Date(now);
    const utcMinutesOfDay = utcNow.getUTCHours() * 60 + utcNow.getUTCMinutes();

    // For each of the three slots, find subscriptions whose local
    // minute-of-day falls inside the 5-min tolerance window starting at the
    // target. Pattern mirrors sendPerUserDailyNotifications (positive
    // modulus via +10080 minutes).
    const slots: Array<{ key: "pre" | "live" | "last"; target: number; url: string }> = [
      { key: "pre", target: HAPPY_HOUR_PRE_LOCAL_MIN, url: "/" },
      { key: "live", target: HAPPY_HOUR_LIVE_LOCAL_MIN, url: "/solo?mode=quick&auto=1" },
      { key: "last", target: HAPPY_HOUR_LAST_LOCAL_MIN, url: "/solo?mode=quick&auto=1" },
    ];

    // Multi-instance idempotency: each (slot, UTC-5min-bucket) is claimed at
    // most once across the cluster. A given tz cohort falls inside exactly
    // one UTC bucket per day per slot, so locking by bucket guarantees one
    // notification per player per slot per day, while still allowing
    // different tz cohorts (different buckets) to fire on the same day.
    const today = utcNow.toISOString().slice(0, 10);
    const utcBucket = Math.floor(utcMinutesOfDay / 5);

    for (const slot of slots) {
      const lockKey = `hh_${slot.key}_${today}_${utcBucket}`;
      const claimed = await claimDailyLock(today, lockKey);
      if (!claimed) {
        continue; // another instance already handled this slot+bucket
      }

      const rows = (await db.execute(sql`
        SELECT player_id, language
        FROM push_subscriptions
        WHERE enabled = TRUE
          AND muted_until < ${now}
          AND (((${utcMinutesOfDay}::int + tz_offset_minutes + 10080) % 1440)) >= ${slot.target}
          AND (((${utcMinutesOfDay}::int + tz_offset_minutes + 10080) % 1440)) < ${slot.target + 5}
        LIMIT 10000
      `)) as unknown as { rows?: Array<{ player_id: string; language: string }> };

      const candidates = rows.rows ?? [];
      if (candidates.length === 0) continue;

      const seen = new Set<string>();
      let sent = 0;
      for (const row of candidates) {
        if (seen.has(row.player_id)) continue;
        seen.add(row.player_id);
        const lang = HAPPY_HOUR_MSGS[slot.key][row.language] ? row.language : "es";
        const msg = HAPPY_HOUR_MSGS[slot.key][lang];
        const n = await sendPushToPlayer(row.player_id, {
          ...msg,
          icon: "/images/icon-192.png",
          badge: "/images/badge-96.png",
          url: slot.url,
        });
        sent += n;
      }
      console.log(`[happyHourCron] slot=${slot.key} sent=${sent} candidates=${candidates.length}`);
    }
  } catch (e) {
    console.error("[happyHourCron] error:", e);
  }
}

/**
 * Daily-deals nudge. One timezone-aware slot per player per day: fires when a
 * player's local minute-of-day enters the 5-min window at DAILY_DEALS_LOCAL_MIN.
 * Idempotent across instances via a per-(day, UTC-5min-bucket) lock — same
 * pattern as Happy Hour. The body advertises today's real best discount,
 * recomputed from the deterministic daily-shop seed.
 */
async function sendDailyDealsNotifications() {
  try {
    const now = Date.now();
    const utcNow = new Date(now);
    const utcMinutesOfDay = utcNow.getUTCHours() * 60 + utcNow.getUTCMinutes();
    const today = utcNow.toISOString().slice(0, 10);
    const utcBucket = Math.floor(utcMinutesOfDay / 5);

    const claimed = await claimDailyLock(today, `deals_${today}_${utcBucket}`);
    if (!claimed) return; // another instance owns this bucket

    const rows = (await db.execute(sql`
      SELECT player_id, language
      FROM push_subscriptions
      WHERE enabled = TRUE
        AND muted_until < ${now}
        AND (((${utcMinutesOfDay}::int + tz_offset_minutes + 10080) % 1440)) >= ${DAILY_DEALS_LOCAL_MIN}
        AND (((${utcMinutesOfDay}::int + tz_offset_minutes + 10080) % 1440)) < ${DAILY_DEALS_LOCAL_MIN + 5}
      LIMIT 10000
    `)) as unknown as { rows?: Array<{ player_id: string; language: string }> };

    const candidates = rows.rows ?? [];
    if (candidates.length === 0) return;

    const maxDiscount = Math.max(0, ...getDailyDeals(utcNow).deals.map((d) => d.discountPct));

    const seen = new Set<string>();
    let sent = 0;
    for (const row of candidates) {
      if (seen.has(row.player_id)) continue;
      seen.add(row.player_id);
      const lang = DEALS_MSGS[row.language] ? row.language : "es";
      const msg = DEALS_MSGS[lang](maxDiscount);
      const n = await sendPushToPlayer(row.player_id, {
        ...msg,
        icon: "/images/icon-192.png",
        badge: "/images/badge-96.png",
        url: `/player/${row.player_id}#tienda`,
      });
      sent += n;
    }
    console.log(`[dailyDealsCron] sent=${sent} candidates=${candidates.length} maxDiscount=${maxDiscount}`);
  } catch (e) {
    console.error("[dailyDealsCron] error:", e);
  }
}

export function startDailyCron() {
  // Check every 5 minutes if it's time to send notifications.
  // Both fires use a per-key DB lock so only ONE instance sends across the cluster.
  setInterval(async () => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const today = now.toISOString().slice(0, 10);

    // Per-user daily reminder — fires every 5 min and filters in SQL to the
    // subscriptions whose local hour matches now. Replaces the legacy
    // 09:00 UTC blast which hit everyone at 10-11 a.m. CET regardless of
    // their preferred time. No global lock: each (player, day) is safe to
    // hit at most once because the 5-min window check on local minute
    // ensures the same player only matches in one 5-min slice per day.
    await sendPerUserDailyNotifications();

    // Happy Hour: three timezone-aware notifications per player per day
    // (pre/live/last-call). Same per-tz SQL filter as daily reminders, so
    // the candidate set stays tiny and we never blast the whole table.
    await sendHappyHourNotifications();

    // Daily-deals nudge — timezone-aware, once per player per day at ~10:00
    // local. Tells them fresh shop discounts are live (they reset 00:00 UTC).
    // Same per-tz bucket-lock as Happy Hour so it never double-sends.
    await sendDailyDealsNotifications();

    // 19:00–19:05 UTC → streak rescue. 19:00 UTC was chosen because it
    // falls inside daytime/evening waking hours for every supported locale
    // (es 20-21h CET, fr 20-21h CET, pt 16h BRT / 19h WET, en spans the
    // US afternoon and EU early evening) — i.e. a built-in quiet-hours
    // safeguard without per-user preferences. There is no per-user
    // preferences/timezone column yet; if/when one is added, gate the
    // SELECT in sendStreakRescueNotifications() on it.
    if (utcHour === 19 && utcMinute < 5) {
      const claimed = await claimDailyLock(today, STREAK_RESCUE_KEY);
      if (claimed) {
        console.log(`[streakRescueCron] Lock claimed for ${today} — sending streak rescue`);
        await sendStreakRescueNotifications();
      }
    }

    // 08:00–08:05 UTC → season rollover. Idempotent: only opens a new season
    // when no current season covers `today`. Single-instance via DB lock.
    if (utcHour === 8 && utcMinute < 5) {
      const claimed = await claimDailyLock(today, SEASON_ROLLOVER_KEY);
      if (claimed) {
        await rolloverSeasonIfNeeded(today);
      }
    }

    // 21:00–21:05 UTC → Season Pass mission claim reminder. Sent BEFORE the
    // missions roll over (which happens lazily on the player's next request
    // when the date changes) so the XP doesn't get lost. Same rationale as
    // 19:00 UTC for the streak rescue: that window falls inside evening
    // hours for every supported locale (es/fr 22-23h CET, pt 18h BRT,
    // en spans US afternoon to EU late evening).
    if (utcHour === 21 && utcMinute < 5) {
      const claimed = await claimDailyLock(today, SEASON_CLAIM_KEY);
      if (claimed) {
        console.log(`[seasonClaimCron] Lock claimed for ${today} — sending claim reminders`);
        await sendSeasonClaimNotifications();
      }
    }
  }, 5 * 60 * 1000);

  console.log("[dailyCron] Crons started — per-user daily, happy hour, daily deals ~10:00 local, streak rescue 19:00 UTC, season rollover 08:00 UTC, season claim 21:00 UTC");
}

/**
 * Opens a fresh 4-week season if no active season covers `today`. Safe to run
 * daily — a no-op while the current season is still active.
 */
async function rolloverSeasonIfNeeded(today: string) {
  try {
    const existing = await db.execute(sql`
      SELECT id FROM seasons
      WHERE start_date <= ${today} AND end_date >= ${today}
      ORDER BY id DESC LIMIT 1
    `);
    if ((existing as any).rows?.length > 0) {
      console.log(`[seasonRollover] Active season exists for ${today} — no-op`);
      return;
    }

    const start = today;
    const end = new Date(new Date(start + "T00:00:00Z").getTime() + (SEASON_LENGTH_DAYS - 1) * 86_400_000)
      .toISOString().slice(0, 10);
    const theme = themeForStartDate(start);
    await db.execute(sql`
      INSERT INTO seasons (start_date, end_date, theme_json)
      VALUES (${start}, ${end}, ${JSON.stringify(theme)})
    `);
    console.log(`[seasonRollover] Opened season ${start} → ${end} (${theme.name})`);

    // Re-fetch the freshly-inserted season ID and freeze the previous
    // season's standings + award champion frames. Idempotent — safe to
    // run from both this cron and the lazy `getOrCreateActiveSeason()`
    // path so recap data is never request-timing dependent.
    const newRows = (await db.execute(sql`
      SELECT id FROM seasons WHERE start_date = ${start} ORDER BY id DESC LIMIT 1
    `)) as unknown as { rows?: { id: number }[] };
    const newId = newRows.rows?.[0]?.id;
    if (newId) {
      await finalizePreviousSeason(newId, today);
    }
  } catch (e: any) {
    console.error("[seasonRollover] Error:", e?.message ?? e);
  }
}
