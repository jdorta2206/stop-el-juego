import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, Share, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { apiFetch } from "./api";
import type { StopSession } from "./auth";

type Player = { playerId: string; playerName: string; avatarColor?: string | null; score?: number; roundScore?: number; isHost?: boolean; isReady?: boolean; finishedAt?: number };
type Room = { roomCode: string; hostId: string; hostName: string; status: string; currentLetter?: string | null; currentRound?: number | null; maxRounds?: number; maxPlayers?: number; gameMode?: string; language?: string; players?: Player[]; roundStartedAt?: number | null; roundEndsAt?: number | null; roundDurationSecs?: number; serverNow?: number; stopper?: { id?: string; name?: string; stopTimestamp?: number } | null };
const CATEGORIES = [
  { key: "nombre", label: "Nombre" }, { key: "animal", label: "Animal" }, { key: "lugar", label: "Lugar" },
  { key: "objeto", label: "Objeto" }, { key: "marca", label: "Marca" }, { key: "color", label: "Color" }, { key: "fruta", label: "Fruta" },
];
const errorMessage = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback;

export function MultiplayerScreen({ session, onExit }: { session: StopSession; onExit: () => void }) {
  const [code, setCode] = useState(""); const [room, setRoom] = useState<Room | null>(null); const [answers, setAnswers] = useState<Record<string, string>>({});
  const [seconds, setSeconds] = useState(0); const [busy, setBusy] = useState(false); const [submitted, setSubmitted] = useState(false); const [error, setError] = useState<string | null>(null); const [roundKey, setRoundKey] = useState("");
  const player = useMemo(() => ({ playerId: session.user.id, playerName: session.user.name || "Jugador STOP", avatarColor: null, loginMethod: session.user.loginMethod ?? null }), [session]);
  const isHost = room?.hostId === player.playerId;

  const refreshRoom = useCallback(async (roomCode: string) => {
    try { const data = await apiFetch<Room>(`/api/rooms/${encodeURIComponent(roomCode)}?viewerId=${encodeURIComponent(player.playerId)}`); setRoom(data); return data; }
    catch (e) { setError(errorMessage(e, "No se pudo actualizar la sala.")); return null; }
  }, [player.playerId]);

  useEffect(() => { if (!room?.roomCode) return; const timer = setInterval(() => { void refreshRoom(room.roomCode); }, 1000); return () => clearInterval(timer); }, [room?.roomCode, refreshRoom]);

  useEffect(() => {
    if (room?.status !== "playing" || !room.roundEndsAt) { setSeconds(0); return; }
    const tick = () => { const offset = (room.serverNow ?? Date.now()) - Date.now(); setSeconds(Math.max(0, Math.ceil((room.roundEndsAt! - (Date.now() + offset)) / 1000))); };
    tick(); const timer = setInterval(tick, 250); return () => clearInterval(timer);
  }, [room?.status, room?.roundEndsAt, room?.serverNow]);

  useEffect(() => {
    if (!room?.currentRound || room.status !== "playing") return;
    const expected = `${room.roomCode}:${room.currentRound}`;
    if (roundKey !== expected) { setRoundKey(expected); setAnswers({}); setSubmitted(false); setError(null); }
  }, [room?.roomCode, room?.currentRound, room?.status, roundKey]);

  useEffect(() => { if (room?.status === "playing" && seconds === 0 && !submitted && !busy) void submitResults(false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [seconds, room?.status, submitted, busy]);

  async function createRoom() {
    setBusy(true); setError(null);
    try { const created = await apiFetch<Room>("/api/rooms", { method: "POST", body: JSON.stringify({ hostId: player.playerId, hostName: player.playerName, avatarColor: player.avatarColor, maxRounds: 3, language: "es", loginMethod: player.loginMethod, isPublic: false, gameMode: "classic", maxPlayers: 8 }) }); setRoom(created); setCode(created.roomCode); }
    catch (e) { setError(errorMessage(e, "No se pudo crear la sala.")); } finally { setBusy(false); }
  }
  async function joinRoom() {
    const roomCode = code.trim().toUpperCase(); if (!roomCode) return; setBusy(true); setError(null);
    try { const joined = await apiFetch<Room>(`/api/rooms/${encodeURIComponent(roomCode)}/join`, { method: "POST", body: JSON.stringify(player) }); setRoom(joined); setCode(joined.roomCode); }
    catch (e) { setError(errorMessage(e, "No se pudo entrar en la sala.")); } finally { setBusy(false); }
  }
  async function shareRoom() {
    if (!room?.roomCode) return;
    try {
      await Share.share({
        title: "Únete a mi partida de STOP",
        message: `🎮 ¡Únete a mi partida de STOP!\n\nCódigo de sala: ${room.roomCode}\n\nJuega conmigo desde iPhone, Android o Web.`,
      });
    } catch (e) {
      setError(errorMessage(e, "No se pudo abrir el menú de compartir."));
    }
  }
  async function startRound() {
    if (!room || !isHost) return; setBusy(true); setError(null);
    try { const started = await apiFetch<Room>(`/api/rooms/${encodeURIComponent(room.roomCode)}/start`, { method: "POST", body: JSON.stringify({ hostId: player.playerId }) }); setRoom(started); setAnswers({}); setSubmitted(false); setRoundKey(`${started.roomCode}:${started.currentRound}`); }
    catch (e) { setError(errorMessage(e, "No se pudo iniciar la ronda.")); } finally { setBusy(false); }
  }
  async function submitResults(stopFirst = true) {
    if (!room || submitted || busy || room.status !== "playing") return; setBusy(true); setError(null);
    try {
      let currentRoom = room;
      if (stopFirst) currentRoom = await apiFetch<Room>(`/api/rooms/${encodeURIComponent(room.roomCode)}/stop`, { method: "POST", body: JSON.stringify({ playerId: player.playerId, playerName: player.playerName }) });
      const data = await apiFetch<Room>(`/api/rooms/${encodeURIComponent(room.roomCode)}/results`, { method: "POST", body: JSON.stringify({ playerId: player.playerId, answers, bluffedCategories: [], bluffedWords: {} }) });
      setSubmitted(true); setRoom(data.status ? data : currentRoom);
    } catch (e) { setError(errorMessage(e, "No se pudieron enviar las respuestas.")); } finally { setBusy(false); }
  }

  if (room?.status === "playing" || room?.status === "stopped") return (
    <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.gameContainer} keyboardShouldPersistTaps="handled">
      <View style={styles.topBar}><TouchableOpacity onPress={onExit}><Text style={styles.backText}>‹ Salir</Text></TouchableOpacity><Text style={styles.round}>Ronda {room.currentRound}/{room.maxRounds}</Text><Text style={[styles.timer, seconds <= 10 && styles.timerDanger]}>{room.status === "stopped" ? "STOP" : `${seconds}s`}</Text></View>
      <View style={styles.letterCard}><Text style={styles.letterLabel}>LETRA</Text><Text style={styles.letter}>{room.currentLetter ?? "?"}</Text></View>
      <Text style={styles.title}>¡Escribe una palabra por categoría!</Text>
      {room.status === "stopped" && <Text style={styles.stopped}>🛑 {room.stopper?.name || "Un jugador"} ha pulsado STOP</Text>}
      {CATEGORIES.map(c => <View key={c.key} style={styles.field}><Text style={styles.category}>{c.label}</Text><TextInput value={answers[c.key] ?? ""} editable={!submitted && room.status === "playing" && !busy} onChangeText={value => setAnswers(current => ({ ...current, [c.key]: value }))} placeholder={`Empieza por ${room.currentLetter ?? "?"}…`} autoCapitalize="sentences" autoCorrect={false} style={styles.input} /></View>)}
      {error && <Text style={styles.error}>{error}</Text>}
      {!submitted && room.status === "playing" && <TouchableOpacity style={styles.stopButton} disabled={busy} onPress={() => void submitResults(true)}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.stopText}>🛑 STOP</Text>}</TouchableOpacity>}
      {submitted && <View style={styles.waitCard}><Text style={styles.waitTitle}>✓ Respuestas enviadas</Text><Text style={styles.muted}>Esperando a los demás jugadores…</Text></View>}
    </ScrollView></SafeAreaView>
  );

  if (room?.status === "finished") {
    const ranked = [...(room.players ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container}><Text style={styles.emoji}>🏆</Text><Text style={styles.title}>¡Partida terminada!</Text><Text style={styles.subtitle}>Resultados finales</Text>{ranked.map((p, i) => <View key={p.playerId} style={[styles.player, i === 0 && styles.winner]}><Text style={styles.playerName}>{i + 1}. {p.playerName}</Text><Text style={styles.playerScore}>{p.score ?? 0} pts</Text></View>)}<TouchableOpacity style={styles.primary} onPress={onExit}><Text style={styles.primaryText}>Volver al inicio</Text></TouchableOpacity></ScrollView></SafeAreaView>;
  }

  if (room) return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.container}><Text style={styles.title}>Sala {room.roomCode}</Text><Text style={styles.subtitle}>Comparte el código con tus amigos.</Text><View style={styles.code}><Text style={styles.codeLabel}>CÓDIGO</Text><Text style={styles.codeValue}>{room.roomCode}</Text></View><TouchableOpacity style={styles.shareButton} onPress={() => void shareRoom}><Text style={styles.shareText}>📤 Compartir invitación</Text></TouchableOpacity><Text style={styles.section}>Jugadores {room.players?.length ?? 0}/{room.maxPlayers ?? 8}</Text>{(room.players ?? []).map(p => <View key={p.playerId} style={styles.player}><Text style={styles.playerName}>{p.playerName}</Text><Text>{p.playerId === room.hostId ? "👑" : "✓"}</Text></View>)}{isHost ? <TouchableOpacity style={styles.primary} disabled={busy} onPress={() => void startRound}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{room.currentRound && room.currentRound > 0 ? "Siguiente ronda" : "▶ Empezar partida"}</Text>}</TouchableOpacity> : <Text style={styles.waitText}>⏳ Esperando a que el anfitrión empiece…</Text>}{error && <Text style={styles.error}>{error}</Text>}<TouchableOpacity style={styles.back} onPress={onExit}><Text style={styles.backText}>Salir</Text></TouchableOpacity></ScrollView></SafeAreaView>;

  return <SafeAreaView style={styles.safe}><View style={styles.container}><Text style={styles.title}>Multijugador</Text><Text style={styles.subtitle}>Juega con iPhone, Android y Web en la misma sala.</Text><TouchableOpacity style={styles.primary} disabled={busy} onPress={() => void createRoom}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>＋ Crear sala</Text>}</TouchableOpacity><View style={styles.separator}><View style={styles.line}/><Text style={styles.or}>o</Text><View style={styles.line}/></View><TextInput value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} maxLength={6} placeholder="CÓDIGO DE SALA" style={styles.input}/><TouchableOpacity style={styles.secondary} disabled={busy || code.trim().length < 4} onPress={() => void joinRoom}><Text style={styles.secondaryText}>Entrar en sala</Text></TouchableOpacity>{error && <Text style={styles.error}>{error}</Text>}<TouchableOpacity style={styles.back} onPress={onExit}><Text style={styles.backText}>Volver</Text></TouchableOpacity></View></SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f8fc" }, container: { flexGrow: 1, padding: 24, justifyContent: "center" }, gameContainer: { padding: 20, paddingBottom: 45 },
  title: { fontSize: 28, fontWeight: "900", color: "#151f63", marginBottom: 8 }, subtitle: { fontSize: 15, color: "#5d6170", marginBottom: 20 },
  primary: { minHeight: 52, borderRadius: 14, backgroundColor: "#151f63", alignItems: "center", justifyContent: "center", marginTop: 16 }, primaryText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  secondary: { minHeight: 50, borderRadius: 14, backgroundColor: "#e9ebf2", alignItems: "center", justifyContent: "center", marginTop: 12 }, secondaryText: { color: "#151f63", fontSize: 16, fontWeight: "800" },
  shareButton: { minHeight: 48, borderRadius: 14, backgroundColor: "#e9ebf2", alignItems: "center", justifyContent: "center", marginBottom: 18 }, shareText: { color: "#151f63", fontSize: 16, fontWeight: "800" },
  separator: { flexDirection: "row", alignItems: "center", marginVertical: 20 }, line: { flex: 1, height: 1, backgroundColor: "#dfe2eb" }, or: { marginHorizontal: 12, color: "#777b89", fontWeight: "700" },
  input: { backgroundColor: "white", borderWidth: 1, borderColor: "#dfe2eb", borderRadius: 14, paddingHorizontal: 15, paddingVertical: 13, fontSize: 17 }, code: { marginVertical: 20, backgroundColor: "#151f63", borderRadius: 18, padding: 20, alignItems: "center" },
  codeLabel: { color: "#fff", opacity: 0.7, fontSize: 11, fontWeight: "800", letterSpacing: 2 }, codeValue: { color: "#fff", fontSize: 36, fontWeight: "900", letterSpacing: 5, marginTop: 4 }, section: { fontSize: 18, fontWeight: "800", marginBottom: 10 },
  player: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, winner: { borderWidth: 2, borderColor: "#151f63" }, playerName: { fontSize: 16, fontWeight: "700", flex: 1 }, playerScore: { fontSize: 16, fontWeight: "900" },
  topBar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }, backText: { fontSize: 16, fontWeight: "700", color: "#151f63" }, round: { fontWeight: "800", color: "#5d6170" }, timer: { fontSize: 20, fontWeight: "900" }, timerDanger: { color: "#b42318" },
  letterCard: { backgroundColor: "#151f63", borderRadius: 24, padding: 20, alignItems: "center", marginBottom: 18 }, letterLabel: { color: "white", opacity: 0.75, fontSize: 11, fontWeight: "800", letterSpacing: 2 }, letter: { color: "white", fontSize: 68, lineHeight: 78, fontWeight: "900" },
  field: { marginBottom: 12 }, category: { fontSize: 14, fontWeight: "800", marginBottom: 6 }, stopButton: { marginTop: 6, minHeight: 56, backgroundColor: "#151f63", borderRadius: 18, alignItems: "center", justifyContent: "center" }, stopText: { color: "white", fontSize: 20, fontWeight: "900" },
  stopped: { backgroundColor: "#fff3cd", padding: 12, borderRadius: 12, marginBottom: 14, fontWeight: "700", color: "#7a5b00" }, waitCard: { backgroundColor: "#fff", borderRadius: 16, padding: 18, marginTop: 12, alignItems: "center" }, waitTitle: { fontSize: 17, fontWeight: "900", color: "#151f63" }, waitText: { textAlign: "center", color: "#5d6170", marginVertical: 20, fontWeight: "700" }, muted: { color: "#656a79", marginTop: 7 }, error: { color: "#b42318", textAlign: "center", marginTop: 12, lineHeight: 20 }, back: { alignItems: "center", marginTop: 18, padding: 10 }, emoji: { fontSize: 54, marginBottom: 10, textAlign: "center" },
});
