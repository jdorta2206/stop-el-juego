import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { useT } from "@/i18n/useT";
import { usePlayer } from "@/hooks/use-player";
import { ArrowLeft, Trophy, Calendar, Flame } from "lucide-react";
import { useStreak } from "@/hooks/useStreak";
import { getApiUrl } from "@/lib/utils";

interface DailyChallenge {
  letter: string;
  categories: string[];
  date: string;
}

interface DailyRanking {
  rank: number;
  playerName: string;
  avatarColor: string;
  score: number;
}

const API_BASE = getApiUrl();

function getTodayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getTimeUntilMidnight(): string {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setUTCHours(24, 0, 0, 0);
  const diff = midnight.getTime() - now.getTime();
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h}h ${m}m`;
}

export default function DailyChallenge() {
  const { t, lang } = useT();
  const { player } = usePlayer();
  const { streak } = useStreak();
  const [, setLocation] = useLocation();
  const [challenge, setChallenge] = useState<DailyChallenge | null>(null);
  const [rankings, setRankings] = useState<DailyRanking[]>([]);
  const [playedToday, setPlayedToday] = useState(false);
  const [myScore, setMyScore] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(getTimeUntilMidnight());

  useEffect(() => {
    fetch(`${API_BASE}/api/daily?language=${lang}`)
      .then(r => r.json())
      .then(setChallenge)
      .catch(() => {});

    fetch(`${API_BASE}/api/daily/rankings?language=${lang}`)
      .then(r => r.json())
      .then(d => setRankings(d.rankings || []))
      .catch(() => {});

    // Check if already played today
    const played = localStorage.getItem(`stop_daily_${getTodayStr()}`);
    if (played) {
      setPlayedToday(true);
      setMyScore(Number(played));
    }

    const timer = setInterval(() => {
      setTimeLeft(getTimeUntilMidnight());
    }, 60000);
    return () => clearInterval(timer);
  }, [lang]);

  function handlePlay() {
    if (!challenge) return;
    const params = new URLSearchParams({
      daily: "true",
      letter: challenge.letter,
      cats: challenge.categories.join(","),
    });
    setLocation(`/solo?${params.toString()}`);
  }

  const myRank = player
    ? rankings.findIndex(r => r.playerName === player.name) + 1
    : 0;

  return (
    <Layout>
      <div className="max-w-md mx-auto w-full space-y-4 py-4 px-2">

        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/">
            <motion.button
              whileTap={{ scale: 0.92 }}
              className="w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: "rgba(255,255,255,0.1)" }}
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </motion.button>
          </Link>
          <div>
            <h1 className="text-white font-black text-xl" style={{ fontFamily: "'Baloo 2', sans-serif" }}>
              {t.daily.title}
            </h1>
            <p className="text-white/50 text-xs">{t.daily.subtitle}</p>
          </div>
          {streak.current > 0 && (
            <div className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full"
              style={{ background: "rgba(249,168,37,0.15)", border: "1px solid rgba(249,168,37,0.4)" }}>
              <Flame className="w-4 h-4 text-[#f9a825]" />
              <span className="text-[#f9a825] font-black text-sm">{streak.current}</span>
            </div>
          )}
        </div>

        {/* Challenge card */}
        {challenge && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl p-5 space-y-4"
            style={{
              background: "linear-gradient(135deg, rgba(229,62,18,0.25), rgba(26,35,126,0.35))",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            {/* Letter */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white/60 text-xs font-bold uppercase tracking-widest">{t.daily.letter}</p>
                <div
                  className="w-20 h-20 rounded-2xl flex items-center justify-center text-5xl font-black mt-1"
                  style={{
                    background: "linear-gradient(135deg, hsl(6 90% 55%), hsl(6 90% 40%))",
                    fontFamily: "'Baloo 2', sans-serif",
                    color: "white",
                    boxShadow: "0 8px 24px rgba(229,62,18,0.4)",
                  }}
                >
                  {challenge.letter}
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end text-white/50 text-xs">
                  <Calendar className="w-3 h-3" />
                  <span>{challenge.date}</span>
                </div>
                <p className="text-white/40 text-xs mt-1">{t.daily.ends}: <span className="text-white/70 font-bold">{timeLeft}</span></p>
              </div>
            </div>

            {/* Categories */}
            <div>
              <p className="text-white/60 text-xs font-bold uppercase tracking-widest mb-2">{t.daily.categories}</p>
              <div className="flex flex-wrap gap-2">
                {challenge.categories.map(cat => (
                  <span
                    key={cat}
                    className="px-3 py-1 rounded-full text-xs font-bold"
                    style={{ background: "rgba(255,255,255,0.1)", color: "white" }}
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            {/* Play / played */}
            {playedToday ? (
              <div className="text-center space-y-1">
                <p className="text-[#f9a825] font-black text-lg">✓ {t.daily.played}</p>
                {myScore !== null && (
                  <p className="text-white/70 text-sm">{t.daily.yourScore}: <span className="font-black text-white">{myScore} pts</span></p>
                )}
                {myRank > 0 && (
                  <p className="text-white/50 text-xs">#{myRank} {t.daily.rankings}</p>
                )}
              </div>
            ) : (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handlePlay}
                className="w-full py-4 rounded-2xl font-black text-xl"
                style={{
                  background: "linear-gradient(135deg, hsl(6 90% 55%), hsl(6 90% 42%))",
                  color: "white",
                  boxShadow: "0 6px 24px rgba(229,62,18,0.45)",
                  fontFamily: "'Baloo 2', sans-serif",
                }}
              >
                {t.daily.play} →
              </motion.button>
            )}
          </motion.div>
        )}

        {/* Rankings */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-3xl p-5 space-y-3"
          style={{
            background: "rgba(0,0,0,0.25)",
            border: "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#f9a825]" />
            <h2 className="text-white font-black">{t.daily.rankings}</h2>
          </div>

          {!playedToday && (
            <p className="text-white/40 text-sm text-center py-2">{t.daily.playFirst}</p>
          )}

          {playedToday && rankings.length === 0 && (
            <p className="text-white/40 text-sm text-center py-2">{t.daily.noResults}</p>
          )}

          {playedToday && rankings.map((r, i) => {
            const isMe = player && r.playerName === player.name;
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-3 py-2 px-3 rounded-xl"
                style={{
                  background: isMe ? "rgba(249,168,37,0.12)" : "rgba(255,255,255,0.04)",
                  border: isMe ? "1px solid rgba(249,168,37,0.3)" : "1px solid transparent",
                }}
              >
                <span className="text-white/40 font-black text-sm w-6 text-center">
                  {r.rank <= 3 ? ["🥇","🥈","🥉"][r.rank - 1] : `#${r.rank}`}
                </span>
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-sm flex-shrink-0"
                  style={{ background: r.avatarColor }}
                >
                  {r.playerName.charAt(0).toUpperCase()}
                </div>
                <span className={`flex-1 font-bold text-sm ${isMe ? "text-[#f9a825]" : "text-white"}`}>
                  {r.playerName} {isMe && "⭐"}
                </span>
                <span className="text-white font-black text-sm">{r.score} pts</span>
              </motion.div>
            );
          })}

          <p className="text-white/30 text-xs text-center pt-1">{t.daily.newChallenge}</p>
        </motion.div>

      </div>
    </Layout>
  );
}
