import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { apiFetch } from "./api";
import type { StopSession } from "./auth";

type Player = { playerId: string; playerName: string; avatarColor?: string | null; score?: number; roundScore?: number; isHost?: boolean; isReady?: boolean };
type Room = {
  roomCode: string; hostId: string; hostName: string; status: string; currentLetter?: string | null; currentRound?: number | null;
  maxRounds?: number; maxPlayers?: number; gameMode?: string; language?: string; players?: Player[];
  roundStartedAt?: number | null; roundEndsAt?: number | null; roundDurationSecs?: number; stopper?: { id: string; name: string } | null;
};

const CATEGORIES = ["Nombre", "Lugar", "Animal", "Objeto", "Color", "Fruta", "Marca"];

type Props = { session: StopSession; onExit: () => void; onRoomStarted?: (room: Room) => void };

export function MultiplayerScreen({ session, onExit }: Props) {
  const [code, setCode] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerId = session.user.id;
  const playerName = session.user.name || "Jugador STOP";
  const me = room?.players?.find(p => p.playerId === playerId);
  const letter = (room?.currentLetter || "A").toUpperCase();

  const refreshRoom = useCallback(async (roomCode: string) => {
    try {
      const data = await apiFetch<Room>(`/api/rooms/${encodeURIComponent(roomCode)}?viewerId=${encodeURIComponent(playerId)}`);
      setRoom(data);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar la sala.");
      return null;
    }
  }, [playerId]);

  useEffect(() => {
    if (!room?.roomCode) return;
    const timer = setInterval(() => { void refreshRoom(room.roomCode); }, 1500);
    return () => clearInterval(timer);
  }, [room?.roomCode, refreshRoom]);

  useEffect(() => {
    if (room?.status !== "playing" || submitted) return;
    const tick = () => {
      const end = room.roundEndsAt ?? Date.now() + (room.roundDurationSecs ?? 60) * 1000;
      const remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) void submitResults();
    };
    tick();
    const timer = setInterval(tick, 500);
    return () => clearInterval(timer);
  }, [room?.status, room?.roundEndsAt, room?.roundDurationSecs, submitted]);

  useEffect(() => {
    if (room?.status === "waiting") {
      setSubmitted(false);
      setAnswers({});
      setSecondsLeft(room.roundDurationSecs ?? 60);
    }
    if (room?.status === "playing" && !room.roundStartedAt) setSecondsLeft(room.roundDurationSecs ?? 60);
  }, [room?.status, room?.currentRound]);

  async function createRoom() {
    setBusy(true); setError(null);
    try {
      const created = await apiFetch<Room>("/api/rooms", { method: "POST", body: JSON.stringify({
        hostId: playerId, hostName: playerName, avatarColor: null, maxRounds: 3, language: "es",
        loginMethod: session.user.loginMethod ?? null, isPublic: false, gameMode: "classic", maxPlayers: 8,
      }) });
      setRoom(created); setCode(created.roomCode);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo crear la sala."); }
    finally { setBusy(false); }
  }

  async function joinRoom() {
    const roomCode = code.trim().toUpperCase();
    if (!roomCode) return;
    setBusy(true); setError(null);
    try {
      const joined = await apiFetch<Room>(`/api/rooms/${encodeURIComponent(roomCode)}/join`, { method: "POST", body: JSON.stringify({ playerId, playerName, avatarColor: null, loginMethod: session.user.loginMethod ?? null }) });
      setRoom(joined); setCode(joined.roomCode);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo entrar en la sala."); }
    finally { setBusy(false); }
  }

  async function startGame() {
    if (!room || room.hostId !== playerId) return;
    setBusy(true); setError(null);
    try { const started = await apiFetch<Room>(`/api/rooms/${encodeURIComponent(room.roomCode)}/start`, { method: "POST", body: JSON.stringify({ hostId: playerId }) }); setRoom(started); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo iniciar la partida."); }
    finally { setBusy(false); }
  }

  async function stopRound() {
    if (!room || submitted || room.status !== "playing") return;
    setBusy(true); setError(null);
    try {
      const stopped = await apiFetch<Room>(`/api/rooms/${encodeURIComponent(room.roomCode)}/stop`, { method: "POST", body: JSON.stringify({ playerId, playerName }) });
      setRoom(stopped);
      await submitResults(stopped);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo detener la ronda."); }
    finally { setBusy(false); }
  }

  async function submitResults(sourceRoom?: Room) {
    const active = sourceRoom ?? room;
    if (!active || submitted || (active.status !== "playing" && active.status !== "stopped")) return;
    setSubmitted(true); setBusy(true);
    try {
      const updated = await apiFetch<Room>(`/api/rooms/${encodeURIComponent(active.roomCode)}/results`, { method: "POST", body: JSON.stringify({ playerId, answers, bluffedCategories: [], bluffedWords: {} }) });
      setRoom(updated);
      setAnswers({});
    } catch (e) { setSubmitted(false); setError(e instanceof Error ? e.message : "No se pudieron enviar tus respuestas."); }
    finally { setBusy(false); }
  }

  async function leaveRoom() {
    if (room) { try { await apiFetch(`/api/rooms/${encodeURIComponent(room.roomCode)}/leave`, { method: "POST", body: JSON.stringify({ playerId }) }); } catch {} }
    onExit();
  }

  const orderedPlayers = useMemo(() => [...(room?.players ?? [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)), [room?.players]);

  if (room?.status === "playing" || room?.status === "stopped" || room?.status === "bluffvoting") {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.gameHeader}><View><Text style={styles.round}>Ronda {room.currentRound ?? 1}/{room.maxRounds ?? 3}</Text><Text style={styles.letter}>{letter}</Text></View><View style={styles.timer}><Text style={styles.timerValue}>{room.status === "stopped" ? "STOP" : `${secondsLeft}s`}</Text></View></View>
          <Text style={styles.hint}>Escribe palabras que empiecen por {letter}</Text>
          {room.status === "bluffvoting" ? <Text style={styles.waiting}>⚖️ Revisando respuestas…</Text> : CATEGORIES.map(category => (
            <View key={category} style={styles.answerRow}><Text style={styles.category}>{category}</Text><TextInput value={answers[category] ?? ""} onChangeText={value => setAnswers(prev => ({ ...prev, [category]: value }))} editable={!submitted && room.status === "playing"} autoCapitalize="words" placeholder={`${letter}…`} style={styles.answerInput}/></View>
          ))}
          {room.status === "playing" && <TouchableOpacity style={styles.stopButton} disabled={busy || submitted} onPress={stopRound}><Text style={styles.stopText}>{submitted ? "Enviando…" : "🛑 STOP"}</Text></TouchableOpacity>}
          {room.status === "stopped" && <Text style={styles.waiting}>{submitted ? "✓ Respuestas enviadas. Esperando a los demás…" : "Enviando respuestas…"}</Text>}
          <Text style={styles.section}>Marcador</Text>
          {orderedPlayers.map(p => <View key={p.playerId} style={styles.player}><Text style={styles.playerName}>{p.playerName}{p.playerId === playerId ? " (tú)" : ""}</Text><Text style={styles.score}>{p.score ?? 0}</Text></View>)}
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.back} onPress={leaveRoom}><Text style={styles.backText}>Salir de la partida</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (room) {
    return (
      <SafeAreaView style={styles.safe}><View style={styles.container}>
        <Text style={styles.title}>Sala {room.roomCode}</Text>
        <Text style={styles.subtitle}>⏳ Esperando jugadores</Text>
        <View style={styles.code}><Text style={styles.codeLabel}>CÓDIGO</Text><Text style={styles.codeValue}>{room.roomCode}</Text></View>
        <Text style={styles.section}>Jugadores {room.players?.length ?? 0}/{room.maxPlayers ?? 8}</Text>
        {(room.players ?? []).map(p => <View key={p.playerId} style={styles.player}><Text style={styles.playerName}>{p.playerName}</Text><Text>{p.playerId === room.hostId ? "👑" : "✓"}</Text></View>)}
        {room.hostId === playerId && <TouchableOpacity style={styles.primary} disabled={busy || (room.players?.length ?? 0) < 1} onPress={startGame}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>▶ Empezar partida</Text>}</TouchableOpacity>}
        {error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity style={styles.secondary} onPress={leaveRoom}><Text style={styles.secondaryText}>Salir de la sala</Text></TouchableOpacity>
      </View></SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}><View style={styles.container}>
      <Text style={styles.title}>Multijugador</Text><Text style={styles.subtitle}>Juega con iPhone, Android y Web en la misma sala.</Text>
      <TouchableOpacity style={styles.primary} disabled={busy} onPress={createRoom}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>＋ Crear sala</Text>}</TouchableOpacity>
      <View style={styles.separator}><View style={styles.line}/><Text style={styles.or}>o</Text><View style={styles.line}/></View>
      <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} maxLength={6} placeholder="CÓDIGO DE SALA" style={styles.input}/>
      <TouchableOpacity style={styles.secondary} disabled={busy || code.trim().length < 4} onPress={joinRoom}><Text style={styles.secondaryText}>Entrar en sala</Text></TouchableOpacity>
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={styles.back} onPress={onExit}><Text style={styles.backText}>Volver</Text></TouchableOpacity>
    </View></SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f8fc" }, container: { flex: 1, padding: 20 }, title: { fontSize: 32, fontWeight: "900", color: "#151f63" }, subtitle: { fontSize: 15, color: "#5d6170", marginTop: 8, marginBottom: 18 }, primary: { minHeight: 52, borderRadius: 14, backgroundColor: "#151f63", alignItems: "center", justifyContent: "center", marginTop: 14 }, primaryText: { color: "#fff", fontSize: 17, fontWeight: "800" }, secondary: { minHeight: 50, borderRadius: 14, backgroundColor: "#e9ebf2", alignItems: "center", justifyContent: "center", marginTop: 12 }, secondaryText: { color: "#151f63", fontSize: 16, fontWeight: "800" }, separator: { flexDirection: "row", alignItems: "center", marginVertical: 20 }, line: { flex: 1, height: 1, backgroundColor: "#dfe2eb" }, or: { marginHorizontal: 12, color: "#777b89", fontWeight: "700" }, input: { height: 54, borderWidth: 1, borderColor: "#d4d7e1", borderRadius: 14, backgroundColor: "#fff", paddingHorizontal: 16, fontSize: 20, fontWeight: "800", letterSpacing: 3, textAlign: "center" }, code: { marginVertical: 16, backgroundColor: "#151f63", borderRadius: 18, padding: 18, alignItems: "center" }, codeLabel: { color: "#fff", opacity: 0.7, fontSize: 11, fontWeight: "800", letterSpacing: 2 }, codeValue: { color: "#fff", fontSize: 34, fontWeight: "900", letterSpacing: 5, marginTop: 4 }, section: { fontSize: 18, fontWeight: "800", marginTop: 16, marginBottom: 9 }, player: { backgroundColor: "#fff", borderRadius: 12, padding: 13, marginBottom: 7, flexDirection: "row", justifyContent: "space-between" }, playerName: { fontSize: 16, fontWeight: "700" }, score: { fontSize: 16, fontWeight: "800" }, gameHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" }, round: { color: "#5d6170", fontWeight: "700" }, letter: { fontSize: 50, fontWeight: "900", color: "#151f63" }, timer: { minWidth: 80, paddingVertical: 12, paddingHorizontal: 10, borderRadius: 14, backgroundColor: "#151f63", alignItems: "center" }, timerValue: { color: "#fff", fontWeight: "900", fontSize: 18 }, hint: { color: "#5d6170", marginBottom: 12 }, answerRow: { flexDirection: "row", alignItems: "center", marginBottom: 8 }, category: { width: 72, fontSize: 13, fontWeight: "800" }, answerInput: { flex: 1, height: 44, backgroundColor: "#fff", borderWidth: 1, borderColor: "#d4d7e1", borderRadius: 10, paddingHorizontal: 12, fontSize: 15 }, stopButton: { minHeight: 54, borderRadius: 14, backgroundColor: "#c62828", alignItems: "center", justifyContent: "center", marginTop: 8 }, stopText: { color: "#fff", fontSize: 18, fontWeight: "900" }, waiting: { textAlign: "center", color: "#5d6170", fontWeight: "700", paddingVertical: 12 }, error: { color: "#b42318", textAlign: "center", marginTop: 12 }, back: { alignItems: "center", marginTop: 14, padding: 10 }, backText: { color: "#5d6170", fontWeight: "700" }, });
