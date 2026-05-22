import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Layout } from "@/components/Layout";
import { ArrowLeft, Eye, Users, Trophy, Radio } from "lucide-react";
import { getApiUrl } from "@/lib/utils";
import { useT } from "@/i18n/useT";

const API = getApiUrl();

interface LiveRoom {
  roomCode: string;
  hostName: string;
  status: string;
  currentLetter: string | null;
  currentRound: number;
  maxRounds: number;
  gameMode: string;
  language: string;
  playerCount: number;
  topScore: number;
}

export default function StreamerDirectory() {
  const { t, lang } = useT();
  const [rooms, setRooms] = useState<LiveRoom[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let stop = false;
    const fetchOnce = () => {
      fetch(`${API}/api/rooms/live`)
        .then(r => r.json())
        .then(d => { if (!stop) { setRooms(d.rooms || []); setLoaded(true); } })
        .catch(() => { if (!stop) setLoaded(true); });
    };
    fetchOnce();
    const id = setInterval(fetchOnce, 5000);
    return () => { stop = true; clearInterval(id); };
  }, []);

  // Filter to same language by default — viewers want rooms they understand.
  const sameLang = rooms.filter(r => r.language === lang);
  const otherLang = rooms.filter(r => r.language !== lang);

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
            <h1 className="text-white font-black text-xl flex items-center gap-2" style={{ fontFamily: "'Baloo 2', sans-serif" }}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
              {(t as any).streamer?.directoryTitle ?? "En directo ahora"}
            </h1>
            <p className="text-white/50 text-xs">{(t as any).streamer?.directorySubtitle ?? "Salas públicas de streamers"}</p>
          </div>
        </div>

        {!loaded && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {loaded && rooms.length === 0 && (
          <div className="text-center py-16 px-4 space-y-3">
            <Radio className="w-16 h-16 mx-auto text-white/20" />
            <p className="text-white/70 font-bold">{(t as any).streamer?.empty ?? "Nadie está en directo ahora mismo"}</p>
            <p className="text-white/40 text-sm">{(t as any).streamer?.emptyHint ?? "¿Tienes una sala? Actívala en modo streamer para aparecer aquí."}</p>
            <Link href="/multiplayer">
              <motion.button whileTap={{ scale: 0.96 }}
                className="mt-3 px-6 py-3 rounded-2xl font-black"
                style={{ background: "linear-gradient(135deg, #ef4444, #b91c1c)", color: "white" }}>
                {(t as any).streamer?.createOwn ?? "Crear mi sala"}
              </motion.button>
            </Link>
          </div>
        )}

        <AnimatePresence>
          {sameLang.map((r, i) => (
            <LiveRoomCard key={r.roomCode} room={r} index={i} t={t} />
          ))}
          {otherLang.length > 0 && (
            <p className="text-white/40 text-xs uppercase font-bold tracking-widest pt-3 pb-1">
              {(t as any).streamer?.otherLanguages ?? "Otros idiomas"}
            </p>
          )}
          {otherLang.map((r, i) => (
            <LiveRoomCard key={r.roomCode} room={r} index={sameLang.length + i} t={t} />
          ))}
        </AnimatePresence>
      </div>
    </Layout>
  );
}

function LiveRoomCard({ room, index, t }: { room: LiveRoom; index: number; t: any }) {
  const langFlag: Record<string, string> = { es: "🇪🇸", en: "🇬🇧", pt: "🇵🇹", fr: "🇫🇷" };
  return (
    <Link href={`/live/${room.roomCode}`}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ delay: Math.min(index * 0.05, 0.4) }}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        className="rounded-2xl p-4 cursor-pointer flex items-center gap-3"
        style={{
          background: "rgba(0,0,0,0.35)",
          border: "1px solid rgba(239,68,68,0.3)",
        }}
      >
        {/* Big letter */}
        <div className="w-14 h-14 rounded-xl flex items-center justify-center text-3xl font-black flex-shrink-0"
          style={{
            background: room.currentLetter
              ? "linear-gradient(135deg, #fbbf24, #f59e0b)"
              : "rgba(255,255,255,0.08)",
            color: "white",
            fontFamily: "'Baloo 2', sans-serif",
            boxShadow: room.currentLetter ? "0 4px 14px rgba(245,158,11,0.45)" : "none",
          }}>
          {room.currentLetter || "—"}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-white font-black truncate">{room.hostName}</p>
            <span className="text-xs">{langFlag[room.language] || "🌐"}</span>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs">
            <span className="flex items-center gap-1 text-white/60">
              <Users className="w-3 h-3" /> {room.playerCount}
            </span>
            <span className="flex items-center gap-1 text-white/60">
              <Trophy className="w-3 h-3" /> {room.topScore}
            </span>
            <span className="text-white/40">R{room.currentRound}/{room.maxRounds}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-full"
          style={{ background: "rgba(239,68,68,0.18)", border: "1px solid rgba(239,68,68,0.4)" }}>
          <Eye className="w-3.5 h-3.5 text-red-300" />
          <span className="text-red-200 font-black text-xs">{(t as any).streamer?.watch ?? "Ver"}</span>
        </div>
      </motion.div>
    </Link>
  );
}
