import { useEffect, useState } from "react";
import { useT } from "@/i18n/useT";
import {
  getHalloweenLabel,
  getHalloweenSubtitle,
  isHalloweenActive,
  isHalloweenUpcoming,
  getNextHalloweenStart,
  HALLOWEEN_END,
} from "@/lib/halloweenEvent";

function getRemainingText(lang: string, targetMs: number, nowMs: number): string {
  const remainingMs = Math.max(0, targetMs - nowMs);
  const totalHours = Math.ceil(remainingMs / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  if (lang === "es") return days > 0 ? `Quedan ${days} días${hours > 0 ? ` y ${hours} h` : ""}` : `Quedan ${hours} h`;
  if (lang === "fr") return days > 0 ? `Il reste ${days} j${hours > 0 ? ` et ${hours} h` : ""}` : `Il reste ${hours} h`;
  if (lang === "pt") return days > 0 ? `Faltam ${days} dias${hours > 0 ? ` e ${hours} h` : ""}` : `Faltam ${hours} h`;
  return days > 0 ? `${days} days${hours > 0 ? ` and ${hours} h` : ""} remaining` : `${hours} h remaining`;
}

function getPhase(nowMs: number): "active" | "upcoming" | "hidden" {
  const now = new Date(nowMs);
  if (isHalloweenActive(now)) return "active";
  if (isHalloweenUpcoming(now)) return "upcoming";
  return "hidden";
}

export function HalloweenBanner({ className = "" }: { className?: string }) {
  const { lang } = useT();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const phase = getPhase(nowMs);

  useEffect(() => {
    if (phase === "hidden") return;
    const interval = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, [phase]);

  if (phase === "hidden") return null;

  const active = phase === "active";
  const targetMs = active
    ? new Date(HALLOWEEN_END).getTime()
    : getNextHalloweenStart(new Date(nowMs)).getTime();
  const remainingText = getRemainingText(lang, targetMs, nowMs);

  const nextStart = getNextHalloweenStart(new Date(nowMs));
  const locale = lang === "es" ? "es-ES" : lang === "fr" ? "fr-FR" : lang === "pt" ? "pt-PT" : "en-GB";
  const nextDate = new Intl.DateTimeFormat(locale, { day: "numeric", month: "long" }).format(nextStart);

  const upcomingText =
    lang === "es"
      ? `Halloween · ${nextDate} · ${remainingText}`
      : lang === "fr"
        ? `Halloween · ${nextDate} · ${remainingText}`
        : lang === "pt"
          ? `Halloween · ${nextDate} · ${remainingText}`
          : `Halloween · ${nextDate} · ${remainingText}`;

  return (
    <div
      className={`w-full rounded-2xl px-4 py-3 ${className}`}
      style={{
        background: "linear-gradient(135deg, rgba(249,115,22,.20), rgba(88,28,135,.22))",
        border: "1px solid rgba(249,115,22,.45)",
        boxShadow: "0 6px 24px rgba(0,0,0,.16)",
      }}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl">{active ? "🎃" : "🕯️"}</span>
        <div className="min-w-0">
          <p className="text-orange-300 font-black text-sm">
            {active
              ? getHalloweenLabel(lang)
              : lang === "es" ? "PRÓXIMO HALLOWEEN" : lang === "fr" ? "PROCHAIN HALLOWEEN" : lang === "pt" ? "PRÓXIMO HALLOWEEN" : "NEXT HALLOWEEN"}
          </p>
          <p className="text-white/65 text-xs mt-0.5">
            {active ? `${getHalloweenSubtitle(lang)} · ${remainingText}` : upcomingText}
          </p>
        </div>
        <span className="ml-auto text-xl">{active ? "🦇" : "⏳"}</span>
      </div>
    </div>
  );
}
