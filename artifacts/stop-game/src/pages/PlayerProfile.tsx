import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui";
import {
  Trophy, Flame, Gamepad2, Users, Star, ArrowLeft,
  UserPlus, UserCheck, Clock, Sword, Crown, Coins, ShoppingBag, Check,
} from "lucide-react";
import { motion } from "framer-motion";
import { usePlayer } from "@/hooks/use-player";
import { getApiUrl } from "@/lib/utils";
import { useFollows } from "@/lib/useFollows";
import { useCallback, useState } from "react";
import { type OnlinePlayer } from "@/lib/usePresence";
import { useInventory, type ShopItem } from "@/hooks/useInventory";

// ── Level system based on total games played ───────────────────────────────
// Tiers 1-6 are fixed. Beyond 200 games the ladder becomes INFINITE: players
// enter "Leyenda" and climb prestige tiers (Leyenda I, II, III…) forever, each
// with an escalating color + aura. This is the long-term retention loop — there
// is always a next tier to chase. Derived purely from gamesPlayed, so it needs
// no DB column and shows on every profile automatically.
interface LevelInfo {
  label: string;
  icon: string;
  color: string;
  min: number;
  max: number;
  prestige: number;   // 0 = fixed tier; >=1 = Leyenda tier number
  aura?: string;      // CSS class for the prestige glow
}

const LEVELS = [
  { min: 0,   max: 4,   label: "Principiante", icon: "🌱", color: "#6b7280" },
  { min: 5,   max: 14,  label: "Amateur",       icon: "🎮", color: "#3b82f6" },
  { min: 15,  max: 29,  label: "Aficionado",    icon: "⚔️", color: "#8b5cf6" },
  { min: 30,  max: 49,  label: "Veterano",      icon: "🛡️", color: "#f59e0b" },
  { min: 50,  max: 99,  label: "Experto",       icon: "🔥", color: "#ef4444" },
  { min: 100, max: 199, label: "Maestro",       icon: "⭐", color: "#f97316" },
];

const PRESTIGE_MIN = 200;   // games to reach Leyenda I
const PRESTIGE_STEP = 100;  // games per additional prestige tier
const PRESTIGE_COLORS = ["#eab308", "#f59e0b", "#ef4444", "#ec4899", "#a855f7", "#6366f1", "#0ea5e9", "#22d3ee"];
const PRESTIGE_AURA = ["prestige-aura-1", "prestige-aura-2", "prestige-aura-3", "prestige-aura-4", "prestige-aura-5"];

