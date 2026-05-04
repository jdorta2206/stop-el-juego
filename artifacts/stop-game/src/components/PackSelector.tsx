import { motion, AnimatePresence } from "framer-motion";
import { Crown } from "lucide-react";
import { CATEGORY_PACKS, getSelectedPackId, setSelectedPackId, type CategoryPack } from "@/data/categoryPacks";
import { getLang } from "@/i18n";
import { useState } from "react";

interface PackSelectorProps {
  isPremium?: boolean;
  onPremiumClick?: () => void;
}

export function PackSelector({ isPremium, onPremiumClick }: PackSelectorProps) {
  const lang = getLang() as "es" | "en" | "pt" | "fr";
  const [selected, setSelected] = useState(getSelectedPackId);

  const select = (pack: CategoryPack) => {
    if (pack.premium && !isPremium) {
      onPremiumClick?.();
      return;
    }
    setSelected(pack.id);
    setSelectedPackId(pack.id);
  };

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-2 px-1">
        <span className="text-[10px] uppercase tracking-widest font-black text-white/40">
          {lang === "en" ? "Category Pack" : lang === "pt" ? "Pack de Categorias" : lang === "fr" ? "Pack de catégories" : "Pack de categorías"}
        </span>
      </div>
      <div
        className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none", WebkitOverflowScrolling: "touch" }}
      >
        {CATEGORY_PACKS.map((pack) => {
          const isSelected = pack.id === selected;
          const locked = pack.premium && !isPremium;

          return (
            <motion.button
              key={pack.id}
              onClick={() => select(pack)}
              whileTap={{ scale: 0.93 }}
              className="relative flex-shrink-0 flex flex-col items-center gap-1 rounded-xl px-3 py-2.5 transition-all"
              style={{
                background: isSelected
                  ? pack.gradient
                  : "rgba(255,255,255,0.06)",
                border: isSelected
                  ? `2px solid ${pack.color}`
                  : "2px solid rgba(255,255,255,0.08)",
                minWidth: "72px",
                opacity: locked ? 0.6 : 1,
              }}
            >
              <span className="text-xl leading-none">{pack.icon}</span>
              <span
                className="text-[10px] font-black leading-tight whitespace-nowrap"
                style={{ color: isSelected ? "white" : "rgba(255,255,255,0.6)" }}
              >
                {pack.name[lang] || pack.name.es}
              </span>

              {locked && (
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#f9a825] flex items-center justify-center">
                  <Crown className="w-2.5 h-2.5 text-black" />
                </div>
              )}

              <AnimatePresence>
                {isSelected && (
                  <motion.div
                    layoutId="pack-check"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: pack.color }}
                  >
                    <span className="text-[9px] text-white font-black">✓</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
