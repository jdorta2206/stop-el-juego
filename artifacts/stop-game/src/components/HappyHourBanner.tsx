import { motion, AnimatePresence } from "framer-motion";
import { Zap } from "lucide-react";
import { useHappyHour, formatCountdown } from "@/hooks/useHappyHour";
import { useT } from "@/i18n/useT";

/**
 * Top-of-screen banner that appears only during the active Happy Hour window
 * and during the 30 minutes leading up to it ("starts in 23:14"). The
 * countdown re-renders every second when active to drive FOMO.
 */
export function HappyHourBanner() {
  const hh = useHappyHour();
  const { t } = useT();

  // Show "starts in X" teaser when within 30 min of start, then the live banner.
  const showTeaser = !hh.active && hh.msUntilStart <= 30 * 60_000;
  const visible = hh.active || showTeaser;

  if (!visible) return null;

  // i18n with safe fallback to Spanish.
  const tr = (t as any).happyHour ?? {};
  const liveLabel = tr.liveLabel ?? "HAPPY HOUR";
  const liveBody = tr.liveBody ?? "Monedas y XP x2";
  const teaserPrefix = tr.teaserPrefix ?? "Empieza en";
  const remainingLabel = tr.remainingLabel ?? "Quedan";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 220, damping: 22 }}
        className="w-full px-3 pt-2"
      >
        <div
          className="relative max-w-5xl mx-auto rounded-2xl overflow-hidden"
          style={{
            background: hh.active
              ? "linear-gradient(90deg, #f9a825 0%, #ff6b35 50%, #f9a825 100%)"
              : "linear-gradient(90deg, rgba(249,168,37,0.18) 0%, rgba(255,107,53,0.18) 100%)",
            border: hh.active ? "2px solid #fde047" : "1.5px solid rgba(253,224,71,0.4)",
            boxShadow: hh.active
              ? "0 4px 20px rgba(249,168,37,0.45), inset 0 0 24px rgba(255,255,255,0.18)"
              : "0 2px 8px rgba(0,0,0,0.25)",
          }}
        >
          {/* Shimmer sweep during active hour */}
          {hh.active && (
            <motion.div
              aria-hidden
              initial={{ x: "-100%" }}
              animate={{ x: "100%" }}
              transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
              className="absolute inset-y-0 w-1/3 pointer-events-none"
              style={{
                background:
                  "linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)",
              }}
            />
          )}

          <div className="relative flex items-center gap-3 px-4 py-2.5">
            <motion.div
              animate={hh.active ? { rotate: [0, -10, 10, -10, 0], scale: [1, 1.15, 1] } : {}}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center"
              style={{
                background: hh.active ? "rgba(0,0,0,0.25)" : "rgba(249,168,37,0.3)",
              }}
            >
              <Zap
                className="w-5 h-5"
                fill={hh.active ? "#fff" : "#f9a825"}
                color={hh.active ? "#fff" : "#f9a825"}
              />
            </motion.div>

            <div className="flex-1 min-w-0">
              <p
                className="font-black text-sm leading-tight tracking-wide"
                style={{ color: hh.active ? "#0d1757" : "#fde047" }}
              >
                ⚡ {liveLabel} {hh.active && "ACTIVA"}
              </p>
              <p
                className="text-xs font-bold leading-tight truncate"
                style={{ color: hh.active ? "rgba(13,23,87,0.85)" : "rgba(253,224,71,0.85)" }}
              >
                {hh.active
                  ? `${liveBody} · ${remainingLabel} ${formatCountdown(hh.msUntilEnd)}`
                  : `${teaserPrefix} ${formatCountdown(hh.msUntilStart)}`}
              </p>
            </div>

            {hh.active && (
              <div
                className="flex-shrink-0 px-2.5 py-1 rounded-lg font-black text-base"
                style={{
                  background: "rgba(13,23,87,0.85)",
                  color: "#fde047",
                  textShadow: "0 0 8px rgba(253,224,71,0.6)",
                }}
              >
                x{hh.multiplier}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
