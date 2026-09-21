import { useT } from "@/i18n/useT";
import { getHalloweenLabel, getHalloweenSubtitle, isHalloweenActive } from "@/lib/halloweenEvent";

export function HalloweenBanner({ className = "" }: { className?: string }) {
  const { lang } = useT();
  if (!isHalloweenActive()) return null;

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
          <p className="text-white/65 text-xs mt-0.5">{getHalloweenSubtitle(lang)}</p>
        </div>
        <span className="ml-auto text-xl">🦇</span>
      </div>
    </div>
  );
}
