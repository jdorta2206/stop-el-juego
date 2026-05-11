import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, X, Share2, Download } from "lucide-react";
import confetti from "canvas-confetti";
import { useGetStreakCalendar } from "@workspace/api-client-react";
import { STREAK_MILESTONES, type StreakMilestone } from "@/hooks/useAchievements";
import { useT } from "@/i18n/useT";

interface StreakCalendarModalProps {
  open: boolean;
  onClose: () => void;
  playerId: string;
  playerName: string;
  /** Called when the calendar detects the player just crossed a milestone
   *  (3/7/14/30) for the first time. Parent uses this to unlock the matching
   *  achievement so the existing AchievementToast surfaces it. */
  onMilestoneReached?: (milestone: StreakMilestone, currentStreak: number) => void;
}

const MILESTONE_REWARDS: Record<StreakMilestone, { emoji: string; rewardKey: string }> = {
  3: { emoji: "🔥", rewardKey: "streak_3" },
  7: { emoji: "🌟", rewardKey: "streak_7" },
  14: { emoji: "💎", rewardKey: "streak_14" },
  30: { emoji: "👑", rewardKey: "streak_30" },
};

function fireConfetti() {
  const colors = ["#f9a825", "#dc2626", "#ffffff", "#fbbf24"];
  confetti({ particleCount: 180, spread: 110, origin: { y: 0.4 }, colors });
  setTimeout(() => confetti({ particleCount: 100, spread: 80, origin: { x: 0.2, y: 0.5 }, colors }), 200);
  setTimeout(() => confetti({ particleCount: 100, spread: 80, origin: { x: 0.8, y: 0.5 }, colors }), 400);
}

// Render the streak calendar to a 1080×1080 canvas suitable for IG/WhatsApp
// stories. Returns the resulting Blob so the caller can share or download.
async function renderShareImage(opts: {
  playerName: string;
  currentStreak: number;
  longestStreak: number;
  days: { date: string; played: boolean; isToday: boolean }[];
  labelText: string;
  daysText: string;
  bestText: string;
  ctaText: string;
}): Promise<Blob | null> {
  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, "#0d1757");
  bg.addColorStop(1, "#1a237e");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // Big flame + streak number
  ctx.fillStyle = "#f9a825";
  ctx.font = "bold 220px 'Baloo 2', system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(`🔥 ${opts.currentStreak}`, size / 2, 220);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 70px system-ui, sans-serif";
  ctx.fillText(`${opts.daysText} ${opts.labelText}`, size / 2, 360);

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "500 38px system-ui, sans-serif";
  ctx.fillText(`${opts.bestText}: ${opts.longestStreak}`, size / 2, 430);

  // Player name
  ctx.fillStyle = "#f9a825";
  ctx.font = "bold 48px system-ui, sans-serif";
  ctx.fillText(opts.playerName, size / 2, 500);

  // Calendar grid 7×5 (last 35 days, but we have 30 — pad with empty squares)
  const cols = 7;
  const rows = 5;
  const gridW = 720;
  const cellGap = 14;
  const cell = (gridW - cellGap * (cols - 1)) / cols;
  const gridStartX = (size - gridW) / 2;
  const gridStartY = 580;

  // Pad the front so today lands in the bottom-right
  const padCount = rows * cols - opts.days.length;
  for (let i = 0; i < rows * cols; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = gridStartX + col * (cell + cellGap);
    const y = gridStartY + row * (cell + cellGap);
    const dayIdx = i - padCount;
    const day = dayIdx >= 0 ? opts.days[dayIdx] : null;

    ctx.beginPath();
    const radius = 16;
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + cell, y, x + cell, y + cell, radius);
    ctx.arcTo(x + cell, y + cell, x, y + cell, radius);
    ctx.arcTo(x, y + cell, x, y, radius);
    ctx.arcTo(x, y, x + cell, y, radius);
    ctx.closePath();
    if (!day) {
      ctx.fillStyle = "rgba(255,255,255,0.05)";
    } else if (day.played) {
      ctx.fillStyle = day.isToday ? "#dc2626" : "#f9a825";
    } else {
      ctx.fillStyle = "rgba(255,255,255,0.10)";
    }
    ctx.fill();
    if (day?.isToday) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
    }
  }

  // Footer CTA
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 44px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(opts.ctaText, size / 2, size - 80);
  ctx.fillStyle = "#f9a825";
  ctx.font = "bold 36px system-ui, sans-serif";
  ctx.fillText("STOP — El Juego", size / 2, size - 30);

  return new Promise(resolve => canvas.toBlob(b => resolve(b), "image/png"));
}

