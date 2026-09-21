import { useState, useEffect } from "react";
import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui";
import { Play, Users, Trophy, Share2, Facebook, Instagram, Crown, Swords, BookOpen, Flame, Calendar, Zap, Star, Medal } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { shareText } from "@/lib/utils";
import { PremiumModal } from "@/components/PremiumModal";
import { usePremium } from "@/lib/usePremium";
import { useFollows, useFriendsOnline } from "@/lib/useFollows";
import { usePlayer } from "@/hooks/use-player";
import { useT } from "@/i18n/useT";
import { useDisplayStreak } from "@/hooks/useDisplayStreak";
import { useAchievements } from "@/hooks/useAchievements";
import { StreakCalendarModal } from "@/components/StreakCalendar";
import { FTUEWelcomeModal } from "@/components/FTUEWelcomeModal";
import { FTUEUnlockModal } from "@/components/FTUEUnlockModal";
import { FTUECompletionModal } from "@/components/FTUECompletionModal";
import { useFTUE } from "@/hooks/useFTUE";
import { AchievementToast } from "@/components/AchievementToast";
import { useProgression, getLeague } from "@/hooks/useProgression";
import { useSeason } from "@/hooks/useSeason";
import { useGetLeaderboard, useGetPlayerStats } from "@workspace/api-client-react";
import { PackSelector } from "@/components/PackSelector";
import { CustomPacksManager } from "@/components/CustomPacksManager";
import { useCustomPacks } from "@/lib/useCustomPacks";
import { BannerAd } from "@/components/AdSystem";
import { PLAY_STORE_URL } from "@/lib/playReview";
import { HalloweenBanner } from "@/components/HalloweenBanner";

const LOGO_URL = `${import.meta.env.BASE_URL}images/stop-logo.png`;

