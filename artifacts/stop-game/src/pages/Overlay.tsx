import { useEffect, useState } from "react";
import { useParams } from "wouter";
import { getApiUrl } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const API = getApiUrl();

// OBS Browser Source overlay — transparent background, big legible text.
// Suggested OBS size: 480 x 720, Custom CSS: body { background: transparent !important; }
export default function Overlay() {
  const params = useParams<{ code: string }>();
  const code = params.code?.toUpperCase();
  const [room, setRoom] = useState<any>(null);

  useEffect(() => {
    if (!code) return;
    let stop = false;
    document.body.style.background = "transparent";
    const fetchOnce = async () => {
      try {
        const r = await fetch(`${API}/api/rooms/${encodeURIComponent(code)}/spectate`);
        if (!r.ok) return;
        const data = await r.json();
        if (!stop) setRoom(data);
      } catch { /* ignore */ }
    };
    fetchOnce();
    const id = setInterval(fetchOnce, 1500);
    return () => { stop = true; clearInterval(id); document.body.style.background = ""; };
  }, [code]);

  if (!room) return null;
  const players = (room.players ?? []).slice().sort((a: any, b: any) => (b.score || 0) - (a.score || 0));

  return (
    <div style={{
      width: "100vw", minHeight: "100vh", padding: 16,
      fontFamily: "Inter, system-ui, sans-serif", color: "#fff",
      background: "transparent",
    }}>
      <div style={{
        background: "rgba(15,12,30,0.85)",
        border: "2px solid rgba(245,158,11,0.6)",
        borderRadius: 18,
        padding: "16px 18px",
        boxShadow: "0 12px 40px rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        maxWidth: 460,
      }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              width: 10, height: 10, borderRadius: "50%", background: "#ef4444",
              boxShadow: "0 0 12px rgba(239,68,68,0.8)",
            }} />
            <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 2, color: "#fca5a5" }}>EN VIVO · STOP</span>
          </div>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", fontWeight: 700 }}>
            R{room.currentRound}/{room.maxRounds}
          </span>
        </div>

        {/* Letter big */}
        {(room.status === "playing" || room.status === "stopping") && room.currentLetter && (
          <div style={{ textAlign: "center", margin: "8px 0 14px" }}>
            <p style={{ fontSize: 10, letterSpacing: 3, color: "rgba(255,255,255,0.55)", margin: 0, textTransform: "uppercase" }}>Letra</p>
            <AnimatePresence mode="wait">
              <motion.p key={room.currentLetter}
                initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0 }}
                style={{ fontSize: 78, fontWeight: 900, color: "#fbbf24", margin: 0, lineHeight: 1, textShadow: "0 4px 22px rgba(251,191,36,0.55)" }}>
                {room.currentLetter}
              </motion.p>
            </AnimatePresence>
            {room.status === "stopping" && (
              <p style={{ marginTop: 6, color: "#f0abfc", fontWeight: 900, fontSize: 14 }}>
                ¡STOP! {room.stopper?.stopperName ? `· ${room.stopper.stopperName}` : ""}
              </p>
            )}
          </div>
        )}
        {room.status === "revealing" && (
          <p style={{ textAlign: "center", color: "#67e8f9", fontWeight: 900, fontSize: 18, margin: "12px 0" }}>
            Revisando respuestas…
          </p>
        )}
        {room.status === "finished" && (
          <p style={{ textAlign: "center", color: "#fbbf24", fontWeight: 900, fontSize: 18, margin: "12px 0" }}>
            🏆 ¡Partida terminada!
          </p>
        )}

        {/* Scoreboard */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {players.slice(0, 8).map((p: any, i: number) => (
            <motion.div key={p.playerId} layout
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                display: "flex", alignItems: "center", gap: 10,
                padding: "6px 10px", borderRadius: 10,
                background: i === 0 ? "rgba(251,191,36,0.18)" : "rgba(255,255,255,0.05)",
                border: i === 0 ? "1px solid rgba(251,191,36,0.5)" : "1px solid rgba(255,255,255,0.08)",
              }}>
              <span style={{ width: 16, color: "rgba(255,255,255,0.45)", fontWeight: 900, fontSize: 13 }}>{i + 1}</span>
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: p.avatarColor, color: "#fff", fontWeight: 800, fontSize: 12,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{p.playerName?.charAt(0).toUpperCase()}</div>
              <p style={{ flex: 1, margin: 0, fontWeight: 700, fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {p.playerName}{p.isPremium && <span style={{ color: "#fbbf24", marginLeft: 4 }}>★</span>}
              </p>
              <p style={{ margin: 0, color: "#fbbf24", fontWeight: 900, fontSize: 16 }}>{p.score || 0}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
