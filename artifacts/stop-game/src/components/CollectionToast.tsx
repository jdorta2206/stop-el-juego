import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { type CollectedWord, RARITY_META } from "@/lib/collection";
import { useT } from "@/i18n/useT";

interface Props {
  word: CollectedWord | null;
  onDone: () => void;
}

export function CollectionToast({ word, onDone }: Props) {
  const { t } = useT();
  const tC = (t as { collection?: Record<string, string> }).collection ?? {};

  useEffect(() => {
    if (!word) return;
    const ms = word.r === "legendary" ? 3800 : 2600;
    const id = setTimeout(onDone, ms);
    return () => clearTimeout(id);
  }, [word, onDone]);

  return (
    <AnimatePresence>
      {word && (() => {
        const meta = RARITY_META[word.r];
        const rarityLabel = tC[`rarity_${word.r}`] ?? word.r;
        return (
          <motion.div
            initial={{ opacity: 0, y: -40, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 340, damping: 22 }}
            className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] px-4 py-3 rounded-2xl flex items-center gap-3 max-w-[92vw]"
            style={{
              background: "rgba(15,15,20,0.92)",
              border: `2px solid ${meta.border}`,
              boxShadow: meta.glow,
              backdropFilter: "blur(10px)",
            }}
          >
            <div className="text-3xl">{meta.emoji}</div>
            <div className="flex flex-col">
              <span
                className="text-[10px] font-black uppercase tracking-widest"
                style={{ color: meta.color }}
              >
                {tC.new ?? "Nueva palabra"} · {rarityLabel}
              </span>
              <span className="text-white font-black text-base leading-tight">
                {word.name}
              </span>
              <span className="text-white/55 text-xs">{word.cat}</span>
            </div>
          </motion.div>
        );
      })()}
    </AnimatePresence>
  );
}
