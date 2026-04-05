import { useState, useRef } from "react";
import { Layout } from "@/components/Layout";
import { usePlayer } from "@/hooks/use-player";
import { useFollows, type FollowedFriend } from "@/lib/useFollows";
import { usePresence, sendChallenge, pollChallengeStatus, type OnlinePlayer } from "@/lib/usePresence";
import { ChallengeNotification } from "@/components/ChallengeNotification";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Users, Wifi, UserPlus, UserMinus, Swords, Copy, Check, Clock,
  Share2, MessageSquare, Send, Link2, UserCheck, Search, X
} from "lucide-react";
import type { PlayerProfile } from "@/hooks/use-player";

const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=app.replit.stop_el_juego.twa";

function ProviderDot({ provider }: { provider: string | null }) {
  if (!provider) return null;
  const map: Record<string, { bg: string; label: string }> = {
    facebook:  { bg: "#1877F2", label: "f" },
    google:    { bg: "#DB4437", label: "G" },
    instagram: { bg: "#E1306C", label: "ig" },
    tiktok:    { bg: "#010101", label: "tt" },
  };
  const info = map[provider];
  if (!info) return null;
  return (
    <span
      className="inline-flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-black text-white flex-shrink-0"
      style={{ background: info.bg }}
    >
      {info.label}
    </span>
  );
}

