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
  }, 5 * 60 * 1000);

  console.log("[dailyCron] Crons started — daily 09:00 UTC, streak rescue 19:00 UTC, season rollover 08:00 UTC");
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
