import { useEffect, useState } from "react";
import { useT } from "@/i18n/useT";
import { getHalloweenLabel, isHalloweenActive, isHalloweenUpcoming, getNextHalloweenStart, getHalloweenWindow } from "@/lib/halloweenEvent";

function formatRemaining(ms: number, lang: string): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (lang === "es") return "Quedan " + days + " días, " + hours + " h y " + minutes + " min";
  if (lang === "fr") return "Il reste " + days + " jours, " + hours + " h et " + minutes + " min";
  if (lang === "pt") return "Faltam " + days + " dias, " + hours + " h e " + minutes + " min";
  return days + " days, " + hours + "h and " + minutes + "m remaining";
}

export function HalloweenBanner({ className = "" }: { className?: string }) {
  const { lang } = useT();
  const active = isHalloweenActive();
  const upcoming = !active && isHalloweenUpcoming();
  const nextStart = getNextHalloweenStart();
  const eventEnd = getHalloweenWindow(nextStart.getUTCFullYear()).end;
  const [remaining, setRemaining] = useState(() => Math.max(0, (active ? eventEnd : nextStart).getTime() - Date.now()));

  useEffect(() => {
    if (!active && !upcoming) return;
    const update = () => {
      const target = active ? getHalloweenWindow(new Date().getUTCFullYear()).end : getNextHalloweenStart();
      setRemaining(Math.max(0, target.getTime() - Date.now()));
    };
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [active, upcoming]);

  if (!active && !upcoming) return null;
  const nextDate = new Intl.DateTimeFormat(lang === "es" ? "es-ES" : lang === "fr" ? "fr-FR" : lang === "pt" ? "pt-PT" : "en-GB", { day: "numeric", month: "long" }).format(nextStart);
  const countdownText = formatRemaining(remaining, lang);
  const upcomingText = lang === "es" ? "Comienza el " + nextDate + " · " + countdownText
    : lang === "fr" ? "Commence le " + nextDate + " · " + countdownText
    : lang === "pt" ? "Começa em " + nextDate + " · " + countdownText
    : "Starts " + nextDate + " · " + countdownText;

  return (
    <div
      className={"w-full rounded-2xl px-4 py-3 " + className}
      style={{
        background: "linear-gradient(135deg, rgba(249,115,22,.20), rgba(88,28,135,.22))",
        border: "1px solid rgba(249,115,22,.45)",
        boxShadow: "0 6px 24px rgba(0,0,0,.16)",
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{active ? "🎃" : "🕯️"}</span>
        <div className="min-w-0">
          <p className="text-orange-300 font-black text-sm">{active ? getHalloweenLabel(lang) : (lang === "es" ? "PRÓXIMO HALLOWEEN" : lang === "fr" ? "PROCHAIN HALLOWEEN" : lang === "pt" ? "PRÓXIMO HALLOWEEN" : "NEXT HALLOWEEN")}</p>
          <p className="text-white/65 text-xs mt-0.5">{active ? formatRemaining(remaining, lang) : upcomingText}</p>
        </div>
        <span className="ml-auto text-xl">{active ? "🦇" : "⏳"}</span>
      </div>
    </div>
  );
}