function Avatar({ picture, name, avatarColor, size = 44 }: {
  picture?: string | null; name: string; avatarColor?: string; size?: number;
}) {
  const [err, setErr] = useState(false);
  if (picture && !err) {
    return (
      <img src={picture} alt={name} onError={() => setErr(true)}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div className="rounded-full flex items-center justify-center font-black text-white flex-shrink-0"
      style={{ width: size, height: size, background: avatarColor || "#e53e3e", fontSize: size * 0.4 }}
    >
      {name[0]?.toUpperCase() || "?"}
    </div>
  );
}

type ChallengeState = "idle" | "sending" | "waiting";

function ChallengeBtn({ onChallenge }: { onChallenge: () => Promise<void> }) {
  const [state, setState] = useState<ChallengeState>("idle");
  const handle = async () => {
    if (state !== "idle") return;
    setState("sending");
    await onChallenge();
    setState("waiting");
  };
  if (state === "idle") return (
    <button onClick={handle}
      className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
      style={{ background: "rgba(249,168,37,0.12)", border: "1px solid rgba(249,168,37,0.3)", color: "#f9a825" }}
    >
      <Swords size={12} /> Retar
    </button>
  );
  if (state === "sending") return (
    <span className="flex items-center gap-1 px-3 py-1.5 text-xs text-white/40">
      <div className="w-3 h-3 border border-white/30 border-t-white/70 rounded-full animate-spin" />
      Enviando…
    </span>
  );
  return (
    <span className="flex items-center gap-1 px-3 py-1.5 text-xs text-yellow-400/80">
      <Clock size={12} /> Esperando…
    </span>
  );
}

function FriendCard({
  friend,
  currentPlayer,
  onUnfollow,
}: {
  friend: FollowedFriend;
  currentPlayer: PlayerProfile;
  onUnfollow: () => void;
}) {
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);
  const [showUnfollow, setShowUnfollow] = useState(false);
  const pendingId = useRef<string | null>(null);

  const handleJoin = () => {
    if (friend.onlineData?.roomCode) {
      navigator.clipboard.writeText(friend.onlineData.roomCode).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleChallenge = async () => {
    if (!friend.onlineData) return;
    const result = await sendChallenge(currentPlayer, friend.onlineData.playerId);
    if (!result) return;
    pendingId.current = result.challengeId;
    const poll = setInterval(async () => {
      if (!pendingId.current) { clearInterval(poll); return; }
      const status = await pollChallengeStatus(pendingId.current);
      if (status.status === "accepted") {
        clearInterval(poll); pendingId.current = null;
        setLocation(`/room/${status.roomCode}`);
      } else if (status.status === "declined" || status.status === "expired") {
        clearInterval(poll); pendingId.current = null;
      }
    }, 2000);
    setTimeout(() => { clearInterval(poll); pendingId.current = null; }, 60000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-2xl transition-colors"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="relative flex-shrink-0">
        <Avatar picture={friend.followedPicture} name={friend.followedName} avatarColor={friend.followedAvatarColor} size={44} />
        <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0d1757] ${
          friend.isOnline ? "bg-green-400 shadow-[0_0_6px_#4ade80]" : "bg-gray-600"
        }`} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-white font-bold text-sm truncate">{friend.followedName}</span>
          <ProviderDot provider={friend.followedProvider} />
        </div>
        <p className={`text-xs font-medium ${
          friend.isOnline
            ? friend.onlineData?.roomCode
              ? "text-green-400/80"
              : "text-green-400/60"
            : "text-white/30"
        }`}>
          {friend.isOnline
            ? friend.onlineData?.roomCode
              ? `En sala: ${friend.onlineData.roomCode}`
              : "Conectado · En el menú"
            : "Desconectado"
          }
        </p>
      </div>

      <div className="flex items-center gap-1.5 flex-shrink-0">
        {friend.isOnline && friend.onlineData && (
          friend.onlineData.roomCode ? (
            <button onClick={handleJoin}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{
                background: copied ? "rgba(74,222,128,0.2)" : "rgba(249,168,37,0.12)",
                border: copied ? "1px solid rgba(74,222,128,0.4)" : "1px solid rgba(249,168,37,0.3)",
                color: copied ? "#4ade80" : "#f9a825",
              }}
            >
              {copied ? <><Check size={12} />Copiado</> : <><Copy size={12} />Unirse</>}
            </button>
          ) : (
            <ChallengeBtn onChallenge={handleChallenge} />
          )
        )}
        <button
          onClick={() => setShowUnfollow(v => !v)}
          className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
          style={{ color: showUnfollow ? "#f87171" : "rgba(255,255,255,0.3)" }}
          title="Dejar de seguir"
        >
          {showUnfollow ? <UserMinus size={14} /> : <UserCheck size={14} />}
        </button>
      </div>

      <AnimatePresence>
        {showUnfollow && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="w-full mt-2 pt-2 border-t border-white/10 flex items-center justify-between"
            style={{ overflow: "hidden" }}
          >
            <span className="text-xs text-white/50">¿Dejar de seguir a {friend.followedName}?</span>
            <div className="flex gap-2">
              <button onClick={() => setShowUnfollow(false)}
                className="px-3 py-1 text-xs rounded-lg text-white/50 hover:text-white transition-colors">
                Cancelar
              </button>
              <button onClick={() => { onUnfollow(); setShowUnfollow(false); }}
                className="px-3 py-1 text-xs rounded-lg font-bold transition-colors"
                style={{ background: "rgba(248,113,113,0.2)", color: "#f87171", border: "1px solid rgba(248,113,113,0.3)" }}>
                Eliminar
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function OnlinePlayerCard({
  player,
  currentPlayer,
  isFollowing,
  onFollow,
  onUnfollow,
}: {
  player: OnlinePlayer;
  currentPlayer: PlayerProfile;
  isFollowing: boolean;
  onFollow: () => void;
  onUnfollow: () => void;
}) {
  const [, setLocation] = useLocation();
  const [copied, setCopied] = useState(false);
  const pendingId = useRef<string | null>(null);

  const handleJoin = () => {
    if (player.roomCode) {
      navigator.clipboard.writeText(player.roomCode).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  const handleChallenge = async () => {
    const result = await sendChallenge(currentPlayer, player.playerId);
    if (!result) return;
    pendingId.current = result.challengeId;
    const poll = setInterval(async () => {
      if (!pendingId.current) { clearInterval(poll); return; }
      const status = await pollChallengeStatus(pendingId.current);
      if (status.status === "accepted") {
        clearInterval(poll); pendingId.current = null;
        setLocation(`/room/${status.roomCode}`);
      } else if (status.status === "declined" || status.status === "expired") {
        clearInterval(poll); pendingId.current = null;
      }
    }, 2000);
    setTimeout(() => { clearInterval(poll); pendingId.current = null; }, 60000);
  };

  const isMe = player.playerId === currentPlayer.id;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 p-3 rounded-2xl"
      style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <div className="relative flex-shrink-0">
        <Avatar picture={player.picture} name={player.name} avatarColor={player.avatarColor} size={44} />
        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0d1757] bg-green-400 shadow-[0_0_6px_#4ade80]" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-white font-bold text-sm truncate">{player.name}</span>
          {isMe && <span className="text-[10px] text-white/40 font-bold">(tú)</span>}
          <ProviderDot provider={player.provider} />
        </div>
        <p className="text-xs text-green-400/60">
          {player.roomCode ? `En sala: ${player.roomCode}` : "En el menú"}
        </p>
      </div>
      {!isMe && (
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            onClick={isFollowing ? onUnfollow : onFollow}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all"
            style={isFollowing
              ? { background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80" }
              : { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }
            }
          >
            {isFollowing ? <><UserCheck size={11} />Amigo</> : <><UserPlus size={11} />Añadir</>}
          </button>
          {player.roomCode ? (
            <button onClick={handleJoin}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all"
              style={{
                background: copied ? "rgba(74,222,128,0.2)" : "rgba(249,168,37,0.12)",
                border: copied ? "1px solid rgba(74,222,128,0.4)" : "1px solid rgba(249,168,37,0.3)",
                color: copied ? "#4ade80" : "#f9a825",
              }}
            >
              {copied ? <><Check size={11} />Copiado</> : <><Copy size={11} />Unirse</>}
            </button>
          ) : (
            <ChallengeBtn onChallenge={handleChallenge} />
          )}
        </div>
      )}
    </motion.div>
  );
}

function InviteSection({ player }: { player: PlayerProfile }) {
  const [copied, setCopied] = useState(false);
  const shareMsg = `¡Hola! ${player.name} te invita a jugar a STOP 🎮 El clásico juego de palabras. ¡Descárgalo gratis!\n${PLAY_STORE_URL}`;

  const copyLink = () => {
    navigator.clipboard.writeText(PLAY_STORE_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMsg)}`, "_blank");
  };

  const shareTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(PLAY_STORE_URL)}&text=${encodeURIComponent(`¡${player.name} te invita a jugar a STOP! 🎮`)}`, "_blank");
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "STOP El Juego", text: shareMsg, url: PLAY_STORE_URL });
      } catch { /* cancelled */ }
    } else {
      copyLink();
    }
  };

  return (
    <div className="rounded-2xl p-4 space-y-4"
      style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      <div className="flex items-center gap-2">
        <UserPlus className="w-4 h-4 text-yellow-400" />
        <h3 className="text-white font-bold text-sm">Invitar amigos</h3>
      </div>
      <p className="text-white/50 text-xs leading-relaxed">
        Comparte el juego con tus amigos y juega juntos. Disponible gratis en la Play Store.
      </p>

      {/* Play Store badge */}
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-3 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
        style={{ background: "rgba(74,222,128,0.08)", border: "1px solid rgba(74,222,128,0.2)" }}
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: "linear-gradient(135deg, #4ade80 0%, #16a34a 100%)" }}
        >
          <span className="text-white font-black text-lg">▶</span>
        </div>
        <div className="flex-1">
          <p className="text-white font-bold text-sm">Google Play Store</p>
          <p className="text-green-400/70 text-xs">Descargar gratis</p>
        </div>
        <Link2 size={14} className="text-white/30" />
      </a>

      {/* Share buttons */}
      <div className="grid grid-cols-3 gap-2">
        <button onClick={shareWhatsApp}
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all hover:scale-[1.03] active:scale-[0.97]"
          style={{ background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.25)" }}
        >
          <MessageSquare size={18} style={{ color: "#25d366" }} />
          <span className="text-[11px] font-bold" style={{ color: "#25d366" }}>WhatsApp</span>
        </button>

        <button onClick={shareTelegram}
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all hover:scale-[1.03] active:scale-[0.97]"
          style={{ background: "rgba(0,136,204,0.12)", border: "1px solid rgba(0,136,204,0.25)" }}
        >
          <Send size={18} style={{ color: "#0088cc" }} />
          <span className="text-[11px] font-bold" style={{ color: "#0088cc" }}>Telegram</span>
        </button>

        <button onClick={shareNative}
          className="flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all hover:scale-[1.03] active:scale-[0.97]"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.15)" }}
        >
          <Share2 size={18} className="text-white/70" />
          <span className="text-[11px] font-bold text-white/70">Más</span>
        </button>
      </div>

      {/* Copy link */}
      <button onClick={copyLink}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all"
        style={{
          background: copied ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.05)",
          border: copied ? "1px solid rgba(74,222,128,0.3)" : "1px solid rgba(255,255,255,0.1)",
          color: copied ? "#4ade80" : "rgba(255,255,255,0.5)",
        }}
      >
        {copied ? <><Check size={13} /> ¡Enlace copiado!</> : <><Copy size={13} /> Copiar enlace de Play Store</>}
      </button>
    </div>
  );
}

type Tab = "friends" | "online";

export default function Friends() {
  const { player } = usePlayer();
  const [tab, setTab] = useState<Tab>("friends");
  const [search, setSearch] = useState("");

  const { onlinePlayers, incomingChallenge, dismissChallenge } = usePresence(player ?? null);
  const { friends, isFollowing, follow, unfollow } = useFollows(
    player && player.loginMethod !== "guest" ? player.id : null,
    onlinePlayers
  );

  if (!player) return null;

  const isGuest = player.loginMethod === "guest";

  const filteredFriends = friends.filter(f =>
    f.followedName.toLowerCase().includes(search.toLowerCase())
  );

  const onlineOthers = onlinePlayers.filter(p => p.playerId !== player.id);
  const filteredOnline = onlineOthers.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const onlineFriendsCount = friends.filter(f => f.isOnline).length;

  return (
    <Layout>
      {incomingChallenge && (
        <ChallengeNotification challenge={incomingChallenge} onDismiss={dismissChallenge} />
      )}

      <div className="w-full max-w-lg mx-auto py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{ background: "rgba(249,168,37,0.15)", border: "1px solid rgba(249,168,37,0.3)" }}
          >
            <Users className="w-5 h-5 text-yellow-400" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">Amigos</h1>
            <p className="text-white/40 text-xs">
              {friends.length} guardados · {onlineFriendsCount} online ahora
            </p>
          </div>
        </div>

        {/* Guest notice */}
        {isGuest && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4 text-center"
            style={{ background: "rgba(249,168,37,0.08)", border: "1px solid rgba(249,168,37,0.2)" }}
          >
            <p className="text-yellow-400/80 text-sm font-bold mb-1">Inicia sesión para guardar amigos</p>
            <p className="text-white/40 text-xs">
              Con Google, Facebook o Instagram tus amigos se guardan automáticamente en tu cuenta.
            </p>
          </motion.div>
        )}

        {/* Tab bar */}
        <div className="flex gap-1 p-1 rounded-2xl"
          style={{ background: "rgba(0,0,0,0.3)", border: "1px solid rgba(255,255,255,0.08)" }}
        >
          {([["friends", `Guardados (${friends.length})`, Users], ["online", `Online (${onlineOthers.length})`, Wifi]] as const).map(([t, label, Icon]) => (
            <button key={t} onClick={() => setTab(t as Tab)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={tab === t
                ? { background: "rgba(249,168,37,0.2)", color: "#f9a825", border: "1px solid rgba(249,168,37,0.3)" }
                : { color: "rgba(255,255,255,0.4)" }
              }
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar jugador…"
            className="w-full pl-9 pr-9 py-2.5 rounded-xl text-sm text-white placeholder-white/30 outline-none transition-colors"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
          />
          {search && (
            <button onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          {tab === "friends" ? (
            <motion.div key="friends" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}
              className="space-y-2"
            >
              {isGuest ? (
                <div className="text-center py-8 text-white/30 text-sm">
                  Inicia sesión para ver tus amigos guardados
                </div>
              ) : filteredFriends.length === 0 ? (
                <div className="rounded-2xl py-10 text-center space-y-2"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)" }}
                >
                  <Users size={32} className="mx-auto text-white/20" />
                  <p className="text-white/30 text-sm font-bold">
                    {search ? "No se encontró ese jugador" : "Aún no tienes amigos guardados"}
                  </p>
                  <p className="text-white/20 text-xs">
                    {search ? "Prueba con otro nombre" : "Ve al Ranking o espera a que alguien se conecte y pulsa «Añadir»"}
                  </p>
                </div>
              ) : (
                filteredFriends.map(f => (
                  <FriendCard
                    key={f.followedId}
                    friend={f}
                    currentPlayer={player}
                    onUnfollow={() => unfollow(f.followedId)}
                  />
                ))
              )}
            </motion.div>
          ) : (
            <motion.div key="online" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }}
              className="space-y-2"
            >
              {filteredOnline.length === 0 ? (
                <div className="rounded-2xl py-10 text-center space-y-2"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px dashed rgba(255,255,255,0.1)" }}
                >
                  <Wifi size={32} className="mx-auto text-white/20" />
                  <p className="text-white/30 text-sm font-bold">
                    {search ? "No se encontró ese jugador" : "No hay nadie más conectado ahora"}
                  </p>
                  <p className="text-white/20 text-xs">Invita a tus amigos para que se unan</p>
                </div>
              ) : (
                filteredOnline.map(p => (
                  <OnlinePlayerCard
                    key={p.playerId}
                    player={p}
                    currentPlayer={player}
                    isFollowing={isFollowing(p.playerId)}
                    onFollow={() => follow(p)}
                    onUnfollow={() => unfollow(p.playerId)}
                  />
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Invite section */}
        <InviteSection player={player} />
      </div>
    </Layout>
  );
}