function toRoman(n: number): string {
  const map: [number, string][] = [
    [1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"],
    [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"],
  ];
  let out = "", x = Math.max(1, n);
  for (const [v, sym] of map) while (x >= v) { out += sym; x -= v; }
  return out;
}

function prestigeLevel(tier: number): LevelInfo {
  const idx = tier - 1;
  const min = PRESTIGE_MIN + idx * PRESTIGE_STEP;
  return {
    label: `Leyenda ${toRoman(tier)}`,
    icon: "👑",
    color: PRESTIGE_COLORS[Math.min(idx, PRESTIGE_COLORS.length - 1)],
    aura: PRESTIGE_AURA[Math.min(idx, PRESTIGE_AURA.length - 1)],
    min,
    max: min + PRESTIGE_STEP - 1,
    prestige: tier,
  };
}

function getLevel(gamesPlayed: number): LevelInfo {
  if (gamesPlayed >= PRESTIGE_MIN) {
    return prestigeLevel(Math.floor((gamesPlayed - PRESTIGE_MIN) / PRESTIGE_STEP) + 1);
  }
  const l = LEVELS.find(l => gamesPlayed >= l.min && gamesPlayed <= l.max) ?? LEVELS[0];
  return { ...l, prestige: 0 };
}

function getNextLevel(gamesPlayed: number): LevelInfo | null {
  if (gamesPlayed >= PRESTIGE_MIN) {
    return prestigeLevel(Math.floor((gamesPlayed - PRESTIGE_MIN) / PRESTIGE_STEP) + 2);
  }
  const idx = LEVELS.findIndex(l => gamesPlayed >= l.min && gamesPlayed <= l.max);
  if (idx >= 0 && idx < LEVELS.length - 1) return { ...LEVELS[idx + 1], prestige: 0 };
  return prestigeLevel(1); // next after Maestro is Leyenda I
}

function getLevelProgress(gamesPlayed: number): number {
  const lvl = getLevel(gamesPlayed);
  const span = lvl.max - lvl.min + 1;
  if (!isFinite(span) || span <= 0) return 100;
  return Math.min(100, Math.round(((gamesPlayed - lvl.min) / span) * 100));
}

// ── Mode labels ────────────────────────────────────────────────────────────
const MODE_LABELS: Record<string, { label: string; icon: string }> = {
  solo:        { label: "Solo",        icon: "🎯" },
  multiplayer: { label: "Multijugador",icon: "👥" },
  daily:       { label: "Diario",      icon: "📅" },
  blitz:       { label: "Blitz",       icon: "⚡" },
  challenge:   { label: "Reto",        icon: "🏆" },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function CosmeticChip({
  glyph, label, equipped, busy, color, glowing, onClick,
}: {
  glyph: string;
  label: string;
  equipped: boolean;
  busy: boolean;
  color?: string;
  glowing?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy || equipped}
      title={label}
      className="relative flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-all disabled:opacity-90"
      style={{
        background: equipped ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.05)",
        border: equipped ? "1.5px solid rgba(34,197,94,0.5)" : "1.5px solid rgba(255,255,255,0.1)",
        minWidth: 56,
      }}
    >
      <span className={`text-xl leading-none ${glowing ? "legendary-glyph" : ""}`} style={{ color }}>{glyph}</span>
      <span className="text-[9px] font-bold text-white/70 leading-tight text-center max-w-[60px] truncate">{label}</span>
      {equipped && (
        <span className="absolute -top-1 -right-1 bg-emerald-500 rounded-full p-0.5">
          <Check className="w-2.5 h-2.5 text-white" />
        </span>
      )}
    </button>
  );
}

// Frame metadata mirror of the server catalog — used to render the equipped
// frame ring around any player's avatar (own profile or others'). Keep in
// sync with `inventoryCatalog.ts` on the server.
const FRAME_COLORS_BY_ID: Record<string, string> = {
  frame_free_5:  "#cd7f32",
  frame_free_10: "#c0c0c0",
  frame_free_15: "#f9a825",
  frame_free_20: "#67e8f9",
  frame_free_25: "#a78bfa",
  frame_free_30: "#f472b6",
  frame_shop_neon: "#22d3ee",
  // Marcos legendarios (animados) — color base del aro; el efecto va por CSS.
  frame_shop_fuego:   "#fb923c",
  frame_shop_rayo:    "#38bdf8",
  frame_shop_lava:    "#ef4444",
  frame_shop_galaxia: "#a855f7",
};

// Marcos legendarios → clase CSS de animación aplicada al aro del avatar.
// Mantener en sync con SHOP_ITEMS (servidor) e index.css (keyframes).
const LEGENDARY_FRAME_FX: Record<string, string> = {
  frame_shop_fuego:   "frame-fx-fuego",
  frame_shop_rayo:    "frame-fx-rayo",
  frame_shop_lava:    "frame-fx-lava",
  frame_shop_galaxia: "frame-fx-galaxia",
};
function isLegendaryFrame(id?: string | null): boolean {
  return !!id && id in LEGENDARY_FRAME_FX;
}
// Title metadata mirror of the server catalog (titleCatalog.ts) — used to render
// the equipped title pill on ANY profile (own or others'), since the profile
// payload only carries the title id. Keep id → { label, icon, color } in sync.
const TITLE_META_BY_ID: Record<string, { label: string; icon: string; color: string }> = {
  novato:        { label: "Novato",        icon: "🌱", color: "#9ca3af" },
  jugador:       { label: "Jugador",       icon: "🎮", color: "#3b82f6" },
  veterano:      { label: "Veterano",      icon: "🛡️", color: "#f59e0b" },
  en_racha:      { label: "En Racha",      icon: "🔥", color: "#f97316" },
  imparable:     { label: "El Imparable",  icon: "⚡", color: "#eab308" },
  ganador:       { label: "Ganador",       icon: "🏅", color: "#22c55e" },
  invencible:    { label: "Invencible",    icon: "⚔️", color: "#ef4444" },
  erudito:       { label: "Erudito",       icon: "📚", color: "#06b6d4" },
  sabio:         { label: "Sabio",         icon: "🧠", color: "#a855f7" },
  millonario:    { label: "Millonario",    icon: "💰", color: "#fbbf24" },
  coleccionista: { label: "Coleccionista", icon: "🏆", color: "#f472b6" },
  leyenda_viva:  { label: "Leyenda Viva",  icon: "👑", color: "#fde047" },
};
const AVATAR_GLYPH_BY_ID: Record<string, string> = {
  avatar_premium_5:  "🎯",
  avatar_premium_10: "🔥",
  avatar_premium_15: "⚡",
  avatar_premium_20: "🌟",
  avatar_premium_25: "👑",
  avatar_premium_30: "💎",
  avatar_shop_rocket:  "🚀",
  avatar_shop_unicorn: "🦄",
  avatar_shop_alien:   "👽",
};

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-1 p-4 bg-black/30 rounded-2xl border border-white/10">
      <span className="text-2xl font-black text-secondary">{value}</span>
      <span className="text-xs font-bold text-white/50 text-center leading-tight">{label}</span>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return "ahora mismo";
  if (m < 60) return `hace ${m}m`;
  if (h < 24) return `hace ${h}h`;
  if (d < 7)  return `hace ${d}d`;
  return new Date(dateStr).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

// ── Component ──────────────────────────────────────────────────────────────
export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { player: me } = usePlayer();

  const { data, isLoading, isError } = useQuery({
    queryKey: [`/api/ranking/profile/${id}`],
    queryFn: () =>
      fetch(`${getApiUrl()}/api/ranking/profile/${encodeURIComponent(id!)}`)
        .then(r => { if (!r.ok) throw new Error("not found"); return r.json(); }),
    enabled: !!id,
    staleTime: 30_000,
  });

  const isMe = me?.id === id;
  const isLoggedIn = !!(me && me.loginMethod !== "guest");
  // Inventory only loads for the player's own profile — there's no public
  // endpoint, and other players' equipped cosmetics ship via the profile
  // payload below (see `data.equippedAvatar` / `data.equippedFrame`).
  const { inventory, equip, buy } = useInventory(isMe ? me?.id : null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const handleEquip = useCallback(async (kind: "avatar" | "frame" | "title", value: string | null) => {
    setBusyAction(`equip:${kind}:${value ?? ""}`);
    await equip(kind, value);
    setBusyAction(null);
  }, [equip]);

  const handleBuy = useCallback(async (item: ShopItem) => {
    setBusyAction(`buy:${item.id}`);
    const r = await buy(item.id);
    setBusyAction(null);
    if (r && "error" in r && r.error) {
      window.alert(r.error === "Insufficient coins" ? "No tienes suficientes monedas" : r.error);
    }
  }, [buy]);

  const { isFollowing, follow, unfollow } = useFollows(
    isLoggedIn ? me?.id ?? null : null,
    []
  );
  const [followState, setFollowState] = useState<"idle" | "loading">("idle");
  const alreadyFollowing = isFollowing(id ?? "");

  const handleFollow = useCallback(async () => {
    if (!data || !me || followState === "loading") return;
    setFollowState("loading");
    const asOnlinePlayer: OnlinePlayer = {
      playerId: data.playerId,
      name: data.playerName,
      picture: null,
      avatarColor: data.avatarColor || "#e53e3e",
      provider: null,
      roomCode: null,
      lastSeen: Date.now(),
    };
    if (alreadyFollowing) {
      await unfollow(data.playerId);
    } else {
      await follow(asOnlinePlayer);
    }
    setFollowState("idle");
  }, [data, me, alreadyFollowing, follow, unfollow, followState]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (isError || !data) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white/50">
          <Trophy className="w-16 h-16 opacity-20" />
          <p className="font-bold text-xl">Jugador no encontrado</p>
          <Button onClick={() => setLocation("/ranking")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver al ranking
          </Button>
        </div>
      </Layout>
    );
  }

  const modeKeys = Object.keys(data.modeStats ?? {});
  const recentGames: any[] = data.recentGames ?? [];
  const level = getLevel(data.gamesPlayed);
  const progress = getLevelProgress(data.gamesPlayed);
  const nextLevel = getNextLevel(data.gamesPlayed);

  return (
    <Layout>
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full py-6 gap-6 pb-10">

        {/* Back button */}
        <button
          onClick={() => setLocation("/ranking")}
          className="flex items-center gap-2 text-white/50 hover:text-white text-sm font-bold transition-colors self-start"
        >
          <ArrowLeft size={16} /> Ranking
        </button>

        {/* ── HERO: Avatar + nombre + título + rango ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="relative">
            {/* Equipped frame (if any) wins over the level-color border.
                On own profile we prefer the live inventory snapshot so
                an equip click reflects immediately without a profile
                refetch; on others' profiles we use the public payload. */}
            {(() => {
              const equippedFrame = isMe
                ? inventory?.equipped.frame ?? data.equippedFrame
                : data.equippedFrame;
              const equippedAvatar = isMe
                ? inventory?.equipped.avatar ?? data.equippedAvatar
                : data.equippedAvatar;
              const frameColor = equippedFrame ? FRAME_COLORS_BY_ID[equippedFrame] : null;
              const fxClass = equippedFrame ? LEGENDARY_FRAME_FX[equippedFrame] : null;
              return (
                <div
                  className={`w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-2xl border-4 ${fxClass ?? ""}`}
                  style={{
                    backgroundColor: data.avatarColor || "#e53e3e",
                    borderColor: frameColor ?? level.color + "88",
                    boxShadow: fxClass ? undefined : (frameColor ? `0 0 18px ${frameColor}66` : undefined),
                  }}
                >
                  {equippedAvatar && AVATAR_GLYPH_BY_ID[equippedAvatar]
                    ? AVATAR_GLYPH_BY_ID[equippedAvatar]
                    : data.playerName?.charAt(0).toUpperCase()}
                </div>
              );
            })()}
            <span
              className={`absolute -bottom-1 -right-1 text-xl ${level.aura ?? ""}`}
              title={level.label}
            >
              {level.icon}
            </span>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-display font-black">{data.playerName}</h1>
            {/* Equipped title (earned by playing). Falls back gracefully if the
                stored id isn't in the client mirror. */}
            {(() => {
              const titleId = isMe
                ? (inventory?.equipped.title ?? data.equippedTitle)
                : data.equippedTitle;
              const meta = titleId ? TITLE_META_BY_ID[titleId] : null;
              if (!meta) return null;
              return (
                <span
                  className="inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-xs font-black"
                  style={{ color: meta.color, background: meta.color + "1f", border: `1.5px solid ${meta.color}66` }}
                >
                  <span>{meta.icon}</span> {meta.label}
                </span>
              );
            })()}
            <p className="font-bold mt-0.5" style={{ color: "#f9a825" }}>{data.title}</p>
            <p className="text-white/40 text-sm mt-0.5">Puesto #{data.globalRank} global</p>
            {data.isPremium && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full"
                style={{ background: "linear-gradient(135deg, rgba(249,168,37,0.2), rgba(245,124,0,0.15))", border: "1.5px solid rgba(249,168,37,0.5)" }}
              >
                <Crown className="w-3.5 h-3.5 text-[#f9a825]" />
                <span className="text-xs font-black text-[#f9a825]">PREMIUM</span>
              </motion.div>
            )}
          </div>

          {/* Follow / "Tú" badge */}
          {isMe ? (
            <span className="px-4 py-1.5 rounded-full text-xs font-black bg-secondary/20 text-secondary border border-secondary/40">
              Tu perfil
            </span>
          ) : isLoggedIn && (
            <button
              onClick={handleFollow}
              disabled={followState === "loading"}
              className="flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm transition-all"
              style={
                alreadyFollowing
                  ? { background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80" }
                  : { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }
              }
            >
              {alreadyFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
              {alreadyFollowing ? "Siguiendo" : "Seguir"}
            </button>
          )}
        </motion.div>

        {/* ── NIVEL con barra de progreso ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-4 bg-black/30 rounded-2xl border border-white/10"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className={`text-2xl ${level.aura ?? ""}`}>{level.icon}</span>
              <div>
                <p className="font-black text-sm" style={{ color: level.color }}>Nivel: {level.label}</p>
                <p className="text-xs text-white/40">{data.gamesPlayed} partidas jugadas</p>
              </div>
            </div>
            {nextLevel && (
              <p className="text-[11px] text-white/30 text-right">
                Siguiente:<br />
                <span className="font-bold" style={{ color: nextLevel.color }}>{nextLevel.icon} {nextLevel.label}</span>
              </p>
            )}
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(to right, ${level.color}88, ${level.color})` }}
            />
          </div>
          {nextLevel && (
            <p className="text-[10px] text-white/30 mt-1 text-right">
              {nextLevel.min - data.gamesPlayed} partidas para {nextLevel.label}
            </p>
          )}
        </motion.div>

        {/* ── RACHA ── */}
        {(data.currentStreak > 0 || data.longestStreak > 0) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-around p-4 rounded-2xl border"
            style={{ background: "rgba(249,115,22,0.10)", borderColor: "rgba(249,115,22,0.25)" }}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-3xl font-black text-orange-400 flex items-center gap-1">
                <Flame className="w-6 h-6" />{data.currentStreak}
              </span>
              <span className="text-xs text-white/50 font-bold">Racha actual</span>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-3xl font-black text-orange-300">{data.longestStreak}</span>
              <span className="text-xs text-white/50 font-bold">Mejor racha</span>
            </div>
          </motion.div>
        )}

        {/* ── INVENTARIO Y MONEDAS (solo perfil propio) ── */}
        {isMe && inventory && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="space-y-3 p-4 rounded-2xl border border-white/10 bg-black/30"
          >
            <div className="flex items-center justify-between">
              <h2 className="font-display font-black text-lg flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-secondary" /> Mi inventario
              </h2>
              <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400/15 border border-amber-400/40">
                <Coins className="w-4 h-4 text-amber-400" />
                <span className="font-black text-amber-400 text-sm">{inventory.coins}</span>
              </span>
            </div>

            {/* Avatares poseídos */}
            <div>
              <p className="text-xs font-bold text-white/50 mb-1.5">Avatares</p>
              <div className="flex gap-2 flex-wrap">
                <CosmeticChip
                  glyph="—" label="Por defecto"
                  equipped={inventory.equipped.avatar === null}
                  busy={busyAction === "equip:avatar:"}
                  onClick={() => handleEquip("avatar", null)}
                />
                {inventory.owned.avatars.map((c) => (
                  <CosmeticChip
                    key={c.id} glyph={c.glyph} label={c.label}
                    equipped={inventory.equipped.avatar === c.id}
                    busy={busyAction === `equip:avatar:${c.id}`}
                    onClick={() => handleEquip("avatar", c.id)}
                  />
                ))}
                {inventory.owned.avatars.length === 0 && (
                  <p className="text-[11px] text-white/30 italic">Reclama niveles del Pase para conseguirlos.</p>
                )}
              </div>
            </div>

            {/* Marcos poseídos */}
            <div>
              <p className="text-xs font-bold text-white/50 mb-1.5">Marcos</p>
              <div className="flex gap-2 flex-wrap">
                <CosmeticChip
                  glyph="—" label="Sin marco"
                  equipped={inventory.equipped.frame === null}
                  busy={busyAction === "equip:frame:"}
                  onClick={() => handleEquip("frame", null)}
                />
                {inventory.owned.frames.map((c) => (
                  <CosmeticChip
                    key={c.id} glyph={c.glyph} label={c.label} color={c.color}
                    glowing={isLegendaryFrame(c.id)}
                    equipped={inventory.equipped.frame === c.id}
                    busy={busyAction === `equip:frame:${c.id}`}
                    onClick={() => handleEquip("frame", c.id)}
                  />
                ))}
                {inventory.owned.frames.length === 0 && (
                  <p className="text-[11px] text-white/30 italic">Reclama niveles del Pase para conseguirlos.</p>
                )}
              </div>
            </div>

            {/* Títulos — se ganan jugando, no se compran */}
            <div>
              <p className="text-xs font-bold text-white/50 mb-1.5">Títulos <span className="text-white/30 font-normal">(se ganan jugando)</span></p>
              <div className="flex gap-2 flex-wrap">
                <CosmeticChip
                  glyph="—" label="Sin título"
                  equipped={(inventory.equipped.title ?? null) === null}
                  busy={busyAction === "equip:title:"}
                  onClick={() => handleEquip("title", null)}
                />
                {(inventory.titles ?? []).filter((t) => t.unlocked).map((t) => (
                  <CosmeticChip
                    key={t.id} glyph={t.icon} label={t.label} color={t.color}
                    equipped={inventory.equipped.title === t.id}
                    busy={busyAction === `equip:title:${t.id}`}
                    onClick={() => handleEquip("title", t.id)}
                  />
                ))}
              </div>
              {(inventory.titles ?? []).some((t) => !t.unlocked) && (
                <>
                  <p className="text-[10px] font-bold text-white/30 mt-2 mb-1.5 uppercase">Por desbloquear</p>
                  <div className="flex gap-2 flex-wrap">
                    {(inventory.titles ?? []).filter((t) => !t.unlocked).map((t) => (
                      <div
                        key={t.id}
                        title={t.desc}
                        className="flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg opacity-40"
                        style={{ border: "1.5px dashed rgba(255,255,255,0.15)", minWidth: 56 }}
                      >
                        <span className="text-xl leading-none grayscale">🔒</span>
                        <span className="text-[9px] font-bold text-white/60 leading-tight text-center max-w-[60px] truncate">{t.label}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Tienda de monedas */}
            <div>
              <p className="text-xs font-bold text-white/50 mb-1.5 mt-1">Tienda</p>
              <div className="space-y-1.5">
                {inventory.shop.map((item) => {
                  const owned =
                    item.kind === "avatar"
                      ? inventory.owned.avatars.some((a) => a.id === item.id)
                      : inventory.owned.frames.some((f) => f.id === item.id);
                  const canAfford = inventory.coins >= item.price;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-2.5 rounded-xl bg-black/30 border border-white/10"
                    >
                      <span className={`text-2xl w-8 text-center ${isLegendaryFrame(item.id) ? "legendary-glyph" : ""}`} style={{ color: item.color }}>{item.glyph}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold truncate">{item.label}</p>
                        <p className="text-[11px] text-amber-400 flex items-center gap-1">
                          <Coins className="w-3 h-3" /> {item.price}
                        </p>
                      </div>
                      {owned ? (
                        <span className="text-[10px] font-black text-emerald-400 uppercase">Comprado</span>
                      ) : (
                        <button
                          onClick={() => handleBuy(item)}
                          disabled={!canAfford || busyAction === `buy:${item.id}`}
                          className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all disabled:opacity-40"
                          style={{
                            background: canAfford ? "rgba(249,168,37,0.2)" : "rgba(255,255,255,0.05)",
                            border: canAfford ? "1px solid rgba(249,168,37,0.5)" : "1px solid rgba(255,255,255,0.1)",
                            color: canAfford ? "#f9a825" : "rgba(255,255,255,0.4)",
                          }}
                        >
                          {busyAction === `buy:${item.id}` ? "…" : "Comprar"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── ESTADÍSTICAS GLOBALES ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-3 gap-3"
        >
          <StatCard label="Puntos totales" value={data.totalScore} />
          <StatCard label="Partidas" value={data.gamesPlayed} />
          <StatCard label="Victorias" value={data.wins} />
        </motion.div>

        {/* ── PUNTOS DEL MES ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3 p-4 rounded-2xl border border-white/10 bg-black/20"
        >
          <Star className="w-6 h-6 text-amber-400 flex-shrink-0" />
          <div>
            <p className="font-black text-white">
              {data.monthlyScore} pts{" "}
              <span className="text-amber-400">este mes</span>
            </p>
            <p className="text-xs text-white/40">Ranking mensual activo</p>
          </div>
        </motion.div>

        {/* ── STATS POR MODO ── */}
        {modeKeys.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="space-y-3"
          >
            <h2 className="font-display font-black text-lg flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-secondary" />
              Por modo de juego
            </h2>
            <div className="space-y-2">
              {modeKeys.map(mode => {
                const s = data.modeStats[mode];
                const meta = MODE_LABELS[mode] ?? { label: mode, icon: "🎮" };
                const winRate = s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0;
                return (
                  <div
                    key={mode}
                    className="flex items-center gap-4 p-3 bg-black/20 rounded-xl border border-white/10"
                  >
                    <span className="text-2xl">{meta.icon}</span>
                    <div className="flex-1">
                      <p className="font-bold text-sm">{meta.label}</p>
                      <p className="text-xs text-white/40">
                        {s.games} partidas · {s.wins} victorias ({winRate}%)
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-secondary">{s.totalScore} pts</p>
                      <p className="text-xs text-white/40">Mejor: {s.bestScore}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── HISTORIAL DE PARTIDAS ── */}
        {recentGames.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <h2 className="font-display font-black text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-secondary" />
              Últimas partidas
            </h2>
            <div className="space-y-1.5">
              {recentGames.map((g, i) => {
                const meta = MODE_LABELS[g.mode] ?? { label: g.mode, icon: "🎮" };
                return (
                  <motion.div
                    key={g.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.04 }}
                    className="flex items-center gap-3 px-4 py-2.5 bg-black/20 rounded-xl border border-white/10"
                  >
                    <span className="text-lg">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{meta.label}</span>
                        {g.letter && (
                          <span className="text-[11px] bg-white/10 px-1.5 py-0.5 rounded font-black text-white/60">
                            {g.letter}
                          </span>
                        )}
                        {g.won && (
                          <span className="text-[10px] bg-secondary/20 text-secondary border border-secondary/30 px-1.5 py-0.5 rounded-full font-black">
                            GANÓ
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/30">{timeAgo(g.createdAt)}</p>
                    </div>
                    <span className="font-black text-secondary text-sm flex-shrink-0">
                      +{g.score} pts
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── ACCIÓN FINAL ── */}
        {!isMe && (
          <Button
            variant="secondary"
            size="lg"
            className="w-full mt-2"
            onClick={() => setLocation("/multiplayer")}
          >
            <Sword className="w-4 h-4 mr-2" />
            Retar a una partida
          </Button>
        )}
        {isMe && (
          <Button
            size="lg"
            className="w-full mt-2"
            onClick={() => setLocation("/")}
          >
            Jugar ahora
          </Button>
        )}

      </div>
    </Layout>
  );
}
