import { motion, AnimatePresence } from "framer-motion";
import { Star, X } from "lucide-react";
import { useT } from "@/i18n/useT";
import { requestPlayReview } from "@/lib/playReview";

interface Props {
  open: boolean;
  onRated: () => void;
  onSnooze: () => void;
  onDismissForever: () => void;
  onClose: () => void;
}

export function ReviewPromptCard({ open, onRated, onSnooze, onDismissForever, onClose }: Props) {
  const { t } = useT();
  const handleRate = async () => {
    await requestPlayReview();
    onRated();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4 sm:pb-0"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.4 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl p-5 relative"
            style={{
              background: "linear-gradient(135deg, hsl(48 96% 55%), hsl(36 95% 50%))",
              boxShadow: "0 16px 40px rgba(0,0,0,0.45)",
              color: "#1a1a1a",
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.12)" }}
              aria-label={t.review.close}
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex justify-center gap-1 mb-3 mt-1">
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  initial={{ scale: 0, rotate: -30 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.1 + i * 0.06, type: "spring", bounce: 0.6 }}
                >
                  <Star className="w-7 h-7" fill="#1a1a1a" stroke="#1a1a1a" />
                </motion.div>
              ))}
            </div>

            <h3
              className="text-2xl font-black text-center"
              style={{ fontFamily: "'Baloo 2', sans-serif" }}
            >
              {t.review.title}
            </h3>
            <p className="text-center text-sm font-semibold mt-2 opacity-80">
              {t.review.body}
            </p>

            <div className="mt-5 space-y-2">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleRate}
                className="w-full py-3 rounded-2xl font-black text-base flex items-center justify-center gap-2"
                style={{
                  background: "#1a1a1a",
                  color: "#f9a825",
                  boxShadow: "0 6px 18px rgba(0,0,0,0.25)",
                }}
              >
                <Star className="w-5 h-5" fill="#f9a825" />
                {t.review.rate}
              </motion.button>
              <button
                type="button"
                onClick={onSnooze}
                className="w-full py-2.5 rounded-2xl font-bold text-sm"
                style={{ background: "rgba(0,0,0,0.10)", color: "#1a1a1a" }}
              >
                {t.review.later}
              </button>
              <button
                type="button"
                onClick={onDismissForever}
                className="w-full py-2 text-xs font-semibold opacity-60"
              >
                {t.review.never}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
