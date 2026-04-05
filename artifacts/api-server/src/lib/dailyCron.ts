import { sendPushToAllSubscribers } from "./pushHelper";

const LANGUAGES = ["es", "en", "pt", "fr"] as const;

const DAILY_MSGS: Record<string, { title: string; body: string }> = {
  es: { title: "🎯 Reto Diario STOP", body: "¡Tu reto de hoy está listo! ¿Puedes ganarle a la IA?" },
  en: { title: "🎯 Daily STOP Challenge", body: "Today's challenge is ready! Can you beat the AI?" },
  pt: { title: "🎯 Desafio Diário STOP", body: "O desafio de hoje está pronto! Consegues bater a IA?" },
  fr: { title: "🎯 Défi Quotidien STOP", body: "Le défi du jour est prêt ! Tu peux battre l'IA ?" },
};

let lastSentDate = "";

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
  // Check every 5 minutes if it's time to send the daily notification (9:00 UTC)
  setInterval(async () => {
    const now = new Date();
    const utcHour = now.getUTCHours();
    const utcMinute = now.getUTCMinutes();
    const today = now.toISOString().slice(0, 10);

    // Fire at 9:00–9:05 UTC, once per day
    if (utcHour === 9 && utcMinute < 5 && today !== lastSentDate) {
      lastSentDate = today;
      console.log(`[dailyCron] Sending daily notifications for ${today}...`);
      await sendDailyNotifications();
    }
  }, 5 * 60 * 1000);

  console.log("[dailyCron] Daily notification cron started (fires at 09:00 UTC)");
}
