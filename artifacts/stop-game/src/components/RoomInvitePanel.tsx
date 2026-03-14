import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { UserPlus, Check, Send, Users, MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { fetchOnlinePlayers, sendRoomInvite, type OnlinePlayer } from "@/lib/usePresence";
import { useFollows } from "@/lib/useFollows";
import { useFacebookFriends } from "@/lib/useFriends";
import type { PlayerProfile } from "@/hooks/use-player";

interface RoomInvitePanelProps {
  player: PlayerProfile;
  roomCode: string;
}

type InviteState = "idle" | "sending" | "sent" | "offline";

function AvatarBubble({ picture, name, color, size = 32 }: { picture?: string | null; name: string; color?: string; size?: number }) {
  const [err, setErr] = useState(false);
  if (picture && !err) {
    return <img src={picture} alt={name} onError={() => setErr(true)}
      className="rounded-full object-cover flex-shrink-0 border-2 border-white/10"
      style={{ width: size, height: size }} />;
  }
  return (
    <div className="rounded-full flex items-center justify-center font-black text-white flex-shrink-0"
      style={{ width: size, height: size, background: color || "#e53e3e", fontSize: size * 0.38 }}>
      {name[0]?.toUpperCase() || "?"}
    </div>
  );
}

interface FriendEntry {
  id: string;
  name: string;
  picture?: string | null;
  color?: string;
  isOnline: boolean;
  onlineData?: OnlinePlayer;
  alreadyInRoom?: boolean;
}

function InviteRow({ friend, player, roomCode }: { friend: FriendEntry; player: PlayerProfile; roomCode: string }) {
  const [state, setState] = useState<InviteState>(friend.alreadyInRoom ? "sent" : "idle");

  const handleInviteOnline = async () => {
    if (!friend.onlineData || state !== "idle") return;
    setState("sending");
    const ok = await sendRoomInvite(player, friend.id, roomCode);
    setState(ok ? "sent" : "offline");
  };

  const handleInviteWhatsApp = () => {
    const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
    const msg = `¡${player.name} te invita a jugar STOP! 🎮\nÚnete a la sala ${roomCode}: ${base}/room/${roomCode}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
    setState("sent");
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex items-center gap-2.5 py-2 px-1"
    >
      {/* Avatar + online dot */}
      <div className="relative flex-shrink-0">
        <AvatarBubble picture={friend.picture} name={friend.name} color={friend.color} size={34} />
        <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[#0d1757] ${
          friend.isOnline ? "bg-green-400 shadow-[0_0_5px_#4ade80]" : "bg-gray-600"
        }`} />
      </div>

      {/* Name + status */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm truncate">{friend.name}</p>
        {friend.alreadyInRoom ? (
          <p className="text-green-400/80 text-xs">Ya está en la sala</p>
        ) : friend.isOnline ? (
          <p className="text-green-400/60 text-xs">Online · en el menú</p>
        ) : (
          <p className="text-white/30 text-xs">Desconectado</p>
        )}
      </div>

      {/* Action */}
      {friend.alreadyInRoom ? (
        <span className="text-green-400 text-xs font-bold flex items-center gap-1 flex-shrink-0">
          <Check size={12} /> En sala
        </span>
      ) : friend.isOnline ? (
        <motion.button
          whileHover={{ scale: state === "idle" ? 1.05 : 1 }}
          whileTap={{ scale: state === "idle" ? 0.95 : 1 }}
          onClick={handleInviteOnline}
          disabled={state !== "idle"}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold flex-shrink-0 transition-all"
          style={
            state === "sent"
              ? { background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.35)", color: "#4ade80" }
              : state === "sending"
              ? { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.4)" }
              : { background: "rgba(249,168,37,0.12)", border: "1px solid rgba(249,168,37,0.35)", color: "#f9a825" }
          }
        >
          {state === "sending" ? (
            <span className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
          ) : state === "sent" ? (
            <><Check size={11} /> Enviado</>
          ) : (
            <><Send size={11} /> Invitar</>
          )}
        </motion.button>
      ) : (
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleInviteWhatsApp}
          disabled={state === "sent"}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold flex-shrink-0 transition-all"
          style={
            state === "sent"
              ? { background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.35)", color: "#4ade80" }
              : { background: "#25D366", color: "white" }
          }
        >
          {state === "sent" ? <><Check size={11} /> Enviado</> : <>
            <svg viewBox="0 0 24 24" className="w-3 h-3 fill-white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            WA
          </>}
        </motion.button>
      )}
    </motion.div>
  );
}

