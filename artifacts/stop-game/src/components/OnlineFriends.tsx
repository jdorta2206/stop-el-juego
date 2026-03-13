import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Wifi, Copy, ChevronDown, ChevronUp, UserCheck } from "lucide-react";
import { usePresence, type OnlinePlayer } from "@/lib/usePresence";
import { useFacebookFriends, type EnrichedFriend } from "@/lib/useFriends";
import type { PlayerProfile } from "@/hooks/use-player";

interface OnlineFriendsProps {
  player: PlayerProfile;
  onInvite?: (roomCode: string) => void;
}

// Provider icon/badge
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
      title={provider}
    >
      {info.label}
    </span>
  );
}

// Online dot indicator
function OnlineDot({ isOnline }: { isOnline: boolean }) {
  return (
    <span
      className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${
        isOnline ? "bg-green-400 shadow-[0_0_6px_#4ade80]" : "bg-gray-600"
      }`}
    />
  );
}

// Avatar component
function Avatar({
  picture,
  name,
  avatarColor,
  size = 36,
}: {
  picture?: string | null;
  name: string;
  avatarColor?: string;
  size?: number;
}) {
  const [imgError, setImgError] = useState(false);

  if (picture && !imgError) {
    return (
      <img
        src={picture}
        alt={name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
        onError={() => setImgError(true)}
      />
    );
  }

  return (
    <div
      className="rounded-full flex items-center justify-center font-black text-white flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: avatarColor || "#e53e3e",
        fontSize: size * 0.4,
      }}
    >
      {name[0]?.toUpperCase() || "?"}
    </div>
  );
}

// Single player row
function PlayerRow({
  player,
  isCurrentUser,
  onCopyInvite,
}: {
  player: OnlinePlayer;
  isCurrentUser: boolean;
  onCopyInvite?: () => void;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (player.roomCode) {
      navigator.clipboard.writeText(player.roomCode).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
    onCopyInvite?.();
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 py-2.5 px-1"
    >
      <div className="relative flex-shrink-0">
        <Avatar
          picture={player.picture}
          name={player.name}
          avatarColor={player.avatarColor}
          size={36}
        />
        {/* Online pulse ring */}
        <span className="absolute -bottom-0.5 -right-0.5">
          <OnlineDot isOnline={true} />
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-white font-bold text-sm truncate">{player.name}</span>
          {isCurrentUser && (
            <span className="text-[10px] text-white/40 font-bold">(tú)</span>
          )}
          <ProviderDot provider={player.provider} />
        </div>
        {player.roomCode ? (
          <p className="text-xs text-green-400/80 font-medium">En sala: {player.roomCode}</p>
        ) : (
          <p className="text-xs text-white/40">En el menú</p>
        )}
      </div>

      {player.roomCode && !isCurrentUser && (
        <button
          onClick={handleCopy}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
          style={{
            background: copied ? "rgba(74,222,128,0.2)" : "rgba(249,168,37,0.15)",
            border: copied ? "1px solid rgba(74,222,128,0.4)" : "1px solid rgba(249,168,37,0.3)",
            color: copied ? "#4ade80" : "#f9a825",
          }}
          title="Copiar código de sala para unirte"
        >
          {copied ? (
            "✓ Copiado"
          ) : (
            <>
              <Copy size={11} /> Unirse
            </>
          )}
        </button>
      )}
    </motion.div>
  );
}

// FB friend row (may or may not be online)
function FriendRow({ friend }: { friend: EnrichedFriend }) {
  const [copied, setCopied] = useState(false);

  const handleJoin = () => {
    if (friend.onlineData?.roomCode) {
      navigator.clipboard.writeText(friend.onlineData.roomCode).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-3 py-2.5 px-1"
    >
      <div className="relative flex-shrink-0">
        <Avatar picture={friend.picture} name={friend.name} avatarColor="#1877F2" size={36} />
        <span className="absolute -bottom-0.5 -right-0.5">
          <OnlineDot isOnline={friend.isOnline} />
        </span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-white font-bold text-sm truncate">{friend.name}</span>
          <ProviderDot provider="facebook" />
        </div>
        {friend.isOnline && friend.onlineData ? (
          friend.onlineData.roomCode ? (
            <p className="text-xs text-green-400/80 font-medium">En sala: {friend.onlineData.roomCode}</p>
          ) : (
            <p className="text-xs text-green-400/60">Conectado · En el menú</p>
          )
        ) : (
          <p className="text-xs text-white/30">Desconectado</p>
        )}
      </div>

      {friend.isOnline && friend.onlineData?.roomCode && (
        <button
          onClick={handleJoin}
          className="flex-shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all"
          style={{
            background: copied ? "rgba(74,222,128,0.2)" : "rgba(24,119,242,0.2)",
            border: copied ? "1px solid rgba(74,222,128,0.4)" : "1px solid rgba(24,119,242,0.4)",
            color: copied ? "#4ade80" : "#60a5fa",
          }}
        >
          {copied ? "✓ Copiado" : <><Copy size={11} /> Unirse</>}
        </button>
      )}
    </motion.div>
  );
}

export function OnlineFriends({ player }: OnlineFriendsProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const { onlinePlayers } = usePresence(player);
  const { enriched: fbFriends, loading: fbLoading } = useFacebookFriends(
    player.fbAccessToken,
    onlinePlayers
  );

  // Filter out current player from online list; show others only
  const others = onlinePlayers.filter((p) => p.playerId !== player.id);
  const onlineCount = others.length;

  // FB friends who are also in online list (quick access to online friends)
  const onlineFbFriends = fbFriends.filter((f) => f.isOnline);
  const hasFbFriends = player.loginMethod === "facebook" && player.fbAccessToken;

  return (
    <div
      className="w-full rounded-2xl overflow-hidden"
      style={{
        background: "rgba(0,0,0,0.25)",
        border: "1px solid rgba(255,255,255,0.1)",
        backdropFilter: "blur(8px)",
      }}
    >
      {/* Header */}
      <button
        onClick={() => setIsExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Wifi className="w-4 h-4 text-green-400" />
          <span className="text-white font-bold text-sm">Jugadores online</span>
          {onlineCount > 0 && (
            <span className="bg-green-500 text-white text-[11px] font-black rounded-full px-1.5 py-0.5 leading-none">
              {onlineCount}
            </span>
          )}
        </div>
        {isExpanded ? (
          <ChevronUp className="w-4 h-4 text-white/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40" />
        )}
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-4 pb-4 space-y-1 max-h-64 overflow-y-auto">
              {/* Current player (always online since they're here) */}
              <PlayerRow
                player={{
                  playerId: player.id,
                  name: player.name,
                  picture: player.picture || null,
                  avatarColor: player.avatarColor,
                  provider: player.loginMethod || null,
                  roomCode: null,
                  lastSeen: Date.now(),
                }}
                isCurrentUser={true}
              />

              {/* Divider if there are others */}
              {others.length > 0 && (
                <div className="border-t border-white/10 my-1" />
              )}

              {/* Other online players */}
              {others.map((p) => (
                <PlayerRow key={p.playerId} player={p} isCurrentUser={false} />
              ))}

              {others.length === 0 && (
                <p className="text-white/30 text-xs text-center py-2">
                  No hay otros jugadores online ahora mismo
                </p>
              )}

              {/* Facebook friends section */}
              {hasFbFriends && (
                <>
                  <div className="border-t border-white/10 pt-2 mt-2">
                    <div className="flex items-center gap-1.5 mb-2">
                      <span
                        className="inline-flex items-center justify-center w-4 h-4 rounded text-[9px] font-black text-white"
                        style={{ background: "#1877F2" }}
                      >
                        f
                      </span>
                      <span className="text-white/60 text-xs font-bold uppercase tracking-wider">
                        Amigos de Facebook
                      </span>
                      {fbLoading && (
                        <div className="w-3 h-3 border border-white/30 border-t-white/80 rounded-full animate-spin" />
                      )}
                    </div>

                    {!fbLoading && fbFriends.length === 0 && (
                      <p className="text-white/30 text-xs py-1">
                        Ningún amigo de Facebook juega todavía. ¡Invítales!
                      </p>
                    )}

                    {fbFriends.map((f) => (
                      <FriendRow key={f.fbId} friend={f} />
                    ))}
                  </div>
                </>
              )}

              {/* CTA for users not logged in with Facebook */}
              {!hasFbFriends && player.loginMethod !== "facebook" && (
                <div className="border-t border-white/10 pt-3 mt-2">
                  <p className="text-white/30 text-xs text-center leading-relaxed">
                    Inicia sesión con <span className="text-[#1877F2] font-bold">Facebook</span> para ver si tus amigos están jugando
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