export default function Home() {
  const { player } = usePlayer();
  const { isPremium } = usePremium(player?.id);
  const { friends } = useFollows(player?.id);
  const friendsOnline = useFriendsOnline(player?.id, friends);
  const { t } = useT();
  const { streak, playedToday } = useDisplayStreak();
  const streakAtRisk = streak.current > 0 && !playedToday;
  const { unlocked, newlyUnlocked, clearNewlyUnlocked, checkStreakMilestone } = useAchievements(player?.id);
  const [showStreakCalendar, setShowStreakCalendar] = useState(false);
  // Whether today's daily challenge was already played (same localStorage key
  // the DailyChallenge page uses), so the banner reflects the player's state.
  const [dailyDone] = useState(() => {
    try {
      const today = new Date().toISOString().slice(0, 10);
      return !!localStorage.getItem(`stop_daily_${today}`);
    } catch {
      return false;
    }
  });
  const ftue = useFTUE();
  const [showFTUEWelcome, setShowFTUEWelcome] = useState(false);
  const [showFTUEUnlock, setShowFTUEUnlock] = useState(false);
  const [showFTUECompletion, setShowFTUECompletion] = useState(false);

  // Open the FTUE welcome modal once on first ever visit (after a tiny delay
  // so the home page can render its hero animation first).
  useEffect(() => {
    if (!ftue.isFirstVisit) return;
    const t = setTimeout(() => setShowFTUEWelcome(true), 600);
    return () => clearTimeout(t);
  }, [ftue.isFirstVisit]);

  useEffect(() => {
    if (!ftue.done || ftue.gamesPlayed < ftue.tutorialGamesTotal) return;
    try {
      if (localStorage.getItem("stop_ftue_unlock_seen") === "1") return;
      localStorage.setItem("stop_ftue_unlock_seen", "1");
      const id = window.setTimeout(() => setShowFTUECompletion(true), 450);
      return () => window.clearTimeout(id);
    } catch {
      setShowFTUECompletion(true);
    }
  }, [ftue.done, ftue.gamesPlayed, ftue.tutorialGamesTotal]);

  // Deterministically evaluate streak milestones from local streak data on
  // every Home mount / streak change — independent of whether the player
  // opens the streak calendar modal. Idempotent: only fires once per crossing.
  useEffect(() => {
    if (streak.longest >= 3) checkStreakMilestone(streak.longest);
  }, [streak.longest, checkStreakMilestone]);
  const { level, xp, progress } = useProgression(player?.id);
  const league = getLeague(level);
  const { season, progress: seasonProgress } = useSeason(player?.id);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showPacksManager, setShowPacksManager] = useState(false);
  const { packs: customPacks } = useCustomPacks(isPremium ? player?.id : null);
  const [invitedBy, setInvitedBy] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: leaderboardData } = useGetLeaderboard({ limit: 3 }, { query: { staleTime: 60_000 } as any });
  const top3 = leaderboardData?.players?.slice(0, 3) ?? [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: myStats } = useGetPlayerStats(player?.id || "", { query: { enabled: !!player?.id && player?.loginMethod !== "guest", staleTime: 30_000 } as any });
  const myScore = myStats?.score;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("premium") === "success") {
      window.history.replaceState({}, "", window.location.pathname);
      setShowPremiumModal(true);
    }
    // Personalised invite banner — persist through OAuth redirect via sessionStorage
    const from = params.get("from");
    if (from) {
      const name = decodeURIComponent(from);
      sessionStorage.setItem("stop_invited_by", name);
      window.history.replaceState({}, "", window.location.pathname);
      setInvitedBy(name);
    } else {
      const stored = sessionStorage.getItem("stop_invited_by");
      if (stored) {
        setInvitedBy(stored);
        sessionStorage.removeItem("stop_invited_by");
      }
    }
  }, []);

  const share = shareText(
    t.home.howToPlayText,
    "https://stopjuegodepalabras.com"
  );

  return (
    <Layout>
      <FTUEWelcomeModal
        open={showFTUEWelcome}
        onClose={() => {
          setShowFTUEWelcome(false);
          ftue.dismissWelcome();
        }}
      />
      <FTUEUnlockModal
        open={showFTUEUnlock}
        onClose={() => {
          setShowFTUEUnlock(false);
          ftue.markUnlockSeen();
        }}
      />
      <FTUECompletionModal
        open={showFTUECompletion}
        onClose={() => setShowFTUECompletion(false)}
      />

      {showPremiumModal && (
        <PremiumModal
          open={showPremiumModal}
          onClose={() => setShowPremiumModal(false)}
          playerId={player?.id || "guest"}
          playerName={player?.name || ""}
          isPremium={isPremium}
        />
      )}

      <div className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full space-y-7 py-6">
        <HalloweenBanner />

        {/* Invite welcome banner */}
        <AnimatePresence>
          {invitedBy && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20 }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{
                background: "linear-gradient(135deg, rgba(249,168,37,0.15), rgba(249,168,37,0.05))",
                border: "1px solid rgba(249,168,37,0.4)",
              }}
            >
              <div className="text-2xl flex-shrink-0">🎮</div>
              <div className="flex-1 min-w-0">
                <p className="text-[#f9a825] font-black text-sm truncate">
                  <span className="text-white">{invitedBy}</span> te ha invitado a jugar
                </p>
                <p className="text-white/50 text-xs">¡Regístrate y acéptale el reto!</p>
              </div>
              <Link href="/multiplayer">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black flex-shrink-0"
                  style={{ background: "#f9a825", color: "#0d1757" }}
                >
                  <Swords size={12} /> Retar
                </motion.button>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Logo */}
        <motion.div
          initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", bounce: 0.55, duration: 0.9 }}
          className="flex flex-col items-center gap-3"
        >
          <motion.img
            src={LOGO_URL}
            alt="STOP"
            className="w-36 h-36 md:w-44 md:h-44 rounded-full"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.4), 0 0 0 4px rgba(249,168,37,0.3)" }}
            animate={{ rotate: [0, 2, -2, 0] }}
            transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
          />
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-xs font-black uppercase tracking-widest text-center"
            style={{ color: "hsl(6 90% 70%)", letterSpacing: "0.15em" }}
          >
            El juego que nadie supera
          </motion.p>
          {/* Level + League badges */}
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", bounce: 0.6, delay: 0.35 }}
            className="flex items-center gap-2"
          >
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
              style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
            >
              <Star className="w-3.5 h-3.5 text-[#f9a825]" fill="#f9a825" />
              <span className="text-white font-black text-xs">{t.home.level} {level}</span>
              <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.1)" }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${progress}%`, background: "linear-gradient(90deg, #f9a825, hsl(6 90% 55%))" }}
                />
              </div>
              <span className="text-white/40 text-xs">{xp}{t.home.xp}</span>
            </div>
            {/* League badge */}
            <motion.div
              whileHover={{ scale: 1.1 }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-full font-black text-xs"
              style={{
                background: `${league.color}22`,
                border: `1px solid ${league.color}66`,
                color: league.color,
              }}
              title={`${t.home.yourLeague}: ${(t.home as Record<string,string>)[league.key] ?? league.key}`}
            >
              <span>{league.emoji}</span>
              <span>{(t.home as Record<string,string>)[league.key] ?? league.key}</span>
            </motion.div>
          </motion.div>

          {/* Streak badge — opens the visual streak calendar modal */}
          {streak.current > 0 && (
            <button
              type="button"
              onClick={() => setShowStreakCalendar(true)}
              className="bg-transparent border-0 p-0"
              aria-label={t.streak.label}
            >
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={
                  streakAtRisk
                    ? { scale: 1, opacity: 1, boxShadow: ["0 0 0 rgba(220,38,38,0)", "0 0 18px rgba(220,38,38,0.55)", "0 0 0 rgba(220,38,38,0)"] }
                    : { scale: 1, opacity: 1 }
                }
                transition={
                  streakAtRisk
                    ? { boxShadow: { repeat: Infinity, duration: 1.6 }, default: { type: "spring", bounce: 0.6, delay: 0.4 } }
                    : { type: "spring", bounce: 0.6, delay: 0.4 }
                }
                className="flex items-center gap-2 px-4 py-2 rounded-full cursor-pointer"
                style={{
                  background: streakAtRisk
                    ? "linear-gradient(135deg, rgba(220,38,38,0.25), rgba(249,168,37,0.18))"
                    : streak.current >= 7
                      ? "linear-gradient(135deg, rgba(249,168,37,0.3), rgba(181,48,26,0.3))"
                      : "rgba(249,168,37,0.15)",
                  border: streakAtRisk
                    ? "1.5px solid rgba(220,38,38,0.7)"
                    : "1px solid rgba(249,168,37,0.5)",
                }}
              >
                <Flame className={`w-4 h-4 ${streakAtRisk ? "text-red-400" : "text-[#f9a825]"}`} />
                <span className={`font-black text-sm ${streakAtRisk ? "text-white" : "text-[#f9a825]"}`}>
                  {streak.current} {t.streak.days}
                </span>
                {streakAtRisk ? (
                  <span className="text-red-300 text-xs font-black uppercase tracking-wide">
                    ⚠️ Salva tu racha
                  </span>
                ) : streak.current === streak.longest && streak.current >= 3 ? (
                  <span className="text-white/60 text-xs">🏆 {t.streak.newRecord}</span>
                ) : (
                  <span className="text-white/60 text-xs">✓ Hoy</span>
                )}
              </motion.div>
            </button>
          )}
        </motion.div>

        {!ftue.isInTutorial && (
          <>
                  {/* Streak calendar modal */}
                  {player?.id && (
                    <StreakCalendarModal
                      open={showStreakCalendar}
                      onClose={() => setShowStreakCalendar(false)}
                      playerId={player.id}
                      playerName={player.name ?? "Jugador"}
                      onMilestoneReached={(_, current) => checkStreakMilestone(current)}
                    />
                  )}
          
                  {/* Achievement toast (for streak milestone unlocks etc.) */}
                  <AchievementToast
                    achievement={newlyUnlocked}
                    onDone={clearNewlyUnlocked}
                    tAchievements={t.achievements as unknown as { [key: string]: string; new: string; xpBonus: string }}
                  />
          
                  {/* 🎯 Reto del Día — prominent daily-challenge entry, shown to everyone
                      so the daily loop is the first thing players see when opening the app. */}
                  <Link href="/reto">
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1, type: "spring", bounce: 0.4 }}
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      className="relative w-full overflow-hidden rounded-2xl cursor-pointer"
                      style={{
                        background: "linear-gradient(135deg, #1a237e 0%, #4527a0 55%, #b5301a 100%)",
                        border: "2px solid rgba(249,168,37,0.55)",
                        boxShadow: "0 8px 30px rgba(0,0,0,0.35)",
                      }}
                      data-testid="daily-challenge-banner"
                    >
                      <span
                        aria-hidden
                        className="absolute inset-0 pointer-events-none"
                        style={{ background: "radial-gradient(circle at 18% 20%, rgba(255,255,255,0.18), transparent 55%)" }}
                      />
                      <div className="relative flex items-center gap-3 px-4 py-4">
                        <motion.div
                          className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-2xl"
                          style={{ background: "rgba(249,168,37,0.18)", border: "1px solid rgba(249,168,37,0.5)" }}
                          animate={{ rotate: [0, -6, 6, 0] }}
                          transition={{ repeat: Infinity, duration: 3.2, repeatDelay: 1 }}
                        >
                          🎯
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-[#f9a825]">
                              {t.daily.title}
                            </p>
                            {!dailyDone && (
                              <span className="relative flex h-2 w-2" aria-hidden>
                                <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400" />
                              </span>
                            )}
                          </div>
                          <p className="text-white font-black text-base leading-tight truncate">
                            {t.daily.subtitle}
                          </p>
                          <p className="text-white/55 text-[11px] leading-tight mt-0.5 truncate">
                            {t.daily.newChallenge}
                          </p>
                        </div>
                        <div
                          className="flex-shrink-0 px-3 py-2 rounded-xl font-black text-xs text-center whitespace-nowrap"
                          style={
                            dailyDone
                              ? { background: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }
                              : { background: "#f9a825", color: "#0d1757" }
                          }
                        >
                          {dailyDone ? `${t.daily.played} ✓` : `${t.daily.play} →`}
                        </div>
                      </div>
                    </motion.div>
                  </Link>
          
                  {/* 🎟️ Season Pass banner — only shown when there's a mission ready to claim */}
                  {player && season && seasonProgress && seasonProgress.hasUnclaimedMissions && (
                    <Link href="/season">
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.99 }}
                        className="w-full px-4 py-3 rounded-2xl cursor-pointer"
                        style={{
                          background: `linear-gradient(135deg, ${season.theme?.color ?? "#f9a825"}26, rgba(13,23,87,0.5))`,
                          border: `1.5px solid ${season.theme?.color ?? "#f9a825"}66`,
                        }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-3xl flex-shrink-0">{season.theme?.emoji ?? "🎟️"}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p
                                className="text-[10px] font-black uppercase tracking-widest"
                                style={{ color: season.theme?.color ?? "#f9a825" }}
                              >
                                Temporada
                              </p>
                              {seasonProgress.hasUnclaimedMissions && (
                                <span
                                  className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded animate-pulse"
                                  style={{ background: "#f9a825", color: "#0d1757" }}
                                >
                                  ¡Reclama!
                                </span>
                              )}
                            </div>
                            <p className="text-white font-black text-sm truncate">
                              {season.theme?.name ?? "Season Pass"}
                            </p>
                            <div className="flex items-center gap-2 mt-1">
                              <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.3)" }}>
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.min(100, ((seasonProgress.xp % 100) / 100) * 100)}%`,
                                    background: `linear-gradient(90deg, ${season.theme?.color ?? "#f9a825"}, #dc2626)`,
                                  }}
                                />
                              </div>
                              <span className="text-white/70 text-[10px] font-mono">
                                Nv {seasonProgress.currentTier}/{seasonProgress.totalTiers}
                              </span>
                            </div>
                          </div>
                          <span className="text-white/60 font-black text-lg flex-shrink-0">→</span>
                        </div>
                      </motion.div>
                    </Link>
                  )}
          
                  {/* 🔴 EN VIVO ahora — public streamer rooms */}
                  <LiveRoomsSection />
          
                  {/* 👥 Amigos jugando ahora — quick join. Empty-state CTA shows even
                      when no friends are online so new users see the social layer
                      exists and have a clear path to invite people (retention loop). */}
                  {friendsOnline.length === 0 && (
                    <Link href="/amigos">
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.12 }}
                        className="w-full px-3 py-2.5 rounded-xl cursor-pointer"
                        style={{ background: "rgba(255,255,255,0.04)", border: "1.5px dashed rgba(255,255,255,0.18)" }}
                        data-testid="empty-friends-cta"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-white/70">
                            👥 Invita amigos y juega retos juntos
                          </span>
                          <span className="text-[10px] font-black text-amber-300 uppercase tracking-wide">
                            Añadir →
                          </span>
                        </div>
                      </motion.div>
                    </Link>
                  )}
                  {friendsOnline.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.12 }}
                      className="w-full px-3 py-2.5 rounded-xl"
                      style={{ background: "rgba(34,197,94,0.10)", border: "1.5px solid rgba(34,197,94,0.45)" }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-black text-green-300 flex items-center gap-1.5">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                          </span>
                          Amigos online · {friendsOnline.length}
                        </span>
                      </div>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {friendsOnline.slice(0, 8).map((f) => {
                          const inRoom = !!f.roomCode;
                          const card = (
                            <div className="flex flex-col items-center gap-1 min-w-[58px] cursor-pointer group">
                              <div className="relative">
                                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow"
                                  style={{ backgroundColor: f.avatarColor }}>
                                  {f.name.charAt(0).toUpperCase()}
                                </div>
                                <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#1a1a2e] ${inRoom ? "bg-fuchsia-500 animate-pulse" : "bg-green-500"}`} />
                              </div>
                              <span className="text-[10px] font-bold text-white/90 truncate max-w-[58px]">{f.name}</span>
                              <span className={`text-[9px] font-black uppercase tracking-wide ${inRoom ? "text-fuchsia-300" : "text-green-300"}`}>
                                {inRoom ? "Jugando" : "Online"}
                              </span>
                            </div>
                          );
                          return inRoom ? (
                            <Link key={f.playerId} href={`/room/${f.roomCode}`} title={`Unirme a la sala de ${f.name}`}>
                              {card}
                            </Link>
                          ) : (
                            <div key={f.playerId} title={`${f.name} está online`}>{card}</div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
          
                  {/* Global challenge hook — shown when leaderboard has data */}
                  {top3[0] && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.15, type: "spring", bounce: 0.4 }}
                    >
                      <Link href="/ranking">
                        <motion.div
                          animate={{ boxShadow: ["0 0 0px rgba(181,48,26,0)", "0 0 18px rgba(181,48,26,0.45)", "0 0 0px rgba(181,48,26,0)"] }}
                          transition={{ repeat: Infinity, duration: 2.4 }}
                          className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl cursor-pointer"
                          style={{ background: "rgba(181,48,26,0.12)", border: "1.5px solid rgba(181,48,26,0.45)" }}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-lg">🔥</span>
                            <div>
                              <p className="text-[hsl(6_90%_70%)] font-black text-xs uppercase tracking-wide leading-tight">
                                {t.home.globalRecord ?? "Récord global"}
                              </p>
                              <p className="text-white font-black text-sm leading-tight">
                                {top3[0].totalScore?.toLocaleString() ?? 0} pts — {top3[0].playerName}
                              </p>
                            </div>
                          </div>
                          <p className="text-[hsl(6_90%_70%)] font-black text-xs text-right max-w-[110px] leading-tight">
                            {t.home.canYouBeat ?? "¿Puedes superarlo?"} →
                          </p>
                        </motion.div>
                      </Link>
                    </motion.div>
                  )}
          
          
          </>
        )}

        {/* Category Pack Selector */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="w-full"
        >
          <PackSelector
            isPremium={isPremium}
            onPremiumClick={() => setShowPremiumModal(true)}
            customPacks={customPacks}
            onManageCustomClick={() => setShowPacksManager(true)}
          />
        </motion.div>

        {/* Main buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="w-full space-y-3"
        >
          {/* ⚡ HERO: JUGAR YA — auto-starts a quick match in 1 tap */}
          <Link href="/solo?auto=1&ftue=1">
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.97 }}
              animate={{ boxShadow: [
                "0 6px 28px rgba(220,38,38,0.45)",
                "0 6px 38px rgba(249,168,37,0.65)",
                "0 6px 28px rgba(220,38,38,0.45)",
              ] }}
              transition={{ repeat: Infinity, duration: 1.8 }}
              className="relative w-full flex items-center justify-center gap-3 py-7 rounded-2xl font-black tracking-wide overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #f9a825 0%, #dc2626 60%, #7c1d1d 100%)",
                color: "white",
                fontFamily: "'Baloo 2', sans-serif",
              }}
            >
              <motion.span
                className="absolute inset-0 pointer-events-none"
                style={{ background: "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.25), transparent 60%)" }}
                animate={{ opacity: [0.4, 0.8, 0.4] }}
                transition={{ repeat: Infinity, duration: 2.2 }}
              />
              <Zap className="w-7 h-7 fill-white relative z-10" />
              <span className="text-3xl relative z-10" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
                {ftue.isInTutorial ? "¡JUGAR AHORA!" : "¡JUGAR YA!"}
              </span>
            </motion.div>
          </Link>

          {ftue.isInTutorial && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full rounded-2xl px-4 py-3"
              style={{
                background: "rgba(249,168,37,0.10)",
                border: "1.5px solid rgba(249,168,37,0.35)",
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-white font-black text-sm">Tu inicio en STOP</span>
                <span className="text-[#f9a825] font-black text-xs">{ftue.gamesPlayed}/{ftue.tutorialGamesTotal}</span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: String(ftue.gamesPlayed / ftue.tutorialGamesTotal * 100) + "%" }}
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, #f9a825, #dc2626)" }}
                />
              </div>
              <p className="text-white/50 text-[11px] font-bold mt-2">
                Completa tus 3 primeras partidas para desbloquear todos los modos.
              </p>
            </motion.div>
          )}

          {!ftue.isInTutorial && (
            <>
                      {/* Live stats chip — visible always, makes rank tangible */}
                      {player && player.loginMethod !== "guest" && (
                        <Link href="/ranking">
                          <motion.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="w-full flex items-center justify-around gap-2 py-2.5 px-4 rounded-xl cursor-pointer"
                            style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(249,168,37,0.25)" }}
                          >
                            <div className="flex flex-col items-center min-w-0 flex-1">
                              <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Top</span>
                              <span className="text-[#f9a825] font-black text-base leading-tight">
                                {myScore?.rank ? `#${myScore.rank}` : "—"}
                              </span>
                            </div>
                            <div className="w-px h-8 bg-white/10" />
                            <div className="flex flex-col items-center min-w-0 flex-1">
                              <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Victorias</span>
                              <span className="text-white font-black text-base leading-tight">{myScore?.wins ?? 0}</span>
                            </div>
                            <div className="w-px h-8 bg-white/10" />
                            <div className="flex flex-col items-center min-w-0 flex-1">
                              <span className="text-[10px] text-white/50 uppercase font-bold tracking-wider">Partidas</span>
                              <span className="text-white font-black text-base leading-tight">{myScore?.gamesPlayed ?? 0}</span>
                            </div>
                          </motion.div>
                        </Link>
                      )}
            
                      {ftue.isInTutorial ? (
                        <motion.div
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="w-full rounded-2xl p-4 text-center"
                          style={{
                            background: "linear-gradient(135deg, rgba(26,35,126,0.45), rgba(181,48,26,0.22))",
                            border: "1.5px solid rgba(249,168,37,0.35)",
                          }}
                        >
                          <p className="text-[#f9a825] text-xs font-black uppercase tracking-widest mb-1">
                            {t.ftue?.tutorialBadge ?? "Tutorial"}
                          </p>
                          <p className="text-white font-black text-lg">
                            {ftue.gamesPlayed === 0
                              ? (t.ftue?.tutorialProgressFirst ?? "Tu primera partida empieza ahora")
                              : (t.ftue?.tutorialProgressCount ?? "¡Muy bien! Ya llevas {n} de 3 partidas").replace("{n}", String(ftue.gamesPlayed))}
                          </p>
                          <p className="text-white/55 text-xs mt-1">
                            {t.ftue?.tutorialProgressSubtitle ?? "Completa 3 partidas para descubrir todo lo que ofrece STOP."}
                          </p>
                          <div className="flex justify-center gap-2 mt-4" aria-label={`Progreso ${ftue.gamesPlayed} de 3`}>
                            {[0,1,2].map((i) => (
                              <span key={i} className="h-2.5 w-12 rounded-full" style={{
                                background: i < ftue.gamesPlayed ? "linear-gradient(90deg, #f9a825, #dc2626)" : "rgba(255,255,255,0.12)",
                              }} />
                            ))}
                          </div>
                        </motion.div>
                      ) : (
                      <>
                      {/* Secondary: classic solo (with start screen, settings) */}
                      <Link href="/solo">
                        <motion.div
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full flex items-center gap-4 px-5 py-3 rounded-2xl font-black tracking-wide"
                          style={{
                            background: "linear-gradient(135deg, rgba(26,35,126,0.55), rgba(40,53,147,0.45))",
                            border: "1.5px solid rgba(255,255,255,0.12)",
                            color: "white",
                          }}
                        >
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: "linear-gradient(135deg, #1a237e, #283593)" }}
                          >
                            <Play className="w-5 h-5 fill-white text-white" />
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-black text-sm leading-tight">{t.home.soloVsAI}</p>
                            <p className="text-white/50 text-xs font-bold">3 rondas · eventos · IA</p>
                          </div>
                          <span className="text-white/40 font-black text-lg">→</span>
                        </motion.div>
                      </Link>
            
                      {/* 🎲 STOP Random — el juego corta cuando le da la gana */}
                      <Link href="/solo?mode=random">
                        <motion.div
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl font-black tracking-wide shadow-lg"
                          style={{
                            background: "linear-gradient(135deg, rgba(236,72,153,0.22), rgba(88,28,135,0.28))",
                            border: "2px solid rgba(236,72,153,0.55)",
                            color: "white",
                          }}
                        >
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                            style={{ background: "linear-gradient(135deg, #ec4899, #7e22ce)" }}
                          >
                            🎲
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-black text-base leading-tight">STOP Random</p>
                            <p className="text-white/60 text-xs font-bold">Tiempo oculto · corta cuando quiere</p>
                          </div>
                          <span className="text-pink-400 font-black text-lg">→</span>
                        </motion.div>
                      </Link>
            
                      {/* Chaos mode button */}
                      <Link href="/solo?mode=chaos">
                        <motion.div
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full flex items-center gap-4 px-5 py-3.5 rounded-2xl font-black tracking-wide shadow-lg"
                          style={{
                            background: "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(59,7,100,0.25))",
                            border: "2px solid rgba(139,92,246,0.5)",
                            color: "white",
                          }}
                        >
                          <div
                            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-xl"
                            style={{ background: "linear-gradient(135deg, #7c3aed, #4c1d95)" }}
                          >
                            🌀
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-black text-base leading-tight">{t.home.chaosMode}</p>
                            <p className="text-white/55 text-xs font-bold">{t.home.chaosModeSubtitle}</p>
                          </div>
                          <span className="text-purple-400 font-black text-lg">→</span>
                        </motion.div>
                      </Link>
            
                      <motion.button
                        whileHover={{ scale: 1.02, y: -1 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setShowPremiumModal(true)}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-black text-base tracking-wide shadow-lg"
                        style={
                          isPremium
                            ? { background: "rgba(249,168,37,0.18)", border: "2px solid rgba(249,168,37,0.5)", color: "#f9a825" }
                            : { background: "rgba(249,168,37,0.12)", border: "2px solid rgba(249,168,37,0.3)", color: "#f9a825" }
                        }
                      >
                        <Crown className="w-5 h-5" />
                        {isPremium ? `⭐ ${t.premium.active}` : `${t.premium.title} — ${t.premium.features[0]}`}
                      </motion.button>
            
                      {/* Streamer directory — discover live public rooms */}
                      <Link href="/streamers">
                        <motion.div
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl cursor-pointer"
                          style={{
                            background: "linear-gradient(135deg, rgba(168,85,247,0.22), rgba(79,70,229,0.22))",
                            border: "1.5px solid rgba(168,85,247,0.45)",
                          }}
                        >
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 relative"
                            style={{ background: "linear-gradient(135deg, #a855f7, #4f46e5)" }}>
                            <span className="text-xl">📺</span>
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500 border-2 border-[#1a0f2e]" />
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-black text-base">{(t as any).streamer?.homeCard ?? "En directo"}</p>
                            <p className="text-white/55 text-xs">{(t as any).streamer?.homeCardSub ?? "Mira partidas de streamers en vivo"}</p>
                          </div>
                          <span className="text-purple-300 font-black text-lg">→</span>
                        </motion.div>
                      </Link>
            
                      {/* Impossible Word — viral daily hook */}
                      <Link href="/imposible">
                        <motion.div
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl cursor-pointer"
                          style={{
                            background: "linear-gradient(135deg, rgba(220,38,38,0.28), rgba(124,45,18,0.28))",
                            border: "2px solid rgba(239,68,68,0.55)",
                            boxShadow: "0 6px 22px rgba(220,38,38,0.25)",
                          }}
                        >
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 text-2xl"
                            style={{ background: "linear-gradient(135deg, #ef4444, #7f1d1d)" }}>
                            🔥
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-black text-base">{(t as any).impossible?.homeCard ?? "Palabra Imposible"}</p>
                            <p className="text-white/65 text-xs">{(t as any).impossible?.homeCardSub ?? "¿Te atreves con el reto de hoy?"}</p>
                          </div>
                          <span className="text-[#fca5a5] font-black text-lg">→</span>
                        </motion.div>
                      </Link>
            
                      {/* Daily Challenge card */}
                      <Link href="/reto">
                        <motion.div
                          whileHover={{ scale: 1.02, y: -2 }}
                          whileTap={{ scale: 0.98 }}
                          className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl cursor-pointer"
                          style={{
                            background: "linear-gradient(135deg, rgba(181,48,26,0.2), rgba(249,168,37,0.15))",
                            border: "2px solid rgba(249,168,37,0.35)",
                          }}
                        >
                          <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                            style={{ background: "linear-gradient(135deg, hsl(6 90% 55%), hsl(6 90% 40%))" }}>
                            <Calendar className="w-6 h-6 text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-black text-base">{t.daily.title}</p>
                            <p className="text-white/55 text-xs">{t.daily.subtitle}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            {streak.current > 0 && (
                              <div className="flex items-center gap-1 bg-black/20 px-2 py-1 rounded-full mr-1">
                                <Flame className="w-3 h-3 text-[#f9a825]" />
                                <span className="text-[#f9a825] font-black text-xs">{streak.current}</span>
                              </div>
                            )}
                            <span className="text-[#f9a825] font-black text-lg">→</span>
                          </div>
                        </motion.div>
                      </Link>
            
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { href: "/season",     icon: <Star className="w-8 h-8 text-amber-400" />, label: "Pase de Temporada", highlight: true },
                          { href: "/torneo",      icon: <Trophy className="w-8 h-8 text-amber-400" />, label: "Torneo", highlight: true },
                          { href: "/multiplayer", icon: <Users className="w-8 h-8 text-[#f9a825]" />, label: t.home.multiplayer },
                          { href: "/ranking",    icon: <Crown className="w-8 h-8 text-[#f9a825]" />, label: t.home.ranking },
                          { href: "/logros",     icon: <Medal className="w-8 h-8 text-[#f9a825]" />, label: (t.achievements as any)?.title ?? "Logros" },
                          { href: "/coleccion",  icon: <BookOpen className="w-8 h-8 text-[#f9a825]" />, label: (t as any).collection?.title ?? "Mi Colección" },
                        ].map(item => (
                          <Link key={item.href} href={item.href}>
                            <motion.div
                              whileHover={{ scale: 1.03, y: -2 }}
                              whileTap={{ scale: 0.97 }}
                              className="flex flex-col items-center gap-2 py-5 rounded-2xl font-bold shadow-lg cursor-pointer"
                              style={{
                                background: item.highlight ? "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(220,38,38,0.12))" : "rgba(0,0,0,0.25)",
                                border: item.highlight ? "2px solid rgba(245,158,11,0.45)" : "2px solid rgba(255,255,255,0.15)",
                                color: "white",
                                backdropFilter: "blur(8px)",
                              }}
                            >
                              {item.icon}
                              <span className="text-xs font-black">{item.label}</span>
                            </motion.div>
                          </Link>
                        ))}
                      </div>
            
                      </>
                      )}
            </>
          )}
        </motion.div>

        {/* Mini Leaderboard */}
        {top3.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="w-full"
          >
            <Link href="/ranking">
              <div
                className="w-full rounded-2xl px-4 py-3 cursor-pointer hover:opacity-90 transition-opacity"
                style={{ background: "rgba(0,0,0,0.25)", border: "2px solid rgba(255,255,255,0.1)", backdropFilter: "blur(8px)" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-[#f9a825]" />
                    <span className="text-xs font-black text-[#f9a825] uppercase tracking-wide">{t.home.ranking}</span>
                  </div>
                  <span className="text-xs text-white/40">Ver todo →</span>
                </div>
                <div className="space-y-1.5">
                  {top3.map((p: any, i: number) => {
                    const medals = ["🥇", "🥈", "🥉"];
                    const isMe = p.playerId === player?.id;
                    return (
                      <div key={p.playerId} className="flex items-center gap-2">
                        <span className="text-base w-6 text-center">{medals[i]}</span>
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                          style={{ background: p.avatarColor || "#b5301a" }}
                        >
                          {p.picture
                            ? <img src={p.picture} alt="" className="w-6 h-6 rounded-full object-cover" />
                            : (p.playerName?.[0] || "?").toUpperCase()
                          }
                        </div>
                        <span className={`text-sm font-bold flex-1 truncate ${isMe ? "text-[#f9a825]" : "text-white"}`}>
                          {isMe ? "⭐ " : ""}{p.playerName}
                        </span>
                        <span className="text-xs font-black text-white/60">{p.totalScore?.toLocaleString()} pts</span>
                      </div>