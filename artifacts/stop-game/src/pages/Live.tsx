import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui";
import { getApiUrl } from "@/lib/utils";
import { Eye, ArrowLeft, Trophy, Share2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const API = getApiUrl();

// Public spectator page — no auth required, no AuthModal layer.
const PageShell = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen w-full"
    style={{ background: "linear-gradient(180deg, #1a0f2e 0%, #0f0a1f 60%, #050309 100%)" }}>
    {children}
  </div>
);

export default function Live() {
  const params = useParams<{ code: string }>();
  const code = params.code?.toUpperCase();
  const [room, setRoom] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    let stop = false;
    const fetchOnce = async () => {
      try {
        const r = await fetch(`${API}/api/rooms/${encodeURIComponent(code)}/spectate`);
        if (r.status === 404) { setError("Sala no encontrada"); return; }
        if (r.status === 403) { setError("Esta sala no es pública"); return; }
        if (!r.ok) return;
        const data = await r.json();
        if (!stop) { setRoom(data); setError(null); }
      } catch { /* ignore */ }
    };
    fetchOnce();
    const id = setInterval(fetchOnce, 2000);
    return () => { stop = true; clearInterval(id); };
  }, [code]);

  if (error) {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-4 p-8 text-center">
          <p className="text-white/80 font-bold">{error}</p>
          <Link href="/"><Button>Volver al inicio</Button></Link>
        </div>
      </PageShell>
    );
  }

  if (!room) {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-4 p-8">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-white/60 text-sm">Conectando con la sala…</p>
        </div>
      </PageShell>
    );
  }

  const players = (room.players ?? []).slice().sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
  const stoppedBy = room.stopper?.stopperName;
  const overlayUrl = `${window.location.origin}${import.meta.env.BASE_URL}overlay/${code}`;

  const share = async () => {
    const url = `${window.location.origin}${import.meta.env.BASE_URL}live/${code}`;
    if (navigator.share) {
      try { await navigator.share({ title: "STOP en vivo", text: `Mira esta partida en vivo de STOP — ${room.hostName}`, url }); }
      catch { /* canceled */ }
    } else {
      navigator.clipboard.writeText(url).catch(() => {});
    }
  };

  return (
    <PageShell>
      <div className="w-full max-w-2xl mx-auto px-4 py-4 flex flex-col gap-4">
        {/* Header live */}
        <div className="flex items-center justify-between">
          <Link href="/"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" />Inicio</Button></Link>
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/60">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-red-300 text-xs font-black uppercase tracking-wider">EN VIVO</span>
          </span>
          <Button variant="ghost" size="sm" onClick={share}><Share2 className="w-4 h-4" /></Button>
        </div>

        {/* Title */}
        <div className="text-center">
          <p className="text-white/60 text-xs uppercase tracking-widest">Sala de</p>
          <h1 className="text-2xl font-black text-white">{room.hostName}</h1>
          <p className="text-white/50 text-xs mt-1">
            Ronda {room.currentRound}/{room.maxRounds} · {players.length} jugadores · Modo {room.gameMode}
          </p>
        </div>

        {/* Letter / status */}
        <div className="rounded-2xl p-6 text-center"
          style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(217,70,239,0.18))", border: "1.5px solid rgba(245,158,11,0.5)" }}>
          {(room.status === "playing" || room.status === "stopping") && (
            <>
              <p className="text-white/70 text-xs uppercase tracking-wider mb-1">Letra actual</p>
              <p className="text-7xl font-black text-amber-300" style={{ textShadow: "0 4px 18px rgba(245,158,11,0.6)" }}>
                {room.currentLetter ?? "—"}
              </p>
              {room.status === "stopping" && stoppedBy && (
                <motion.p initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="mt-3 text-fuchsia-300 font-black text-lg">
                  ¡STOP! · {stoppedBy}
                </motion.p>
              )}
            </>
          )}
          {room.status === "revealing" && (
            <p className="text-cyan-300 font-black text-xl">Revisando respuestas…</p>
          )}
          {room.status === "bluffvoting" && (
            <p className="text-purple-300 font-black text-xl">¿Verdad o farol? 🎭</p>
          )}
          {room.status === "finished" && (
            <p className="text-amber-300 font-black text-xl flex items-center justify-center gap-2">
              <Trophy className="w-6 h-6" /> ¡Partida terminada!
            </p>
          )}
          {room.status === "waiting" && (
            <p className="text-white/70 text-xl">Esperando que empiece la partida…</p>
          )}
        </div>

        {/* Scoreboard */}
        <div className="flex flex-col gap-2">
          <p className="text-white/60 text-xs uppercase tracking-wider px-1">Marcador en vivo</p>
          <AnimatePresence>
            {players.map((p: any, i: number) => (
              <motion.div key={p.playerId} layout
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                style={{
                  background: i === 0 ? "rgba(245,158,11,0.15)" : "rgba(255,255,255,0.05)",
                  border: i === 0 ? "1.5px solid rgba(245,158,11,0.5)" : "1px solid rgba(255,255,255,0.1)",
                }}>
                <span className="text-white/40 font-black text-sm w-5">{i + 1}</span>
                <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold shadow"
                  style={{ backgroundColor: p.avatarColor }}>
                  {p.playerName?.charAt(0).toUpperCase()}
                </div>
                <p className="flex-1 text-white font-bold text-sm truncate">
                  {p.playerName}
                  {p.isPremium && <span className="ml-1 text-amber-400">★</span>}
                </p>
                <p className="text-amber-300 font-black text-lg">{p.score || 0}</p>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Streamer tools */}
        <details className="rounded-xl bg-white/5 border border-white/10 p-3">
          <summary className="text-white/70 text-sm font-bold cursor-pointer flex items-center gap-2">
            <Eye className="w-4 h-4" /> Para streamers (OBS)
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            <p className="text-white/50 text-xs">Pega esta URL como Browser Source en OBS (fondo transparente):</p>
            <div className="flex gap-2">
              <input readOnly value={overlayUrl}
                className="flex-1 bg-black/40 text-white/80 text-xs px-2 py-1.5 rounded border border-white/10 font-mono"
                onClick={(e) => (e.target as HTMLInputElement).select()} />
              <Button size="sm" onClick={() => navigator.clipboard.writeText(overlayUrl)}>Copiar</Button>
            </div>
          </div>
        </details>
      </div>
    </PageShell>
  );
}
