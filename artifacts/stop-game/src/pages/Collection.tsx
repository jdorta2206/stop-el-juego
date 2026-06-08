import { useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";
import { ArrowLeft, BookOpen, Search } from "lucide-react";
import { usePlayer } from "@/hooks/use-player";
import { useCollection } from "@/hooks/useCollection";
import { useRewards } from "@/hooks/useRewards";
import { celebrateReward } from "@/lib/celebrate";
import { rewardFrameName } from "@/lib/rewardFrames";
import { RARITY_ORDER, RARITY_META, type Rarity } from "@/lib/collection";
import { useT } from "@/i18n/useT";
import { Coins, Gift, Check } from "lucide-react";

type Filter = "all" | Rarity;

export default function Collection() {
  const { player } = usePlayer();
  const { collection } = useCollection(player?.id);
  const { collection: rewards, claimCollection } = useRewards(player?.id);
  const { t } = useT();
  const tC = (t as { collection?: Record<string, string> }).collection ?? {};

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [claiming, setClaiming] = useState<string | null>(null);

  const handleClaimSet = async (setId: string) => {
    setClaiming(setId);
    const r = await claimCollection(setId);
    setClaiming(null);
    if (r.error) { window.alert(r.error); return; }
    celebrateReward();
  };

  const all = useMemo(() => Object.values(collection), [collection]);
  const counts = useMemo(() => {
    const c: Record<Rarity, number> = { legendary: 0, epic: 0, rare: 0, common: 0 };
    for (const w of all) c[w.r]++;
    return c;
  }, [all]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = all.filter(w => filter === "all" || w.r === filter);
    const searched = q
      ? filtered.filter(w => w.name.toLowerCase().includes(q) || w.cat.toLowerCase().includes(q))
      : filtered;
    return searched.sort((a, b) => {
      const ro = RARITY_ORDER.indexOf(a.r) - RARITY_ORDER.indexOf(b.r);
      if (ro !== 0) return ro;
      return b.d - a.d;
    });
  }, [all, filter, query]);

  return (
    <Layout>
      <div className="w-full max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/">
            <button
              className="p-2 rounded-xl"
              style={{ background: "rgba(0,0,0,0.25)", border: "2px solid rgba(255,255,255,0.15)" }}
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#f9a825]" />
            <h1 className="text-2xl font-black text-white">
              {tC.title ?? "Mi Colección"}
            </h1>
          </div>
        </div>

        {/* Totals card */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4"
          style={{
            background: "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(220,38,38,0.12))",
            border: "2px solid rgba(245,158,11,0.45)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-white font-black text-3xl">{all.length}</span>
            <span className="text-white/60 text-xs uppercase tracking-wider font-black">
              {tC.wordsCollected ?? "palabras coleccionadas"}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {RARITY_ORDER.map(r => {
              const meta = RARITY_META[r];
              return (
                <div
                  key={r}
                  className="flex flex-col items-center py-2 rounded-xl"
                  style={{
                    background: "rgba(0,0,0,0.30)",
                    border: `1px solid ${meta.border}`,
                  }}
                >
                  <div className="text-lg">{meta.emoji}</div>
                  <div className="font-black text-white text-base">{counts[r]}</div>
                  <div className="text-[9px] uppercase font-black" style={{ color: meta.color }}>
                    {tC[`rarity_${r}`] ?? r}
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Recompensas de colección — completar sets da monedas + marcos exclusivos */}
        {rewards && rewards.sets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 space-y-2.5"
            style={{ background: "rgba(0,0,0,0.25)", border: "2px solid rgba(255,255,255,0.10)" }}
          >
            <div className="flex items-center gap-2">
              <Gift className="w-5 h-5 text-[#f9a825]" />
              <h2 className="text-lg font-black text-white">
                {tC.rewardsTitle ?? "Recompensas de Colección"}
              </h2>
            </div>
            <div className="space-y-1.5">
              {rewards.sets.map((s) => {
                const pct = Math.min(100, Math.round((s.progress / s.target) * 100));
                return (
                  <div
                    key={s.id}
                    className="flex items-center gap-3 p-2.5 rounded-xl"
                    style={{
                      background: "rgba(0,0,0,0.30)",
                      border: `1.5px solid ${s.complete && !s.claimed ? "rgba(249,168,37,0.45)" : "rgba(255,255,255,0.10)"}`,
                    }}
                  >
                    <span className="text-2xl w-8 text-center">{s.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white truncate">{s.label}</p>
                      <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
                        {s.reward.coins ? (
                          <span className="flex items-center gap-1"><Coins className="w-3 h-3" /> {s.reward.coins}</span>
                        ) : null}
                        {s.reward.frame && <span className="text-white/50">+ {rewardFrameName(s.reward.frame)}</span>}
                      </p>
                      <div className="mt-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#f9a825]" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-white/40 mt-0.5">{s.progress} / {s.target}</p>
                      {s.wordsComplete && !s.complete && s.minGames > 0 && (
                        <p className="text-[10px] text-amber-400/80 mt-0.5">
                          🎮 Juega {Math.max(0, s.minGames - s.gamesPlayed)} partida{Math.max(0, s.minGames - s.gamesPlayed) === 1 ? "" : "s"} más para reclamar
                        </p>
                      )}
                    </div>
                    {s.claimed ? (
                      <span className="text-[10px] font-black text-emerald-400 uppercase flex items-center gap-1">
                        <Check className="w-3 h-3" /> Listo
                      </span>
                    ) : s.complete ? (
                      <button
                        onClick={() => handleClaimSet(s.id)}
                        disabled={claiming === s.id}
                        className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all disabled:opacity-40"
                        style={{ background: "rgba(249,168,37,0.2)", border: "1px solid rgba(249,168,37,0.5)", color: "#f9a825" }}
                      >
                        {claiming === s.id ? "…" : "Reclamar"}
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-white/30 uppercase">{pct}%</span>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Filters */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
          {(["all", ...RARITY_ORDER] as Filter[]).map(f => {
            const active = filter === f;
            const meta = f === "all" ? null : RARITY_META[f];
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className="px-3 py-1.5 rounded-full text-xs font-black uppercase tracking-wider whitespace-nowrap"
                style={{
                  background: active
                    ? (meta ? meta.border : "rgba(245,158,11,0.55)")
                    : "rgba(0,0,0,0.30)",
                  border: active
                    ? `2px solid ${meta ? meta.color : "#f9a825"}`
                    : "2px solid rgba(255,255,255,0.10)",
                  color: active ? "#fff" : "rgba(255,255,255,0.65)",
                }}
              >
                {f === "all" ? (tC.all ?? "Todas") : (tC[`rarity_${f}`] ?? f)}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/50" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={tC.searchPlaceholder ?? "Buscar palabra o categoría..."}
            className="w-full pl-9 pr-3 py-2 rounded-xl text-sm text-white placeholder-white/40 outline-none"
            style={{
              background: "rgba(0,0,0,0.30)",
              border: "2px solid rgba(255,255,255,0.10)",
            }}
          />
        </div>

        {/* Empty state */}
        {visible.length === 0 && (
          <div
            className="rounded-2xl p-8 text-center"
            style={{
              background: "rgba(0,0,0,0.25)",
              border: "2px dashed rgba(255,255,255,0.15)",
            }}
          >
            <div className="text-4xl mb-2">📚</div>
            <p className="text-white font-black mb-1">
              {all.length === 0
                ? (tC.emptyTitle ?? "Aún no has coleccionado palabras")
                : (tC.noMatches ?? "Sin resultados")}
            </p>
            <p className="text-white/60 text-sm">
              {all.length === 0
                ? (tC.emptyHint ?? "Juega una partida y empieza tu colección.")
                : (tC.tryAnother ?? "Prueba otro filtro o búsqueda.")}
            </p>
          </div>
        )}

        {/* Grid */}
        {visible.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {visible.map((w, idx) => {
              const meta = RARITY_META[w.r];
              return (
                <motion.div
                  key={`${w.name}-${idx}`}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(idx * 0.015, 0.4) }}
                  className="rounded-xl p-2.5 flex flex-col items-center text-center"
                  style={{
                    background: "rgba(0,0,0,0.30)",
                    border: `2px solid ${meta.border}`,
                    boxShadow: meta.glow,
                    backdropFilter: "blur(6px)",
                  }}
                >
                  <div className="text-xl mb-0.5">{meta.emoji}</div>
                  <p className="text-white font-black text-sm leading-tight truncate w-full">
                    {w.name}
                  </p>
                  <p className="text-white/55 text-[10px] truncate w-full">{w.cat}</p>
                  <div
                    className="mt-1 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-wider"
                    style={{
                      background: "rgba(0,0,0,0.35)",
                      color: meta.color,
                    }}
                  >
                    {tC[`rarity_${w.r}`] ?? w.r}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
