import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button, Card, Input } from "@/components/ui";
import { useCreateRoom, useJoinRoom } from "@workspace/api-client-react";
import { usePlayer } from "@/hooks/use-player";
import { OnlineFriends } from "@/components/OnlineFriends";
import { InviteFriends } from "@/components/InviteFriends";
import { Users, Plus, LogIn, UserPlus, Globe, Lock, RefreshCw, Flag } from "lucide-react";
import { useT } from "@/i18n/useT";
import { getCurrentLang } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";

interface PublicRoom {
  roomCode: string;
  hostId: string;
  hostName: string;
  maxRounds: number;
  language: string;
  playerCount: number;
  createdAt: string;
}

const LANG_FLAGS: Record<string, string> = { es: "🇪🇸", en: "🇬🇧", pt: "🇧🇷", fr: "🇫🇷" };

export default function Multiplayer() {
  const [, setLocation] = useLocation();
  const { player } = usePlayer();
  const { t } = useT();
  const [roomCode, setRoomCode] = useState("");
  const [error, setError] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(false);

  const createMutation = useCreateRoom();
  const joinMutation = useJoinRoom();

  const loadPublicRooms = async () => {
    setLoadingPublic(true);
    try {
      const res = await fetch(`${window.location.origin}/api/rooms/public`);
      if (res.ok) {
        const data = await res.json();
        setPublicRooms(data.rooms || []);
      }
    } catch {}
    setLoadingPublic(false);
  };

  // Load on mount and auto-refresh every 6 seconds
  useEffect(() => {
    loadPublicRooms();
    const interval = setInterval(loadPublicRooms, 6000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async () => {
    if (!player) return;
    setError("");
    try {
      const room = await createMutation.mutateAsync({
        data: {
          hostId: player.id,
          hostName: player.name,
          avatarColor: player.avatarColor,
          loginMethod: player.loginMethod ?? null,
          maxRounds: 3,
          language: getCurrentLang(),
          isPublic,
        }
      });
      setLocation(`/room/${room.roomCode}`);
    } catch {
      setError(t.multiplayer.waitingForHost);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!player || !roomCode.trim()) return;
    setError("");
    try {
      const room = await joinMutation.mutateAsync({
        roomCode: roomCode.toUpperCase(),
        data: {
          playerId: player.id,
          playerName: player.name,
          avatarColor: player.avatarColor,
          loginMethod: player.loginMethod ?? null,
        }
      });
      setLocation(`/room/${room.roomCode}`);
    } catch {
      setError(t.multiplayer.waitingForHost);
    }
  };

  const handleJoinPublic = async (code: string) => {
    if (!player) return;
    setError("");
    try {
      const room = await joinMutation.mutateAsync({
        roomCode: code,
        data: {
          playerId: player.id,
          playerName: player.name,
          avatarColor: player.avatarColor,
          loginMethod: player.loginMethod ?? null,
        }
      });
      setLocation(`/room/${room.roomCode}`);
    } catch {
      setError(t.multiplayer.waitingForHost);
      loadPublicRooms();
    }
  };

  return (
    <Layout>
      <AnimatePresence>
        {showInvite && player && (
          <InviteFriends player={player} onClose={() => setShowInvite(false)} />
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col max-w-md mx-auto w-full space-y-5 py-4">

        <div className="text-center">
          <div className="bg-primary/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm border border-white/10">
            <Users className="w-10 h-10 text-secondary" />
          </div>
          <h1 className="text-4xl font-display font-bold">{t.home.multiplayer}</h1>

          {player && player.loginMethod !== "guest" && (
            <button
              onClick={() => setShowInvite(true)}
              className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-bold transition-all hover:scale-105"
              style={{
                background: "rgba(249,168,37,0.12)",
                border: "1px solid rgba(249,168,37,0.3)",
                color: "#f9a825",
              }}
            >
              <UserPlus size={14} />
              Invitar amigos
            </button>
          )}
        </div>

        {error && (
          <div className="bg-red-500/20 text-white border border-red-500 p-4 rounded-xl w-full text-center font-bold">
            {error}
          </div>
        )}

        {player && <OnlineFriends player={player} />}

        <Card className="w-full p-6 space-y-6">
          <div>
            <h3 className="font-display font-bold text-xl mb-4 flex items-center gap-2">
              <Plus className="text-secondary" /> {t.multiplayer.createRoom}
            </h3>

            {/* Public / Private toggle */}
            <div className="flex items-center gap-3 mb-4 p-3 rounded-xl bg-black/20 border border-white/10">
              <button
                onClick={() => setIsPublic(false)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-sm transition-all ${!isPublic ? "bg-secondary text-black shadow-md" : "text-white/50 hover:text-white"}`}
              >
                <Lock size={14} />
                Privada
              </button>
              <button
                onClick={() => setIsPublic(true)}
                className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-bold text-sm transition-all ${isPublic ? "bg-secondary text-black shadow-md" : "text-white/50 hover:text-white"}`}
              >
                <Globe size={14} />
                Pública
              </button>
            </div>

            {isPublic && (
              <p className="text-xs text-white/50 mb-4 text-center">
                Cualquier jugador podrá unirse a tu sala desde el listado de salas abiertas.
              </p>
            )}

            <Button
              size="lg"
              className="w-full"
              onClick={handleCreate}
              isLoading={createMutation.isPending}
            >
              {isPublic ? <Globe size={16} className="mr-2" /> : <Lock size={16} className="mr-2" />}
              {t.multiplayer.create}
            </Button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-white/50 font-bold">o</span>
            </div>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <h3 className="font-display font-bold text-xl flex items-center gap-2">
              <LogIn className="text-secondary" /> {t.multiplayer.joinRoom}
            </h3>
            <Input
              placeholder={t.multiplayer.enterCode}
              value={roomCode}
              onChange={e => setRoomCode(e.target.value.toUpperCase())}
              maxLength={6}
              className="text-center tracking-[0.2em] font-display font-bold text-2xl uppercase"
            />
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              type="submit"
              disabled={roomCode.length < 4}
              isLoading={joinMutation.isPending}
            >
              {t.multiplayer.join}
            </Button>
          </form>
        </Card>

        {/* Public rooms browser */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-bold text-lg flex items-center gap-2">
              <Globe className="w-5 h-5 text-secondary" />
              Salas públicas abiertas
            </h3>
            <button
              onClick={loadPublicRooms}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
              disabled={loadingPublic}
            >
              <RefreshCw size={16} className={loadingPublic ? "animate-spin" : ""} />
            </button>
          </div>

          {loadingPublic ? (
            <div className="space-y-2">
              {[1,2].map(i => <div key={i} className="h-16 bg-white/10 rounded-xl animate-pulse" />)}
            </div>
          ) : publicRooms.length === 0 ? (
            <div className="p-8 text-center text-white/40 font-bold bg-black/20 rounded-2xl border border-white/10">
              <Globe className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay salas públicas abiertas ahora.</p>
              <p className="text-xs mt-1 text-white/25">¡Crea una sala pública para que otros se unan!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {publicRooms.map((room, i) => (
                <motion.div
                  key={room.roomCode}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-3 p-4 bg-black/20 rounded-2xl border border-white/10 hover:border-secondary/30 transition-all"
                >
                  <div className="w-10 h-10 rounded-full bg-primary/40 flex items-center justify-center text-white font-black text-lg flex-shrink-0">
                    {room.hostName.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-black truncate">{room.hostName}</p>
                    <div className="flex items-center gap-2 text-xs text-white/50">
                      <span className="font-mono font-bold text-secondary/80">{room.roomCode}</span>
                      <span>·</span>
                      <Users size={10} />
                      <span>{room.playerCount}</span>
                      <span>·</span>
                      <Flag size={10} />
                      <span>{LANG_FLAGS[room.language] ?? room.language}</span>
                      <span>·</span>
                      <span>{room.maxRounds} rondas</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => handleJoinPublic(room.roomCode)}
                    isLoading={joinMutation.isPending}
                    className="flex-shrink-0"
                  >
                    Unirse
                  </Button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
