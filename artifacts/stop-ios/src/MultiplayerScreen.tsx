import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { apiFetch } from "./api";
import type { StopSession } from "./auth";

type Player = { playerId: string; playerName: string; avatarColor?: string | null };
type Room = {
  roomCode: string;
  hostId: string;
  hostName: string;
  status: string;
  currentLetter?: string | null;
  currentRound?: number | null;
  maxRounds?: number;
  maxPlayers?: number;
  gameMode?: string;
  language?: string;
  players?: Player[];
  roundStartedAt?: number | null;
  roundEndsAt?: number | null;
  roundDurationSecs?: number;
};

export function MultiplayerScreen({ session, onExit, onRoomStarted }: { session: StopSession; onExit: () => void; onRoomStarted?: (room: Room) => void }) {
  const [code, setCode] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const player = {
    playerId: session.user.id,
    playerName: session.user.name || "Jugador STOP",
    avatarColor: null,
  };

  const refreshRoom = useCallback(async (roomCode: string) => {
    try {
      const data = await apiFetch<Room>(`/api/rooms/${encodeURIComponent(roomCode)}?viewerId=${encodeURIComponent(player.playerId)}`);
      setRoom(data);
      if (data.status === "playing") onRoomStarted?.(data);
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar la sala.");
      return null;
    }
  }, [player.playerId, onRoomStarted]);

  useEffect(() => {
    if (!room?.roomCode) return;
    const timer = setInterval(() => { void refreshRoom(room.roomCode); }, 2000);
    return () => clearInterval(timer);
  }, [room?.roomCode, refreshRoom]);

  async function createRoom() {
    setBusy(true); setError(null);
    try {
      const created = await apiFetch<Room>("/api/rooms", {
        method: "POST",
        body: JSON.stringify({
          hostId: player.playerId,
          hostName: player.playerName,
          avatarColor: player.avatarColor,
          maxRounds: 3,
          language: "es",
          loginMethod: session.user.loginMethod ?? null,
          isPublic: false,
          gameMode: "classic",
          maxPlayers: 8,
        }),
      });
      setRoom(created);
      setCode(created.roomCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo crear la sala.");
    } finally { setBusy(false); }
  }

  async function joinRoom() {
    const roomCode = code.trim().toUpperCase();
    if (!roomCode) return;
    setBusy(true); setError(null);
    try {
      const joined = await apiFetch<Room>(`/api/rooms/${encodeURIComponent(roomCode)}/join`, {
        method: "POST",
        body: JSON.stringify(player),
      });
      setRoom(joined);
      setCode(joined.roomCode);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo entrar en la sala.");
    } finally { setBusy(false); }
  }

  if (room) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.title}>Sala {room.roomCode}</Text>
          <Text style={styles.subtitle}>{room.status === "playing" ? "🎮 Partida en curso" : "⏳ Esperando jugadores"}</Text>
          <View style={styles.code}><Text style={styles.codeLabel}>CÓDIGO</Text><Text style={styles.codeValue}>{room.roomCode}</Text></View>
          <Text style={styles.section}>Jugadores {room.players?.length ?? 0}/{room.maxPlayers ?? 8}</Text>
          {(room.players ?? []).map((p) => (
            <View key={p.playerId} style={styles.player}><Text style={styles.playerName}>{p.playerName}</Text><Text>{p.playerId === room.hostId ? "👑" : "✓"}</Text></View>
          ))}
          {room.status === "playing" && <Text style={styles.info}>La ronda ha comenzado. El juego continuará en la pantalla de partida.</Text>}
          {error && <Text style={styles.error}>{error}</Text>}
          <TouchableOpacity style={styles.secondary} onPress={onExit}><Text style={styles.secondaryText}>Salir</Text></TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.title}>Multijugador</Text>
        <Text style={styles.subtitle}>Juega con iPhone, Android y Web en la misma sala.</Text>
        <TouchableOpacity style={styles.primary} disabled={busy} onPress={createRoom}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>＋ Crear sala</Text>}
        </TouchableOpacity>
        <View style={styles.separator}><View style={styles.line}/><Text style={styles.or}>o</Text><View style={styles.line}/></View>
        <TextInput value={code} onChangeText={setCode} autoCapitalize="characters" autoCorrect={false} maxLength={6} placeholder="CÓDIGO DE SALA" style={styles.input}/>
        <TouchableOpacity style={styles.secondary} disabled={busy || code.trim().length < 4} onPress={joinRoom}><Text style={styles.secondaryText}>Entrar en sala</Text></TouchableOpacity>
        {error && <Text style={styles.error}>{error}</Text>}
        <TouchableOpacity style={styles.back} onPress={onExit}><Text style={styles.backText}>Volver</Text></TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f8fc" },
  container: { flex: 1, padding: 24, justifyContent: "center" },
  title: { fontSize: 32, fontWeight: "900", color: "#151f63" },
  subtitle: { fontSize: 15, color: "#5d6170", marginTop: 8, marginBottom: 24 },
  primary: { minHeight: 52, borderRadius: 14, backgroundColor: "#151f63", alignItems: "center", justifyContent: "center" },
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  secondary: { minHeight: 50, borderRadius: 14, backgroundColor: "#e9ebf2", alignItems: "center", justifyContent: "center", marginTop: 12 },
  secondaryText: { color: "#151f63", fontSize: 16, fontWeight: "800" },
  separator: { flexDirection: "row", alignItems: "center", marginVertical: 20 },
  line: { flex: 1, height: 1, backgroundColor: "#dfe2eb" },
  or: { marginHorizontal: 12, color: "#777b89", fontWeight: "700" },
  input: { height: 54, borderWidth: 1, borderColor: "#d4d7e1", borderRadius: 14, backgroundColor: "#fff", paddingHorizontal: 16, fontSize: 20, fontWeight: "800", letterSpacing: 3, textAlign: "center" },
  code: { marginVertical: 20, backgroundColor: "#151f63", borderRadius: 18, padding: 20, alignItems: "center" },
  codeLabel: { color: "#fff", opacity: 0.7, fontSize: 11, fontWeight: "800", letterSpacing: 2 },
  codeValue: { color: "#fff", fontSize: 36, fontWeight: "900", letterSpacing: 5, marginTop: 4 },
  section: { fontSize: 18, fontWeight: "800", marginBottom: 10 },
  player: { backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, flexDirection: "row", justifyContent: "space-between" },
  playerName: { fontSize: 16, fontWeight: "700" },
  info: { marginTop: 18, color: "#5d6170", lineHeight: 21 },
  error: { color: "#b42318", textAlign: "center", marginTop: 14 },
  back: { alignItems: "center", marginTop: 18, padding: 10 },
  backText: { color: "#5d6170", fontWeight: "700" },
});
