import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { usePlayer } from "@/hooks/use-player";
import { usePresence, sendChallenge, type OnlinePlayer } from "@/lib/usePresence";
import { useFollows } from "@/lib/useFollows";
import { getApiUrl } from "@/lib/utils";
import {
  Trophy, Users, Play, Copy, Check, ChevronRight,
  Swords, Crown, ArrowLeft, Loader2, Plus, LogIn, Share2, MessageCircle, Send
} from "lucide-react";

type Match = {
  id: string;
  p1Id: string | null; p1Name: string;
  p2Id: string | null; p2Name: string;
  winnerId: string | null; winnerName: string | null;
  roomCode: string | null;
  status: "pending" | "playing" | "done";
};

type Bracket = {
  rounds: Match[][];
  currentRound: number;
  champion: { id: string; name: string } | null;
};

type Tournament = {
  id: number;
  code: string;
  hostId: string;
  hostName: string;
  name: string;
  status: "waiting" | "active" | "completed";
  size: number;
  players: { playerId: string; playerName: string }[];
  bracket: Bracket | null;
};

const API = getApiUrl();

async function apiFetch(path: string, opts?: RequestInit) {
  const r = await fetch(`${API}/api/tournaments${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  return r.json();
}

export default function Tournament() {
  const [, navigate] = useLocation();
  const { player } = usePlayer();
  const { onlinePlayers } = usePresence(player ?? null, null);
  const { friends: gameFriends } = useFollows(player?.loginMethod !== "guest" ? player?.id ?? null : null, onlinePlayers);

  const [view, setView] = useState<"home" | "create" | "join" | "lobby" | "bracket">("home");
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [tName, setTName] = useState("");
  const [tSize, setTSize] = useState<4 | 8>(4);
  const [joinCode, setJoinCode] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [invitedIds, setInvitedIds] = useState<Set<string>>(new Set());
  const redirectedMatchRef = useRef<string | null>(null);

  const poll = useCallback(async () => {
    if (!tournament || !player) return;
    try {
      const data: Tournament = await apiFetch(`/${tournament.code}`);
      setTournament(data);
      if (data.status === "active" && view !== "bracket") setView("bracket");

      // T004: Auto-redirect when a match involving this player starts (non-host player)
      if (data.bracket) {
        const myMatch = data.bracket.rounds.flat().find(
          (m: Match) =>
            m.status === "playing" &&
            m.roomCode &&
            (m.p1Id === player.id || m.p2Id === player.id),
        );
        if (myMatch?.roomCode && redirectedMatchRef.current !== myMatch.id) {
          redirectedMatchRef.current = myMatch.id;
          navigate(`/room/${myMatch.roomCode}?torneo=${data.code}&match=${myMatch.id}`);
        }
      }
    } catch {}
  }, [tournament, player, view, navigate]);

  useEffect(() => {
    if (!tournament) return;
    const id = setInterval(poll, 2500);
    return () => clearInterval(id);
  }, [poll, tournament]);

  const createTournament = async () => {
    if (!player || !tName.trim()) return;
    setLoading(true); setError("");
    try {
      const data: Tournament = await apiFetch("/", {
        method: "POST",
        body: JSON.stringify({ hostId: player.id, hostName: player.name, name: tName.trim(), size: tSize }),
      });
      setTournament(data);
      setView("lobby");
    } catch { setError("Error al crear torneo"); }
    setLoading(false);
  };

  const joinTournament = async () => {
    if (!player || !joinCode.trim()) return;
    setLoading(true); setError("");
    try {
      const data: any = await apiFetch(`/${joinCode.trim().toUpperCase()}/join`, {
        method: "POST",
        body: JSON.stringify({ playerId: player.id, playerName: player.name }),
      });
      if (data.error) { setError(data.error); setLoading(false); return; }
      setTournament(data);
      setView(data.status === "active" ? "bracket" : "lobby");
    } catch { setError("Código de torneo inválido"); }
    setLoading(false);
  };

  const startTournament = async () => {
    if (!tournament || !player) return;
    setLoading(true); setError("");
    try {
      const data: any = await apiFetch(`/${tournament.code}/start`, {
        method: "POST",
        body: JSON.stringify({ hostId: player.id }),
      });
      if (data.error) { setError(data.error); setLoading(false); return; }
      setTournament(data);
      setView("bracket");
    } catch { setError("Error al iniciar torneo"); }
    setLoading(false);
  };

  const startMatch = async (match: Match) => {
    if (!tournament || !player) return;
    // Create a room for the two players, then link it to the match
    try {
      const roomRes = await fetch(`${API}/api/rooms`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostId: match.p1Id,
          hostName: match.p1Name,
          maxRounds: 3,
        }),
      });
      const roomData = await roomRes.json();
      const roomCode: string = roomData.roomCode;

      // Link room to match
      await apiFetch(`/${tournament.code}/start-match`, {
        method: "POST",
        body: JSON.stringify({ matchId: match.id, roomCode }),
      });

      // Navigate player to the room with tournament context
      navigate(`/room/${roomCode}?torneo=${tournament.code}&match=${match.id}`);
    } catch {}
  };

  const copyCode = () => {
    if (!tournament) return;
    navigator.clipboard.writeText(tournament.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getInviteUrl = () => {
    if (!tournament) return "";
    return `${window.location.origin}${import.meta.env.BASE_URL}torneo/${tournament.code}`;
  };

  const getInviteText = () => {
    if (!tournament) return "";
    return `¡Únete a mi torneo STOP! 🎮\nTorneo: ${tournament.name}\nCódigo: ${tournament.code}\nLink: ${getInviteUrl()}`;
  };

  const shareTournament = async () => {
    const text = getInviteText();
    const url = getInviteUrl();
    if (!text || !url) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "STOP - Torneo", text, url });
        return;
      } catch {}
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
  };

  const inviteToTournament = async (targetId: string, targetName: string) => {
    if (!tournament || !player) return;
    const roomCode = tournament.code;
    const online = onlinePlayers.find(p => p.playerId === targetId);
    if (online) {
      await sendChallenge(player, targetId, "es");
    }
    setInvitedIds(prev => new Set([...prev, targetId]));
    if (!online) {
      window.open(`https://wa.me/?text=${encodeURIComponent(`¡${player.name} te invita al torneo STOP! 🎮\n${tournament.name}\nCódigo: ${roomCode}`)}`, "_blank");
    }
  };

  const tournamentInviteTargets = (() => {
    if (!player) return [];
    const onlineMap = new Map(onlinePlayers.map(p => [p.playerId, p]));
    const friendsMap = new Map(gameFriends.map(f => [f.followedId, f]));
    const ids = new Set<string>();
    const list: { id: string; name: string; avatarColor?: string; isFriend: boolean; isOnline: boolean; roomCode?: string | null }[] = [];
    for (const f of gameFriends) {
      if (f.followedId === player.id || ids.has(f.followedId)) continue;
      ids.add(f.followedId);
      list.push({
        id: f.followedId,
        name: f.followedName,
        avatarColor: f.followedAvatarColor,
        isFriend: true,
        isOnline: !!onlineMap.get(f.followedId),
        roomCode: onlineMap.get(f.followedId)?.roomCode ?? null,
      });
    }
    for (const p of onlinePlayers) {
      if (p.playerId === player.id || ids.has(p.playerId)) continue;
      ids.add(p.playerId);
      list.push({
        id: p.playerId,
        name: p.name,
        avatarColor: p.avatarColor,
        isFriend: !!friendsMap.get(p.playerId),
        isOnline: true,
        roomCode: p.roomCode,
      });
    }
    return list;
  })();

  // ── Home ─────────────────────────────────────────────────────────────────
  if (view === "home") return (
    <div className="min-h-screen flex flex-col" style={{ background: "#060318" }}>
      <div className="flex items-center gap-3 p-4 border-b border-white/5">
        <button onClick={() => navigate("/")} className="p-2 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-white font-black text-lg">Modo Torneo</h1>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="w-24 h-24 rounded-full flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #f59e0b, #dc2626)" }}
        >
          <Trophy className="w-12 h-12 text-white" />
        </motion.div>
        <div className="text-center">
          <h2 className="text-white font-black text-2xl mb-2">Torneo STOP</h2>
          <p className="text-white/50 text-sm max-w-xs">
            Compite en brackets eliminatorios de 4 u 8 jugadores. Un campeón se coronará.
          </p>
        </div>
        <div className="flex flex-col gap-3 w-full max-w-xs">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setView("create")}
            className="w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-3"
            style={{ background: "linear-gradient(135deg, #f59e0b, #dc2626)" }}
          >
            <Plus className="w-5 h-5" />
            Crear Torneo
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => setView("join")}
            className="w-full py-4 rounded-2xl font-black border border-white/20 text-white flex items-center justify-center gap-3"
            style={{ background: "rgba(255,255,255,0.05)" }}
          >
            <LogIn className="w-5 h-5" />
            Unirse con Código
          </motion.button>
        </div>
      </div>
    </div>
  );

  // ── Create ────────────────────────────────────────────────────────────────
  if (view === "create") return (
    <div className="min-h-screen flex flex-col" style={{ background: "#060318" }}>
      <div className="flex items-center gap-3 p-4 border-b border-white/5">
        <button onClick={() => setView("home")} className="p-2 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-white font-black text-lg">Crear Torneo</h1>
      </div>
      <div className="flex-1 flex flex-col p-6 gap-5 max-w-md mx-auto w-full">
        <div>
          <label className="text-white/60 text-xs font-bold mb-1.5 block">NOMBRE DEL TORNEO</label>
          <input
            value={tName}
            onChange={e => setTName(e.target.value)}
            placeholder="Ej: Liga del Barrio"
            maxLength={40}
            className="w-full px-4 py-3 rounded-xl text-white font-bold outline-none"
            style={{ background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.12)" }}
          />
        </div>
        <div>
          <label className="text-white/60 text-xs font-bold mb-1.5 block">NÚMERO DE JUGADORES</label>
          <div className="flex gap-3">
            {([4, 8] as const).map(n => (
              <button
                key={n}
                onClick={() => setTSize(n)}
                className="flex-1 py-3 rounded-xl font-black text-lg transition-all"
                style={{
                  background: tSize === n ? "linear-gradient(135deg, #f59e0b, #dc2626)" : "rgba(255,255,255,0.07)",
                  color: tSize === n ? "#fff" : "rgba(255,255,255,0.4)",
                  border: tSize === n ? "none" : "1.5px solid rgba(255,255,255,0.12)",
                }}
              >
                {n} jugadores
              </button>
            ))}
          </div>
        </div>
        <div className="p-4 rounded-xl" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
          <p className="text-amber-300 text-xs font-bold">📋 Formato</p>
          <p className="text-amber-200/70 text-xs mt-1">
            {tSize === 4 ? "2 semifinales + 1 final = 3 partidas por campeón" : "4 cuartos + 2 semis + 1 final = 7 partidas por campeón"}
          </p>
        </div>
        {error && <p className="text-red-400 text-sm text-center font-bold">{error}</p>}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={createTournament}
          disabled={loading || !tName.trim()}
          className="w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-2 mt-auto disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #f59e0b, #dc2626)" }}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trophy className="w-5 h-5" />}
          Crear Torneo
        </motion.button>
      </div>
    </div>
  );

  // ── Join ──────────────────────────────────────────────────────────────────
  if (view === "join") return (
    <div className="min-h-screen flex flex-col" style={{ background: "#060318" }}>
      <div className="flex items-center gap-3 p-4 border-b border-white/5">
        <button onClick={() => setView("home")} className="p-2 rounded-full hover:bg-white/10 transition-colors">
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <h1 className="text-white font-black text-lg">Unirse al Torneo</h1>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-5 max-w-md mx-auto w-full">
        <Swords className="w-16 h-16 text-amber-400 opacity-60" />
        <div className="w-full">
          <label className="text-white/60 text-xs font-bold mb-1.5 block">CÓDIGO DE TORNEO</label>
          <input
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="XXXXXX"
            maxLength={6}
            className="w-full px-4 py-4 rounded-xl text-white font-black text-center text-2xl tracking-widest outline-none"
            style={{ background: "rgba(255,255,255,0.07)", border: "1.5px solid rgba(255,255,255,0.12)" }}
          />
        </div>
        {error && <p className="text-red-400 text-sm text-center font-bold">{error}</p>}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={joinTournament}
          disabled={loading || joinCode.length < 4}
          className="w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-2 disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #f59e0b, #dc2626)" }}
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
          Unirse
        </motion.button>
      </div>
    </div>
  );

  // ── Lobby ─────────────────────────────────────────────────────────────────
  if (view === "lobby" && tournament) {
    const isHost = player?.id === tournament.hostId;
    const canStart = tournament.players.length === tournament.size;

    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#060318" }}>
        <div className="flex items-center gap-3 p-4 border-b border-white/5">
          <button onClick={() => { setTournament(null); setView("home"); }} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-black text-lg leading-tight">{tournament.name}</h1>
            <p className="text-white/40 text-xs">Sala de espera</p>
          </div>
        </div>

        <div className="flex-1 flex flex-col p-5 gap-5 max-w-md mx-auto w-full">
          {/* Code share */}
          <div className="p-4 rounded-2xl text-center" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)" }}>
            <p className="text-white/40 text-xs font-bold mb-1">CÓDIGO DE TORNEO</p>
            <p className="text-white font-black text-4xl tracking-widest mb-2">{tournament.code}</p>
            <button
              onClick={copyCode}
              className="flex items-center gap-1.5 mx-auto text-xs font-bold px-3 py-1.5 rounded-full transition-colors"
              style={{ background: copied ? "rgba(74,222,128,0.15)" : "rgba(255,255,255,0.08)", color: copied ? "#4ade80" : "rgba(255,255,255,0.5)" }}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "¡Copiado!" : "Copiar código"}
            </button>
            <div className="mt-3 flex flex-wrap gap-2 justify-center">
              <button
                onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(getInviteText())}`, "_blank")}
                className="px-3 py-2 rounded-full text-xs font-black text-white flex items-center gap-1.5"
                style={{ background: "#25D366" }}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                WhatsApp
              </button>
              <button
                onClick={() => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(getInviteText())}`, "_blank")}
                className="px-3 py-2 rounded-full text-xs font-black text-white flex items-center gap-1.5"
                style={{ background: "#1DA1F2" }}
              >
                <Send className="w-3.5 h-3.5" />
                X
              </button>
              <button
                onClick={shareTournament}
                className="px-3 py-2 rounded-full text-xs font-black text-white flex items-center gap-1.5"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.12)" }}
              >
                <Share2 className="w-3.5 h-3.5" />
                Compartir
              </button>
            </div>
            <p className="text-[10px] text-white/30 mt-2">Comparte el código o el enlace para que tus amigos entren al torneo.</p>
          </div>

          <div className="p-4 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/60 text-xs font-bold">INVITAR DENTRO DEL JUEGO</p>
              <p className="text-white/30 text-[11px]">{onlinePlayers.length} online</p>
            </div>
            <div className="max-h-52 overflow-y-auto flex flex-col gap-2">
              {tournamentInviteTargets.slice(0, 12).map((p) => {
                const already = invitedIds.has(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => inviteToTournament(p.id, p.name)}
                    className="flex items-center gap-3 p-3 rounded-xl text-left"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-black" style={{ background: p.avatarColor || "#555" }}>
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm truncate">{p.name}</p>
                      <p className="text-white/35 text-[11px]">{p.isFriend ? "Amigo" : p.roomCode ? "En partida" : p.isOnline ? "Online" : "Desconectado"}</p>
                    </div>
                    <span className="text-xs font-black px-3 py-1.5 rounded-full" style={{ background: already ? "rgba(74,222,128,0.15)" : "rgba(249,168,37,0.12)", color: already ? "#4ade80" : "#f9a825" }}>
                      {already ? "Invitado" : "Invitar"}
                    </span>
                  </button>
                );
              })}
              {tournamentInviteTargets.length === 0 && (
                <p className="text-center text-white/30 text-xs py-3">No hay jugadores online ahora mismo</p>
              )}
            </div>
          </div>

          {/* Players list */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/60 text-xs font-bold">JUGADORES</p>
              <p className="text-white/40 text-xs">{tournament.players.length}/{tournament.size}</p>
            </div>
            <div className="flex flex-col gap-2">
              {Array.from({ length: tournament.size }).map((_, i) => {
                const p = tournament.players[i];
                return (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{ background: p ? "rgba(245,158,11,0.1)" : "rgba(255,255,255,0.03)", border: `1px solid ${p ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.06)"}` }}
                  >
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black"
                      style={{ background: p ? "linear-gradient(135deg, #f59e0b, #dc2626)" : "rgba(255,255,255,0.05)", color: "#fff" }}
                    >
                      {p ? p.playerName[0].toUpperCase() : i + 1}
                    </div>
                    <span className={`font-bold text-sm ${p ? "text-white" : "text-white/20"}`}>
                      {p ? p.playerName : "Esperando jugador..."}
                    </span>
                    {p?.playerId === tournament.hostId && (
                      <span className="ml-auto text-[10px] font-black px-2 py-0.5 rounded-full" style={{ background: "rgba(245,158,11,0.2)", color: "#f59e0b" }}>HOST</span>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {error && <p className="text-red-400 text-sm text-center font-bold">{error}</p>}

          {isHost && (
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={startTournament}
              disabled={loading || !canStart}
              className="w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-2 mt-auto disabled:opacity-50"
              style={{ background: canStart ? "linear-gradient(135deg, #f59e0b, #dc2626)" : "rgba(255,255,255,0.1)" }}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
              {canStart ? "¡Iniciar Torneo!" : `Faltan ${tournament.size - tournament.players.length} jugadores`}
            </motion.button>
          )}
          {!isHost && (
            <div className="py-4 rounded-2xl flex items-center justify-center gap-2 mt-auto" style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Loader2 className="w-4 h-4 animate-spin text-white/30" />
              <span className="text-white/40 text-sm font-bold">Esperando que el host inicie...</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Bracket ───────────────────────────────────────────────────────────────
  if (view === "bracket" && tournament?.bracket) {
    const bracket = tournament.bracket;
    const roundNames = tournament.size === 4
      ? ["Semifinales", "Final"]
      : ["Cuartos", "Semifinales", "Final"];

    return (
      <div className="min-h-screen flex flex-col" style={{ background: "#060318" }}>
        <div className="flex items-center gap-3 p-4 border-b border-white/5">
          <button onClick={() => navigate("/")} className="p-2 rounded-full hover:bg-white/10 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex-1">
            <h1 className="text-white font-black text-lg leading-tight">{tournament.name}</h1>
            <p className="text-white/40 text-xs">
              {bracket.champion ? "🏆 Torneo Completado" : `Ronda ${bracket.currentRound + 1} · ${roundNames[bracket.currentRound] ?? "Bracket"}`}
            </p>
          </div>
          <span className="text-[11px] font-black px-2.5 py-1 rounded-full" style={{ background: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
            {tournament.code}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Champion banner */}
          <AnimatePresence>
            {bracket.champion && (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="mb-5 p-6 rounded-2xl text-center"
                style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(220,38,38,0.2))", border: "2px solid rgba(245,158,11,0.4)" }}
              >
                <p className="text-4xl mb-2">🏆</p>
                <p className="text-amber-300 text-xs font-bold mb-1">CAMPEÓN</p>
                <p className="text-white font-black text-2xl">{bracket.champion.name}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Rounds */}
          {bracket.rounds.map((round, rIdx) => (
            <div key={rIdx} className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
                <p className="text-white/40 text-xs font-bold px-2">
                  {roundNames[rIdx] ?? `Ronda ${rIdx + 1}`}
                </p>
                <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
              </div>
              <div className="flex flex-col gap-3">
                {round.map((match) => {
                  const isCurrentRound = rIdx === bracket.currentRound;
                  const iAmPlayer = player && (match.p1Id === player.id || match.p2Id === player.id);
                  const canPlay = isCurrentRound && match.status === "pending" && match.p1Id && match.p2Id;
                  const isPlaying = match.status === "playing";
                  const isDone = match.status === "done";

                  return (
                    <motion.div
                      key={match.id}
                      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                      className="rounded-2xl overflow-hidden"
                      style={{
                        background: isDone ? "rgba(74,222,128,0.05)" : isPlaying ? "rgba(245,158,11,0.08)" : "rgba(255,255,255,0.04)",
                        border: `1.5px solid ${isDone ? "rgba(74,222,128,0.25)" : isPlaying ? "rgba(245,158,11,0.3)" : "rgba(255,255,255,0.08)"}`,
                      }}
                    >
                      {/* Match players */}
                      {[
                        { id: match.p1Id, name: match.p1Name, isWinner: match.winnerId === match.p1Id },
                        { id: match.p2Id, name: match.p2Name, isWinner: match.winnerId === match.p2Id },
                      ].map((pl, pi) => (
                        <div
                          key={pi}
                          className={`flex items-center gap-3 px-4 py-2.5 ${pi === 0 ? "border-b border-white/5" : ""}`}
                          style={{ background: pl.isWinner ? "rgba(74,222,128,0.08)" : "transparent" }}
                        >
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0"
                            style={{ background: pl.id ? "linear-gradient(135deg, #f59e0b80, #dc262680)" : "rgba(255,255,255,0.05)", color: "#fff" }}
                          >
                            {pl.id ? pl.name[0].toUpperCase() : "?"}
                          </div>
                          <span className={`flex-1 font-bold text-sm ${pl.id ? (pl.isWinner ? "text-green-300" : "text-white") : "text-white/20"}`}>
                            {pl.name}
                          </span>
                          {pl.isWinner && <Crown className="w-4 h-4 text-amber-400" />}
                        </div>
                      ))}

                      {/* Actions row */}
                      <div className="px-4 py-2.5 flex items-center justify-between">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                          isDone ? "bg-green-500/15 text-green-400" :
                          isPlaying ? "bg-amber-500/15 text-amber-400" :
                          "bg-white/5 text-white/25"
                        }`}>
                          {isDone ? "✓ Finalizado" : isPlaying ? "⚡ En juego" : "Pendiente"}
                        </span>

                        {canPlay && iAmPlayer && !isPlaying && (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => startMatch(match)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black text-white"
                            style={{ background: "linear-gradient(135deg, #f59e0b, #dc2626)" }}
                          >
                            <Swords className="w-3.5 h-3.5" />
                            Jugar
                          </motion.button>
                        )}
                        {isPlaying && match.roomCode && iAmPlayer && (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => navigate(`/room/${match.roomCode}?torneo=${tournament.code}&match=${match.id}`)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black text-white"
                            style={{ background: "rgba(245,158,11,0.25)", border: "1px solid rgba(245,158,11,0.4)" }}
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                            Ver sala
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#060318" }}>
      <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
    </div>
  );
}