export function StreakCalendarModal({
  open,
  onClose,
  playerId,
  playerName,
  onMilestoneReached,
}: StreakCalendarModalProps) {
  const { t } = useT();
  const tStreak = t.streak as Record<string, string>;
  const { data, isLoading } = useGetStreakCalendar(playerId, {
    query: {
      queryKey: ["/api/ranking/streak/calendar", playerId],
      enabled: open && !!playerId,
      staleTime: 30_000,
    },
  });

  const days = data?.days ?? [];
  const currentStreak = data?.currentStreak ?? 0;
  const longestStreak = data?.longestStreak ?? 0;

  // Detect first-time milestone crossing per session and celebrate.
  const celebratedRef = useRef<Set<number>>(new Set());
  const [celebrating, setCelebrating] = useState<StreakMilestone | null>(null);
  useEffect(() => {
    if (!open || !currentStreak) return undefined;
    const justHit = [...STREAK_MILESTONES]
      .reverse()
      .find(m => currentStreak === m && !celebratedRef.current.has(m));
    if (!justHit) return undefined;
    celebratedRef.current.add(justHit);
    setCelebrating(justHit);
    fireConfetti();
    onMilestoneReached?.(justHit, currentStreak);
    const id = setTimeout(() => setCelebrating(null), 4200);
    return () => clearTimeout(id);
  }, [open, currentStreak, onMilestoneReached]);

  // Backfill: whenever the calendar fetch returns the authoritative server
  // `longestStreak`, surface it through onMilestoneReached so achievements
  // catch up for clients with cleared local state. The unlock helper is
  // idempotent, so this is safe to call on every data change.
  useEffect(() => {
    if (!data || longestStreak < STREAK_MILESTONES[0]) return;
    onMilestoneReached?.(
      [...STREAK_MILESTONES].reverse().find(m => longestStreak >= m) as StreakMilestone,
      longestStreak,
    );
  }, [data, longestStreak, onMilestoneReached]);

  // 7×5 grid layout — pad the start so today is bottom-right.
  const grid = useMemo(() => {
    const padCount = 35 - days.length;
    return [
      ...Array.from({ length: Math.max(0, padCount) }, () => null),
      ...days,
    ];
  }, [days]);

  // Next milestone preview
  const nextMilestone = STREAK_MILESTONES.find(m => m > currentStreak) ?? null;

  async function handleShare() {
    const blob = await renderShareImage({
      playerName: playerName || "Jugador",
      currentStreak,
      longestStreak,
      days,
      labelText: tStreak.label ?? "Racha",
      daysText: tStreak.days ?? "días",
      bestText: tStreak.longest ?? "Mejor racha",
      ctaText: tStreak.shareCta ?? "¡Únete y rompe mi racha!",
    });
    if (!blob) return;

    const file = new File([blob], `stop-streak-${currentStreak}.png`, { type: "image/png" });
    const navAny = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    const shareData: ShareData & { files?: File[] } = {
      files: [file],
      title: tStreak.shareTitle ?? "Mi racha en STOP",
      text: `${tStreak.shareText ?? "Llevo"} ${currentStreak} ${tStreak.days ?? "días"} 🔥 ${tStreak.shareCta ?? "¡Únete y rompe mi racha!"}`,
    };
    if (navAny.canShare?.({ files: [file] }) && navAny.share) {
      try {
        await navAny.share(shareData);
        return;
      } catch { /* user cancelled — fall through to download */ }
    }
    // Fallback: download the image
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] flex items-center justify-center px-4"
          style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.4 }}
            className="relative w-full max-w-md rounded-3xl p-6 max-h-[90vh] overflow-y-auto"
            style={{
              background: "linear-gradient(160deg, #0d1757 0%, #1a237e 100%)",
              border: "2px solid rgba(249,168,37,0.4)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6)",
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.1)" }}
              aria-label="Cerrar"
            >
              <X className="w-5 h-5 text-white" />
            </button>

            {/* Header */}
            <div className="flex flex-col items-center text-center mb-5">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-20 h-20 rounded-full flex items-center justify-center mb-2"
                style={{
                  background: "linear-gradient(135deg, #f9a825, #dc2626)",
                  boxShadow: "0 0 30px rgba(249,168,37,0.6)",
                }}
              >
                <Flame className="w-10 h-10 text-white" fill="white" />
              </motion.div>
              <p className="text-white font-black text-3xl leading-none">
                {currentStreak} <span className="text-base font-bold text-white/70">{tStreak.days}</span>
              </p>
              <p className="text-[#f9a825] text-xs font-black uppercase tracking-widest mt-1">
                {tStreak.label}
              </p>
              <p className="text-white/60 text-xs mt-1">
                {tStreak.longest}: <span className="text-white font-black">{longestStreak}</span>
              </p>
            </div>

            {/* Grid 7×5 */}
            <div className="grid grid-cols-7 gap-1.5 mb-4">
              {/* Day-of-week headers (M T W T F S S using single letters) */}
              {(tStreak.weekdaysShort ?? "L M X J V S D").split(" ").map((d, i) => (
                <div key={`hdr-${i}`} className="text-center text-[10px] font-black uppercase text-white/40">
                  {d}
                </div>
              ))}
              {grid.map((day, i) => (
                <div
                  key={i}
                  className="aspect-square rounded-md flex items-center justify-center text-[10px] font-bold"
                  style={{
                    background: !day
                      ? "rgba(255,255,255,0.04)"
                      : day.played
                        ? day.isToday
                          ? "linear-gradient(135deg, #dc2626, #f9a825)"
                          : "rgba(249,168,37,0.85)"
                        : "rgba(255,255,255,0.08)",
                    border: day?.isToday ? "2px solid #ffffff" : "1px solid rgba(255,255,255,0.06)",
                    color: day?.played ? "#ffffff" : "rgba(255,255,255,0.4)",
                  }}
                  title={day?.date ?? ""}
                >
                  {day ? Number(day.date.slice(-2)) : ""}
                </div>
              ))}
            </div>

            {/* Milestones row */}
            <div className="flex items-center justify-between mb-4 px-1">
              {STREAK_MILESTONES.map(m => {
                const reached = longestStreak >= m;
                return (
                  <div key={m} className="flex flex-col items-center gap-0.5 flex-1">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-base"
                      style={{
                        background: reached ? "linear-gradient(135deg, #f9a825, #dc2626)" : "rgba(255,255,255,0.08)",
                        border: reached ? "2px solid #f9a825" : "1px dashed rgba(255,255,255,0.2)",
                        opacity: reached ? 1 : 0.55,
                      }}
                    >
                      {MILESTONE_REWARDS[m].emoji}
                    </div>
                    <span className={`text-[10px] font-black ${reached ? "text-[#f9a825]" : "text-white/40"}`}>
                      {m}d
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Next milestone hint */}
            {nextMilestone && (
              <div
                className="text-center text-xs text-white/70 font-bold mb-4 px-3 py-2 rounded-lg"
                style={{ background: "rgba(255,255,255,0.05)" }}
              >
                {tStreak.nextHint?.replace("{n}", String(nextMilestone - currentStreak))
                  ?? `Te faltan ${nextMilestone - currentStreak} días para el siguiente hito`}
              </div>
            )}

            {/* Share button */}
            <button
              onClick={handleShare}
              disabled={isLoading || currentStreak === 0}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-sm disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #f9a825, #dc2626)",
                color: "#ffffff",
                boxShadow: "0 6px 20px rgba(249,168,37,0.35)",
              }}
            >
              <Share2 className="w-4 h-4" />
              {tStreak.shareButton ?? "Comparte tu racha"}
              <Download className="w-4 h-4 opacity-70" />
            </button>

            {/* Milestone celebration overlay */}
            <AnimatePresence>
              {celebrating && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.7 }}
                  className="absolute inset-0 flex items-center justify-center rounded-3xl pointer-events-none"
                  style={{ background: "rgba(0,0,0,0.65)" }}
                >
                  <div className="flex flex-col items-center text-center px-6">
                    <motion.div
                      animate={{ rotate: [0, -10, 10, 0], scale: [1, 1.2, 1] }}
                      transition={{ duration: 0.6, repeat: 3 }}
                      className="text-7xl mb-3"
                    >
                      {MILESTONE_REWARDS[celebrating].emoji}
                    </motion.div>
                    <p className="text-[#f9a825] font-black text-3xl">
                      ¡{celebrating} {tStreak.days}!
                    </p>
                    <p className="text-white font-bold text-base mt-1">
                      {tStreak.milestoneCelebrate ?? "¡Hito desbloqueado!"}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
