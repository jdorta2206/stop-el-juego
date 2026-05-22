import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/Layout";
import { ArrowLeft, Flame, Share2, Clock, Trophy, X as XIcon, Skull } from "lucide-react";
import { useT } from "@/i18n/useT";
import { usePlayer } from "@/hooks/use-player";
import { getApiUrl, shareText } from "@/lib/utils";
import { recordExternalStat } from "@/hooks/useAchievements";

const API = getApiUrl();
const ROUND_MS = 60000;

interface Combo { date: string; language: string; letter: string; category: string; stats: { attempts: number; wins: number } }
interface Result { played: boolean; result?: { letter: string; category: string; attempted_word?: string; attemptedWord?: string; won: boolean; time_ms?: number; timeMs?: number } }

export default function Impossible() {
  const { t, lang } = useT();
  const { player } = usePlayer();
  const [combo, setCombo] = useState<Combo | null>(null);
  const [myAttempt, setMyAttempt] = useState<Result["result"] | null>(null);
  const [word, setWord] = useState("");
  const [phase, setPhase] = useState<"idle" | "playing" | "submitting" | "done">("idle");
  const [remaining, setRemaining] = useState(ROUND_MS);
  const [outcome, setOutcome] = useState<{ won: boolean; word: string; timeMs: number; stats: { attempts: number; wins: number } } | null>(null);
  const startedAt = useRef<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load combo + my prior attempt.
  useEffect(() => {
    let stop = false;
    fetch(`${API}/api/impossible?language=${lang}`)
      .then(r => r.json())
      .then(d => { if (!stop) setCombo(d); })
      .catch(() => {});
    if (player?.id) {
      fetch(`${API}/api/impossible/me/${encodeURIComponent(player.id)}?language=${lang}`)
        .then(r => r.json())
        .then((d: Result) => {
          if (stop || !d.played || !d.result) return;
          setMyAttempt(d.result);
          setPhase("done");
        })
        .catch(() => {});
    }
    return () => { stop = true; };
  }, [lang, player?.id]);

  // Timer.
  useEffect(() => {
    if (phase !== "playing") return;
    const id = setInterval(() => {
      const left = Math.max(0, ROUND_MS - (Date.now() - startedAt.current));
      setRemaining(left);
      if (left <= 0) {
        clearInterval(id);
        void submit("", true);
      }
    }, 100);
    return () => clearInterval(id);
  }, [phase]);

  const start = useCallback(() => {
    startedAt.current = Date.now();
    setRemaining(ROUND_MS);
    setPhase("playing");
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const submit = useCallback(async (w: string, surrendered: boolean) => {
    if (!player) return;
    if (phase !== "playing") return;
    setPhase("submitting");
    const timeMs = Math.min(ROUND_MS, Date.now() - startedAt.current);
    try {
      const r = await fetch(`${API}/api/impossible/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: player.id,
          playerName: player.name,
          language: lang,
          word: w,
          timeMs,
          surrendered,
        }),
      });
      const data = await r.json();
      if (data.alreadyPlayed && data.result) {
        setMyAttempt(data.result);
      } else {
        setOutcome({ won: !!data.won, word: data.word ?? w, timeMs, stats: data.stats });
        setMyAttempt({
          letter: combo?.letter ?? "?",
          category: combo?.category ?? "",
          attemptedWord: data.word ?? w,
          won: !!data.won,
          timeMs,
        });
      }
      setPhase("done");
    } catch {
      setPhase("playing");
    }
  }, [player, phase, lang, combo]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = word.trim();
    if (w.length < 2) return;
    void submit(w, false);
  };

  const handleShare = async () => {
    const w = myAttempt?.attemptedWord || outcome?.word || "";
    const won = !!myAttempt?.won;
    const timeSec = Math.round(((myAttempt?.timeMs ?? outcome?.timeMs ?? ROUND_MS) / 1000));
    const date = combo?.date ?? new Date().toISOString().slice(0, 10);
    const stats = outcome?.stats ?? combo?.stats;
    const s = stats;
    const pct = s && s.attempts > 0 ? Math.round((s.wins / s.attempts) * 100) : null;
    const url = `${window.location.origin}/imposible`;
    const wonLine = won ? `🟩 ${t.impossible.gotIt}: ${w} (${timeSec}s)` : `🟥 ${t.impossible.gaveUp}`;
    const txt = [
      `🔥 STOP ${t.impossible.title} · ${date}`,
      `${t.impossible.letterLabel}: ${combo?.letter} · ${combo?.category}`,
      wonLine,
      pct !== null && s ? `📊 ${pct}% ${t.impossible.success} (${s.wins}/${s.attempts})` : "",
      url,
    ].filter(Boolean).join("\n");
    await shareText(txt, t.impossible.title);
    recordExternalStat(player?.id, { timesShared: 1 });
  };

  const won = !!(outcome?.won || myAttempt?.won);
  const seconds = Math.ceil(remaining / 1000);
  const stats = outcome?.stats ?? combo?.stats ?? { attempts: 0, wins: 0 };
  const pct = stats.attempts > 0 ? Math.round((stats.wins / stats.attempts) * 100) : 0;

  return (
    <Layout>
      <div className="max-w-md mx-auto w-full space-y-4 py-4 px-2">
        <div className="flex items-center gap-3">
          <Link href="/">
            <motion.button whileTap={{ scale: 0.92 }} className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.1)" }}>
              <ArrowLeft className="w-5 h-5 text-white" />
            </motion.button>
          </Link>
          <div className="flex-1">
            <h1 className="text-white font-black text-xl" style={{ fontFamily: "'Baloo 2', sans-serif" }}>
              🔥 {t.impossible.title}
            </h1>
            <p className="text-white/50 text-xs">{t.impossible.subtitle}</p>
          </div>
        </div>

        {!combo && (
          <div className="flex justify-center py-12"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>
        )}

        {combo && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl p-5 space-y-4"
            style={{
              background: "linear-gradient(135deg, rgba(181,48,26,0.32), rgba(26,35,126,0.42))",
              border: "1px solid rgba(255,255,255,0.14)",
            }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">{t.impossible.letterLabel}</p>
                <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-5xl font-black mt-1"
                  style={{
                    background: "linear-gradient(135deg, hsl(6 90% 55%), hsl(6 90% 40%))",
                    fontFamily: "'Baloo 2', sans-serif",
                    color: "white",
                    boxShadow: "0 8px 24px rgba(181,48,26,0.4)",
                  }}>{combo.letter}</div>
              </div>
              <div className="flex-1">
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest">{t.impossible.categoryLabel}</p>
                <p className="text-white font-black text-lg leading-tight mt-1" style={{ fontFamily: "'Baloo 2', sans-serif" }}>
                  {combo.category}
                </p>
              </div>
            </div>

            {/* Idle: explain + start button (or login required) */}
            {phase === "idle" && !myAttempt && (
              <>
                <p className="text-white/70 text-sm leading-snug">
                  {t.impossible.rules}
                </p>
                {player ? (
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={start}
                    className="w-full py-4 rounded-2xl font-black text-xl"
                    style={{
                      background: "linear-gradient(135deg, hsl(6 90% 55%), hsl(6 90% 42%))",
                      color: "white",
                      boxShadow: "0 6px 24px rgba(181,48,26,0.5)",
                      fontFamily: "'Baloo 2', sans-serif",
                    }}>
                    🚀 {t.impossible.start}
                  </motion.button>
                ) : (
                  <p className="text-white/60 text-sm text-center py-2">{t.impossible.loginRequired}</p>
                )}
              </>
            )}

            {/* Playing: timer + input + surrender */}
            {(phase === "playing" || phase === "submitting") && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-5 h-5" style={{ color: seconds <= 10 ? "#fca5a5" : "#fbbf24" }} />
                    <motion.span key={seconds}
                      initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                      className="font-black text-2xl"
                      style={{ color: seconds <= 10 ? "#fca5a5" : "#fbbf24", fontFamily: "'Baloo 2', sans-serif" }}>
                      {seconds}s
                    </motion.span>
                  </div>
                  <div className="h-2 flex-1 ml-3 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.3)" }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: seconds <= 10 ? "#ef4444" : "#fbbf24" }}
                      animate={{ width: `${(remaining / ROUND_MS) * 100}%` }}
                      transition={{ duration: 0.15 }}
                    />
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-3">
                  <input ref={inputRef} type="text" value={word} onChange={e => setWord(e.target.value)}
                    placeholder={`${combo.letter}...`} autoComplete="off" autoCorrect="off" spellCheck={false}
                    disabled={phase === "submitting"}
                    className="w-full py-4 px-5 rounded-2xl text-white font-black text-2xl outline-none"
                    style={{
                      background: "rgba(0,0,0,0.4)",
                      border: "2px solid rgba(251,191,36,0.4)",
                      fontFamily: "'Baloo 2', sans-serif",
                    }} />
                  <div className="flex gap-2">
                    <motion.button type="submit" whileTap={{ scale: 0.97 }} disabled={word.trim().length < 2 || phase === "submitting"}
                      className="flex-1 py-3 rounded-2xl font-black"
                      style={{
                        background: word.trim().length < 2 ? "rgba(255,255,255,0.1)" : "linear-gradient(135deg, #22c55e, #15803d)",
                        color: "white",
                        opacity: phase === "submitting" ? 0.6 : 1,
                      }}>
                      ✓ {t.impossible.submit}
                    </motion.button>
                    <motion.button type="button" whileTap={{ scale: 0.97 }} disabled={phase === "submitting"}
                      onClick={() => submit("", true)}
                      className="px-4 py-3 rounded-2xl font-bold text-white/70"
                      style={{ background: "rgba(255,255,255,0.08)" }}>
                      {t.impossible.surrender}
                    </motion.button>
                  </div>
                </form>
              </div>
            )}

            {/* Done: result + stats + share */}
            {phase === "done" && (
              <AnimatePresence>
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                  <div className="text-center py-2">
                    {won ? (
                      <>
                        <div className="text-5xl mb-2">🏆</div>
                        <p className="text-[#22c55e] font-black text-2xl" style={{ fontFamily: "'Baloo 2', sans-serif" }}>
                          {t.impossible.youGotIt}
                        </p>
                        <p className="text-white mt-1 font-bold">
                          "{myAttempt?.attemptedWord || outcome?.word}"
                        </p>
                      </>
                    ) : (
                      <>
                        <Skull className="w-12 h-12 mx-auto text-white/40 mb-2" />
                        <p className="text-[#fca5a5] font-black text-2xl" style={{ fontFamily: "'Baloo 2', sans-serif" }}>
                          {myAttempt?.attemptedWord ? t.impossible.notValid : t.impossible.youGaveUp}
                        </p>
                        {myAttempt?.attemptedWord && (
                          <p className="text-white/60 mt-1">"{myAttempt.attemptedWord}"</p>
                        )}
                      </>
                    )}
                  </div>

                  <div className="rounded-2xl p-3 space-y-2" style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}>
                    <div className="flex items-center justify-between">
                      <span className="text-white/60 text-xs font-bold uppercase tracking-wider">{t.impossible.globalStats}</span>
                      <span className="text-white font-black">{stats.wins} / {stats.attempts}</span>
                    </div>
                    <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }}
                        className="h-full" style={{ background: "linear-gradient(90deg, #fbbf24, #f97316)" }} />
                    </div>
                    <p className="text-white/60 text-xs text-center">
                      {stats.attempts > 0
                        ? <>{t.impossible.successRate}: <span className="text-[#fbbf24] font-black">{pct}%</span></>
                        : t.impossible.firstToPlay}
                    </p>
                  </div>

                  <motion.button whileTap={{ scale: 0.97 }} onClick={handleShare}
                    className="w-full py-3 rounded-2xl font-black flex items-center justify-center gap-2"
                    style={{ background: "linear-gradient(135deg, #25D366, #128C7E)", color: "white" }}>
                    <Share2 className="w-5 h-5" />
                    {t.impossible.share}
                  </motion.button>

                  <p className="text-white/40 text-xs text-center">{t.impossible.nextTomorrow}</p>
                </motion.div>
              </AnimatePresence>
            )}
          </motion.div>
        )}
      </div>
    </Layout>
  );
}