export function RoomInvitePanel({ player, roomCode }: RoomInvitePanelProps) {
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [expanded, setExpanded] = useState(true);

  const { friends: gameFriends } = useFollows(
    player.loginMethod !== "guest" ? player.id : null,
    onlinePlayers
  );
  const { enriched: fbFriends } = useFacebookFriends(
    player.fbAccessToken,
    onlinePlayers
  );

  useEffect(() => {
    fetchOnlinePlayers().then(setOnlinePlayers);
    const id = setInterval(() => fetchOnlinePlayers().then(setOnlinePlayers), 15_000);
    return () => clearInterval(id);
  }, []);

  // Build a unified friend list (deduplicated)
  const friendMap = new Map<string, FriendEntry>();

  // 1. Players already in this room (excluding self)
  onlinePlayers
    .filter((p) => p.playerId !== player.id && p.roomCode === roomCode)
    .forEach((p) => {
      friendMap.set(p.playerId, {
        id: p.playerId, name: p.name, picture: p.picture,
        color: p.avatarColor, isOnline: true, onlineData: p, alreadyInRoom: true,
      });
    });

  // 2. Game friends (from follow system) — uses followedId/followedName/etc.
  gameFriends.forEach((f) => {
    const fid = f.followedId;
    if (!friendMap.has(fid)) {
      friendMap.set(fid, {
        id: fid,
        name: f.followedName,
        picture: f.followedPicture,
        color: f.followedAvatarColor,
        isOnline: !!f.isOnline,
        onlineData: f.onlineData,
        alreadyInRoom: f.onlineData?.roomCode === roomCode,
      });
    }
  });

  // 3. Facebook friends
  fbFriends.forEach((f) => {
    const id = f.onlineData?.playerId;
    if (id && !friendMap.has(id)) {
      friendMap.set(id, {
        id, name: f.name, picture: f.picture,
        color: "#1877F2", isOnline: f.isOnline, onlineData: f.onlineData || undefined,
        alreadyInRoom: f.onlineData?.roomCode === roomCode,
      });
    }
  });

  // 4. All other online players (not self, not in room yet, not already listed)
  onlinePlayers
    .filter((p) => p.playerId !== player.id && !friendMap.has(p.playerId))
    .forEach((p) => {
      friendMap.set(p.playerId, {
        id: p.playerId, name: p.name, picture: p.picture,
        color: p.avatarColor, isOnline: true, onlineData: p,
        alreadyInRoom: p.roomCode === roomCode,
      });
    });

  const entries = Array.from(friendMap.values()).sort((a, b) => {
    if (a.alreadyInRoom && !b.alreadyInRoom) return -1;
    if (!a.alreadyInRoom && b.alreadyInRoom) return 1;
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    return 0;
  });

  if (entries.length === 0 && player.loginMethod === "guest") return null;

  return (
    <div
      className="rounded-2xl overflow-hidden w-full"
      style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.1)" }}
    >
      {/* Header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-[#f9a825]" />
          <span className="text-white font-bold text-sm">Invitar a la sala</span>
          {entries.filter((e) => e.isOnline).length > 0 && (
            <span className="bg-[#f9a825]/20 text-[#f9a825] text-[11px] font-black rounded-full px-1.5 py-0.5 leading-none border border-[#f9a825]/30">
              {entries.filter((e) => e.isOnline).length} online
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-white/40" /> : <ChevronDown className="w-4 h-4 text-white/40" />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div className="px-4 pb-4 max-h-52 overflow-y-auto space-y-0.5">
              {entries.length === 0 ? (
                <div className="py-4 text-center">
                  <Users className="w-6 h-6 text-white/20 mx-auto mb-1.5" />
                  <p className="text-white/30 text-xs">No hay amigos online ahora mismo</p>
                  <p className="text-white/20 text-[10px] mt-0.5">Usa el botón de compartir para invitarles</p>
                </div>
              ) : (
                entries.map((f) => (
                  <InviteRow key={f.id} friend={f} player={player} roomCode={roomCode} />
                ))
              )}

              {/* WhatsApp general invite always visible */}
              <div className="pt-2 border-t border-white/10 mt-1">
                <button
                  onClick={() => {
                    const base = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "");
                    const msg = `¡${player.name} te invita a jugar STOP! 🎮\nÚnete a la sala con código: ${roomCode}\n${base}/room/${roomCode}`;
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank");
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all hover:opacity-90"
                  style={{ background: "rgba(37,211,102,0.12)", border: "1px solid rgba(37,211,102,0.25)", color: "#25D366" }}
                >
                  <MessageSquare size={13} />
                  Enviar invitación por WhatsApp
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
