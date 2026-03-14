import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui";
import { useGetLeaderboard } from "@workspace/api-client-react";
import { Trophy, Users } from "lucide-react";
import { usePlayer } from "@/hooks/use-player";
import { motion } from "framer-motion";
import { useT } from "@/i18n/useT";

export default function Ranking() {
  const { data, isLoading } = useGetLeaderboard({ limit: 100 }, {
    query: { refetchOnMount: "always", staleTime: 0 }
  });
  const { player } = usePlayer();
  const { t } = useT();
  const [filter, setFilter] = useState<"global" | "friends">("global");
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!player?.id) return;
    fetch(`${window.location.origin}/api/friends/list/${encodeURIComponent(player.id)}`)
      .then(r => r.ok ? r.json() : { friends: [] })
      .then(({ friends }: { friends: Array<{ followedId: string }> }) => {
        setFollowedIds(new Set(friends.map(f => f.followedId)));
      })
      .catch(() => {});
  }, [player?.id]);

  const allPlayers = data?.players || [];

  const players = filter === "friends"
    ? allPlayers.filter((p: any) => followedIds.has(p.playerId) || p.playerId === player?.id)
    : allPlayers;

  const top3 = players.slice(0, 3);
  const rest = players.slice(3);
  const myEntry = allPlayers.find((p: any) => p.playerId === player?.id);
  const myRank = myEntry ? allPlayers.indexOf(myEntry) + 1 : null;

  const PODIUM_ORDER = [1, 0, 2];

  const medalColors: Record<number, { bg: string; border: string; size: string; label: string }> = {
    0: { bg: "linear-gradient(135deg, #f9a825, #f57f17)", border: "#f9a825", size: "w-20 h-20 text-3xl", label: "🥇" },
    1: { bg: "linear-gradient(135deg, #9e9e9e, #757575)", border: "#9e9e9e",  size: "w-16 h-16 text-2xl", label: "🥈" },
    2: { bg: "linear-gradient(135deg, #a0522d, #795548)", border: "#a0522d", size: "w-14 h-14 text-xl", label: "🥉" },
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full py-8 space-y-6">

        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-display font-black text-white flex items-center justify-center gap-4">
            <Trophy className="w-10 h-10 text-secondary" />
            {t.ranking.title}
            <Trophy className="w-10 h-10 text-secondary" />
          </h1>
        </div>

        <div className="flex justify-center">
          <div className="bg-black/30 p-1 rounded-full flex gap-1">
            {(["global", "friends"] as const).map(f => (
              <button
                key={f}
                className={`px-6 py-2 rounded-full font-bold transition-all capitalize flex items-center gap-2 ${filter === f ? "bg-secondary text-black shadow-md" : "text-white hover:bg-white/10"}`}
                onClick={() => setFilter(f)}
              >
                {f === "friends" && <Users className="w-4 h-4" />}
                {f === "global" ? "Global" : t.friends.offline}
              </button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-16 bg-white/10 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : players.length === 0 ? (
          <div className="p-16 text-center text-white/50 font-bold bg-black/20 rounded-2xl border border-white/10">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>
              {filter === "friends"
                ? (t.ranking.noFriendsRanking ?? "Ningún amigo aparece en el ranking aún.")
                : t.ranking.noRanking}
            </p>
            {filter === "friends" && followedIds.size === 0 && (
              <p className="text-sm mt-2 text-white/30">{t.friends.noFriends}</p>
            )}
          </div>
        ) : (
          <>
            {top3.length > 0 && (
              <div className="flex items-end justify-center gap-4 py-4">
                {PODIUM_ORDER.map(visualIdx => {
                  const p = top3[visualIdx];
                  if (!p) return <div key={visualIdx} className="w-24" />;
                  const m = medalColors[visualIdx];
                  const isMe = p.playerId === player?.id;
                  const podiumHeights = ["h-28", "h-20", "h-16"];
                  return (
                    <motion.div
                      key={p.playerId}
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: visualIdx * 0.15, type: "spring", bounce: 0.4 }}
                      className="flex flex-col items-center gap-2"
                    >
                      <span className="text-2xl">{m.label}</span>
                      <motion.div
                        animate={visualIdx === 0 ? { y: [0, -4, 0] } : {}}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className={`${m.size} rounded-full flex items-center justify-center font-black text-white shadow-xl border-4 relative`}
                        style={{ background: p.avatarColor || "#555", borderColor: m.border }}
                      >
                        {p.playerName.charAt(0).toUpperCase()}
                        {isMe && (
                          <span className="absolute -top-2 -right-2 bg-secondary text-black text-[9px] font-black px-1.5 py-0.5 rounded-full">{t.game.you.toUpperCase()}</span>
                        )}
                      </motion.div>
                      <div className="text-center">
                        <p className="font-black text-sm truncate max-w-[80px]">{p.playerName}</p>
                        <p className="font-black text-secondary">{p.totalScore} {t.game.points}</p>
                      </div>
                      <div
                        className={`${podiumHeights[visualIdx]} w-24 rounded-t-xl flex items-end justify-center pb-2`}
                        style={{ background: `linear-gradient(to bottom, ${m.border}33, ${m.border}11)`, border: `1px solid ${m.border}44` }}
                      >
                        <span className="font-black text-2xl opacity-30">#{visualIdx + 1}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {myEntry && myRank && myRank > 3 && filter === "global" && (
              <Card className="p-3 bg-secondary/10 border border-secondary/30">
                <div className="flex items-center gap-3">
                  <span className="text-secondary font-black text-lg w-8 text-center">#{myRank}</span>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold shadow" style={{ backgroundColor: myEntry.avatarColor || "#555" }}>
                    {myEntry.playerName.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 font-black">{myEntry.playerName} <span className="text-secondary text-xs">({t.game.you})</span></span>
                  <span className="text-white/60 text-sm">{myEntry.gamesPlayed}</span>
                  <span className="text-secondary font-black text-lg">{myEntry.totalScore} {t.game.points}</span>
                </div>
              </Card>
            )}

            {rest.length > 0 && (
              <Card className="p-2 bg-black/20 border-white/10 shadow-xl">
                <div className="grid grid-cols-[40px_1fr_80px_80px] gap-2 px-3 py-2 text-xs font-bold text-white/40 uppercase tracking-wider">
                  <div className="text-center">#</div>
                  <div>{t.ranking.player}</div>
                  <div className="text-center">{t.ranking.games}</div>
                  <div className="text-right">{t.ranking.score}</div>
                </div>
                <div className="flex flex-col gap-1">
                  {rest.map((p: any, idx: number) => {
                    const position = filter === "global" ? idx + 4 : players.indexOf(p) + 1;
                    const isMe = p.playerId === player?.id;
                    return (
                      <motion.div
                        key={p.playerId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className={`grid grid-cols-[40px_1fr_80px_80px] gap-2 px-3 py-2.5 items-center rounded-xl ${
                          isMe
                            ? "bg-secondary text-black font-black shadow-md shadow-secondary/20"
                            : "bg-card/60 hover:bg-card border border-white/5 text-white font-bold"
                        }`}
                      >
                        <div className={`text-center font-bold ${isMe ? "text-black/60" : "text-white/30"}`}>
                          {position}
                        </div>
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div
                            className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-xs shadow"
                            style={{ backgroundColor: p.avatarColor || "#555" }}
                          >
                            {p.playerName.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate">{p.playerName} {isMe && `(${t.game.you})`}</span>
                        </div>
                        <div className={`text-center text-sm ${isMe ? "text-black/70" : "text-white/60"}`}>
                          {p.gamesPlayed}
                        </div>
                        <div className={`text-right font-black ${isMe ? "text-black" : "text-secondary"}`}>
                          {p.totalScore}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
