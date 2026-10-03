import { useEffect, useState } from "react";
import { useT } from "@/i18n/useT";
import {
  HALLOWEEN_END,
  HALLOWEEN_START,
  getHalloweenLabel,
  getHalloweenSubtitle,
} from "@/lib/halloweenEvent";

function getNextHalloweenStart(now: Date): Date {
  const year = now.getUTCFullYear();
  const start = new Date(Date.UTC(year, 9, 15, 0, 0, 0));
  return now.getTime() < start.getTime()
    ? start
    : new Date(Date.UTC(year + 1, 9, 15, 0, 0, 0));
}

function getPhase(nowMs: number): "upcoming" | "active" | "hidden" {
  const startMs = Date.parse(HALLOWEEN_START);
  const endMs = Date.parse(HALLOWEEN_END);
  if (nowMs < startMs) return "upcoming";
  if (nowMs < endMs) return "active";
  return "hidden";
}

function getRemainingText(lang: string, targetMs: number, nowMs: number): string {
  const remainingMs = Math.max(0, targetMs - nowMs);
  const totalHours = Math.ceil(remainingMs / (60 * 60 * 1000));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (lang === "en") {
    if (days > 0) return days === 1 ? "1 day left" : `${days} days left`;
    return totalHours === 1 ? "1 hour left" : `${totalHours} hours left`;
  }
  if (lang === "pt") {
    if (days > 0) return days === 1 ? "Falta 1 dia" : `Faltam ${days} dias`;
    return totalHours === 1 ? "Falta 1 hora" : `Faltam ${totalHours} horas`;
  }
  if (lang === "fr") {
    if (days > 0) return days === 1 ? "Plus que 1 jour" : `Plus que ${days} jours`;
    return totalHours === 1 ? "Plus qu'1 heure" : `Plus que ${totalHours} heures`;
  }
  if (days > 0) return days === 1 ? "Queda 1 día" : `Quedan ${days} días`;
  return totalHours === 1 ? "Queda 1 hora" : `Quedan ${totalHours} horas`;
}

export function HalloweenBanner({ className = "" }: { className?: string }) {
  const { lang } = useT();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const phase = getPhase(nowMs);
  if (phase === "hidden") return null;

  const targetMs =
    phase === "active"
      ? Date.parse(HALLOWEEN_END)
      : getNextHalloweenStart(new Date(nowMs)).getTime();
  const countdown = getRemainingText(lang, targetMs, nowMs);
  const subtitle =
    phase === "active"
      ? `${getHalloweenSubtitle(lang)} · ${countdown}`
      : `${getHalloweenSubtitle(lang)} · ${countdown}`;

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
        <span className="text-2xl">🎃</span>
        <div className="min-w-0">
          <p className="text-orange-300 font-black text-sm">{getHalloweenLabel(lang)}</p>
          <p className="text-white/65 text-xs mt-0.5">{subtitle}</p>
        </div>
        <span className="ml-auto text-xl">🦇</span>
      </div>
    </div>
  );
}
