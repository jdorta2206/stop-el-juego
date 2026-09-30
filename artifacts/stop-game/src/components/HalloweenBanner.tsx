import { useT } from "@/i18n/useT";
import { getHalloweenLabel, getHalloweenSubtitle, isHalloweenActive, isHalloweenUpcoming, getNextHalloweenStart } from "@/lib/halloweenEvent";

export function HalloweenBanner({ className = "" }: { className?: string }) {
  const { lang } = useT();
  const active = isHalloweenActive();
  const upcoming = !active && isHalloweenUpcoming();
  if (!active && !upcoming) return null;
  const nextStart = getNextHalloweenStart();
  const nextDate = new Intl.DateTimeFormat(lang === "es" ? "es-ES" : lang === "fr" ? "fr-FR" : lang === "pt" ? "pt-PT" : "en-GB", { day: "numeric", month: "long" }).format(nextStart);

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
          <p className="text-orange-300 font-black text-sm">{active ? getHalloweenLabel(lang) : (lang === "es" ? "PRÓXIMO HALLOWEEN" : lang === "fr" ? "PROCHAIN HALLOWEEN" : lang === "pt" ? "PRÓXIMO HALLOWEEN" : "NEXT HALLOWEEN")}</p>
          <p className="text-white/65 text-xs mt-0.5">{active ? getHalloweenSubtitle(lang) : (lang === "es" ? `Evento especial · ${nextDate}` : lang === "fr" ? `Événement spécial · ${nextDate}` : lang === "pt" ? `Evento especial · ${nextDate}` : `Special event · ${nextDate}`)}</p>
        </div>
        <span className="ml-auto text-xl">{active ? "🦇" : "⏳"}</span>
      </div>
    </div>
  );
}
