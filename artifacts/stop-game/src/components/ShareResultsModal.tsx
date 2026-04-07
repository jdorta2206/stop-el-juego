import { motion, AnimatePresence } from "framer-motion";
import { Share2, X, Copy, Check } from "lucide-react";
import { useState } from "react";

interface ShareResultsModalProps {
  open: boolean;
  onClose: () => void;
  letter: string;
  playerScore: number;
  aiScore: number;
  categories: string[];
  results: Record<string, { player?: { response: string; score: number }; ai?: { response: string; score: number } }>;
  t: {
    shareResults: string;
    shareText: string;
    shareScore: string;
    shareChallenge: string;
    you: string;
    ai: string;
    points: string;
    empty: string;
  };
  gameUrl?: string;
  bluffResults?: Array<{ category: string; caught: boolean; scoreChange: number }>;
  aiJudged?: { wasCorrect: boolean; category: string } | null;
}

function buildWordleGrid(
  categories: string[],
  results: Record<string, { player?: { response: string; score: number }; ai?: { response: string; score: number } }>,
): string {
  return categories.map(cat => {
    const score = results[cat]?.player?.score ?? 0;
    if (score >= 10) return "🟩";
    if (score >= 5)  return "🟨";
    return "⬛";
  }).join("");
}

export function ShareResultsModal({
  open,
  onClose,
  letter,
  playerScore,
  aiScore,
  categories,
  results,
  t,
  gameUrl,
  bluffResults,
  aiJudged,
}: ShareResultsModalProps) {
  const [copied, setCopied] = useState(false);

  const won = playerScore > aiScore;
  const url = gameUrl || window.location.origin;
  const wordleGrid = buildWordleGrid(categories, results);

  const validWords = categories
    .filter(cat => (results[cat]?.player?.score ?? 0) > 0)
    .map(cat => results[cat]?.player?.response || "")
    .filter(Boolean);

  const bluffLine = (() => {
    if (!bluffResults || bluffResults.length === 0) return null;
    const perfect = bluffResults.filter(r => !r.caught).length;
    const caught = bluffResults.filter(r => r.caught).length;
    const parts: string[] = [];
    if (perfect > 0) parts.push(`🎭 ${perfect} engaño${perfect > 1 ? "s" : ""} perfecto${perfect > 1 ? "s" : ""}`);
    if (caught > 0) parts.push(`🕵️ ${caught} pillado${caught > 1 ? "s" : ""}`);
    if (aiJudged) parts.push(aiJudged.wasCorrect ? "🔍 ¡Detecté a la IA mintiendo!" : "🤖 La IA me engañó");
    return parts.length > 0 ? parts.join(" · ") : null;
  })();

  const diff = Math.abs(playerScore - aiScore);
  const closeMatch = diff <= 15;

  const viralLine = won
    ? `🧠 Conseguí ${playerScore} pts con la letra "${letter}" y le gané a la IA${closeMatch ? ` (¡por solo ${diff} pts!)` : ""} 🏆`
    : `🤖 La IA me ganó por ${diff} pts con la letra "${letter}"… yo iba con ${playerScore} pts`;

  const challengeLine = won
    ? `¿Puedes superarme? 👇`
    : `¿Tú puedes ganarle? 👇`;

  const shareMessage = [
    viralLine,
    wordleGrid,
    bluffLine,
    challengeLine,
    `🎮 El juego que nadie supera → ${url}`,
  ]
    .filter(Boolean)
    .join("\n");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareMessage);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "STOP - El Juego", text: shareMessage, url });
      } catch {}
    } else {
      handleCopy();
    }
  };

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(shareMessage)}`;
  const twitter = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareMessage)}`;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center p-4"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.3 }}
            onClick={e => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl overflow-hidden"
            style={{ background: "#0d1757", border: "2px solid rgba(249,168,37,0.3)" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <h3 className="text-white font-black text-lg">{t.shareResults}</h3>
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Wordle grid preview */}
            <div
              className="mx-4 mb-4 rounded-2xl p-4 text-center"
              style={{
                background: won
                  ? "linear-gradient(135deg, rgba(34,197,94,0.15), rgba(21,128,61,0.1))"
                  : "linear-gradient(135deg, rgba(181,48,26,0.15), rgba(153,27,27,0.1))",
                border: `1px solid ${won ? "rgba(34,197,94,0.3)" : "rgba(181,48,26,0.3)"}`,
              }}
            >
              {/* Letter + score header */}
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-black text-2xl flex-shrink-0"
                  style={{ background: "hsl(6 90% 55%)", color: "white" }}
                >
                  {letter}
                </div>
                <div className="text-left">
                  <p className="text-white font-black text-base">
                    {won ? "🏆 ¡Ganaste!" : "💪 ¡Completado!"}
                  </p>
                  <p className="text-white/60 text-xs">
                    {t.you} {playerScore}pts · IA {aiScore}pts
                  </p>
                </div>
              </div>

              {/* Wordle emoji grid */}
              <div className="flex flex-col items-center gap-1 my-2">
                <p className="text-[2rem] tracking-wide leading-none">{wordleGrid}</p>
                <div className="flex gap-4 mt-1 text-xs text-white/50">
                  <span>🟩 10pts</span>
                  <span>🟨 5pts</span>
                  <span>⬛ 0pts</span>
                </div>
              </div>

              {validWords.length > 0 && (
                <div className="flex flex-wrap gap-1.5 justify-center mt-2">
                  {validWords.slice(0, 4).map((word, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-full text-xs font-bold"
                      style={{ background: "rgba(249,168,37,0.2)", color: "#f9a825" }}
                    >
                      {word}
                    </span>
                  ))}
                  {validWords.length > 4 && (
                    <span className="text-white/40 text-xs self-center">+{validWords.length - 4}</span>
                  )}
                </div>
              )}
            </div>

            {/* Share buttons */}
            <div className="px-4 pb-5 space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95"
                  style={{ background: "#25D366" }}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  WhatsApp
                </a>
                <a
                  href={twitter}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm text-white transition-all hover:opacity-90 active:scale-95"
                  style={{ background: "#000" }}
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L2.25 2.25H8.08l4.261 5.635zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  X / Twitter
                </a>
              </div>

              <button
                onClick={handleCopy}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95"
                style={{
                  background: copied ? "rgba(34,197,94,0.2)" : "rgba(255,255,255,0.1)",
                  border: `1px solid ${copied ? "rgba(34,197,94,0.4)" : "rgba(255,255,255,0.15)"}`,
                  color: copied ? "#4ade80" : "white",
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? "¡Copiado!" : "Copiar texto"}
              </button>

              {"share" in navigator && (
                <button
                  onClick={handleNativeShare}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all hover:opacity-90 active:scale-95"
                  style={{
                    background: "linear-gradient(135deg, hsl(6 90% 55%), hsl(6 90% 45%))",
                    color: "white",
                  }}
                >
                  <Share2 size={16} />
                  {t.shareResults}
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
