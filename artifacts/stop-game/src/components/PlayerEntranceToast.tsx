import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

interface PlayerLike {
  playerId: string;
  playerName: string;
  avatarColor?: string;
  isPremium?: boolean;
  isBot?: boolean;
}

interface PlayerEntranceToastProps {
  players: PlayerLike[];
  meId?: string;
}

interface EntranceItem {
  key: string;
  player: PlayerLike;
}

/**
 * Watches the lobby player list and fires a brief animated overlay each time a
 * NEW player joins. Premium players get a golden particle burst + bigger
 * animation — this is the "FOMO" hook so free players see what they're missing.
 *
 * Skipped:
 *  - First *non-empty* settled snapshot (we don't want to flash everyone
 *    already in the room when the SSE/query populates after `players: []`)
 *  - The local player themselves (when `meId` is known)
 *  - Bots
 */
export function PlayerEntranceToast({ players, meId }: PlayerEntranceToastProps) {
  const seenRef = useRef<Set<string> | null>(null);
  const timersRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const [queue, setQueue] = useState<EntranceItem[]>([]);
  const prefersReducedMotion = useReducedMotion();

  // Clear all pending dismiss timers on unmount so we don't call setQueue
  // after the component is gone.
  useEffect(() => {
    return () => {
      timersRef.current.forEach((id) => clearTimeout(id));
      timersRef.current.clear();
    };
  }, []);

  useEffect(() => {
    // Wait for the first authoritative (non-empty) snapshot AND for `meId`
    // to be known before establishing the baseline. Until then, just record
    // who's around but never animate — this avoids flashing existing players
    // when SSE finally populates after `players: []`.
    if (seenRef.current === null) {
      if (players.length === 0 || !meId) return;
      seenRef.current = new Set(players.map((p) => p.playerId));
      return;
    }

    const newOnes: EntranceItem[] = [];
    for (const p of players) {
      if (seenRef.current.has(p.playerId)) continue;
      seenRef.current.add(p.playerId);
      if (p.isBot) continue;
      if (meId && p.playerId === meId) continue;
      newOnes.push({ key: `${p.playerId}-${Date.now()}`, player: p });
    }

    // Drop departed players from the seen set so a rejoin re-triggers
    const stillHere = new Set(players.map((p) => p.playerId));
    for (const id of Array.from(seenRef.current)) {
      if (!stillHere.has(id)) seenRef.current.delete(id);
    }

    if (newOnes.length === 0) return;

    setQueue((prev) => [...prev, ...newOnes]);
    newOnes.forEach((item) => {
      const dur = item.player.isPremium ? 3200 : 2200;
      const id = setTimeout(() => {
        timersRef.current.delete(id);
        setQueue((prev) => prev.filter((q) => q.key !== item.key));
      }, dur);
      timersRef.current.add(id);
    });
  }, [players, meId]);

  return (
    <div className="fixed top-4 left-0 right-0 z-[60] flex flex-col items-center gap-2 pointer-events-none">
      <AnimatePresence>
        {queue.map(({ key, player }) => {
          const premium = !!player.isPremium;
          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: -30, scale: 0.7 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.85 }}
              transition={{ type: "spring", bounce: 0.45, duration: 0.6 }}
              className="relative px-4 py-2.5 rounded-2xl shadow-2xl flex items-center gap-3 max-w-[88vw]"
              style={{
                background: premium
                  ? "linear-gradient(135deg, #ca8a04 0%, #facc15 50%, #fde047 100%)"
                  : "rgba(20, 25, 45, 0.92)",
                border: premium ? "2px solid #fff7c2" : "1px solid rgba(255,255,255,0.18)",
                color: premium ? "#0d1757" : "white",
                boxShadow: premium
                  ? "0 8px 30px rgba(250,204,21,0.55), 0 0 0 1px rgba(255,247,194,0.4)"
                  : "0 6px 20px rgba(0,0,0,0.4)",
                backdropFilter: "blur(8px)",
              }}
            >
              <div
                className="relative w-9 h-9 rounded-full flex items-center justify-center font-black text-white text-sm flex-shrink-0"
                style={{
                  backgroundColor: player.avatarColor || "#555",
                  boxShadow: premium
                    ? "0 0 0 2px #fff7c2, 0 0 12px rgba(250,204,21,0.8)"
                    : undefined,
                }}
              >
                {player.playerName.charAt(0).toUpperCase()}
                {premium && (
                  <motion.span
                    className="absolute"
                    style={{
                      top: -12,
                      left: "50%",
                      transform: "translateX(-50%)",
                      fontSize: 16,
                      filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.5))",
                    }}
                    animate={
                      prefersReducedMotion
                        ? undefined
                        : { rotate: [-10, 10, -10], y: [0, -1, 0] }
                    }
                    transition={{ repeat: Infinity, duration: 1.6, ease: "easeInOut" }}
                  >
                    👑
                  </motion.span>
                )}
              </div>

              <div className="flex flex-col leading-tight min-w-0">
                <span
                  className="font-black text-base truncate"
                  style={{ fontFamily: "'Baloo 2', sans-serif" }}
                >
                  {player.playerName}
                </span>
                <span
                  className="text-xs font-bold opacity-80"
                  style={{ color: premium ? "#0d1757" : "rgba(255,255,255,0.7)" }}
                >
                  {premium ? "✨ Premium se ha unido" : "se ha unido"}
                </span>
              </div>

              {premium && !prefersReducedMotion && (
                <>
                  {[...Array(6)].map((_, i) => (
                    <motion.span
                      key={i}
                      className="absolute pointer-events-none text-yellow-100"
                      style={{
                        top: "50%",
                        left: "50%",
                        fontSize: 14,
                        filter: "drop-shadow(0 0 4px rgba(253,224,71,1))",
                      }}
                      initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
                      animate={{
                        x: Math.cos((i * Math.PI * 2) / 6) * 60,
                        y: Math.sin((i * Math.PI * 2) / 6) * 30,
                        opacity: 0,
                        scale: 1.2,
                      }}
                      transition={{ duration: 1.4, ease: "easeOut", delay: 0.1 }}
                    >
                      ✨
                    </motion.span>
                  ))}
                </>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
