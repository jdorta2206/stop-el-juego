import { sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { sendPushToAllSubscribers, sendPushToPlayer } from "./pushHelper";
import { SEASON_LENGTH_DAYS, themeForStartDate } from "./seasonConfig";

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
        badge: "/images/icon-192.png",
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
        badge: "/images/icon-192.png",
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

async function sendDailyNotifications() {
  try {
    const totals = { sent: 0, failed: 0 };
    for (const lang of LANGUAGES) {
      const msg = DAILY_MSGS[lang];
      const result = await sendPushToAllSubscribers(
        { ...msg, icon: "/images/icon-192.png", badge: "/images/icon-192.png", url: "/reto" },
        lang
      );
      totals.sent += result.sent;
      totals.failed += result.failed;
    }
    console.log(`[dailyCron] Notifications sent: ${totals.sent}, failed: ${totals.failed}`);
  } catch (e) {
    console.error("[dailyCron] Error sending daily notifications:", e);
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

    // 09:00–09:05 UTC → daily challenge announcement
    if (utcHour === 9 && utcMinute < 5) {
      const claimed = await claimDailyLock(today, CRON_KEY);
      if (claimed) {
        console.log(`[dailyCron] Lock claimed for ${today} — sending daily notifications`);
        await sendDailyNotifications();
      }
    }

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

  console.log("[dailyCron] Crons started — daily 09:00 UTC, streak rescue 19:00 UTC, season rollover 08:00 UTC, season claim 21:00 UTC");
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
  } catch (e: any) {
    console.error("[seasonRollover] Error:", e?.message ?? e);
  }
}
