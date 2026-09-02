import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSession } from '../session';
import { createRoom, getPublicRooms, getRoom, joinRoom, startRoom, stopRoom, submitRoomResults, type Room } from '../multiplayer/roomApi';
import { getPackCategories } from '../game/categoryPacks';

export default function MultiplayerScreen() {
  const { session } = useSession();
  const [roomCode, setRoomCode] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [busy, setBusy] = useState(false);
  const [publicRoom, setPublicRoom] = useState(true);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [remaining, setRemaining] = useState(0);
  const playerId = session?.playerId ?? '';
  const playerName = session?.displayName ?? 'Jugador';

  const categories = useMemo(() => getPackCategories('classic', room?.language ?? 'es'), [room?.language]);

  const refreshRooms = useCallback(async () => {
    try { setRooms((await getPublicRooms()).rooms ?? []); } catch { /* transient network error */ }
  }, []);

  const refreshRoom = useCallback(async () => {
    if (!room?.roomCode || !playerId || busy) return;
    try { setRoom(await getRoom(room.roomCode, playerId)); } catch { /* transient network error */ }
  }, [room?.roomCode, playerId, busy]);

  useEffect(() => { void refreshRooms(); }, [refreshRooms]);
  useEffect(() => {
    if (!room?.roomCode || !playerId || room.status === 'finished') return;
    const interval = setInterval(() => { void refreshRoom(); }, 2500);
    return () => clearInterval(interval);
  }, [room?.roomCode, room?.status, playerId, refreshRoom]);

  useEffect(() => {
    if (room?.status !== 'playing' || !room.roundEndsAt) return;
    const serverOffset = (room.serverNow ?? Date.now()) - Date.now();
    const update = () => setRemaining(Math.max(0, Math.ceil((room.roundEndsAt! - (Date.now() + serverOffset)) / 1000)));
    update();
    const interval = setInterval(update, 250);
    return () => clearInterval(interval);
  }, [room?.status, room?.roundEndsAt, room?.serverNow]);

  useEffect(() => {
    if (room?.status === 'playing') {
      setSubmitted(false);
      setAnswers({});
    }
  }, [room?.currentRound, room?.status]);

  const host = async () => {
    if (!playerId) return;
    setBusy(true);
    try {
      const created = await createRoom({ hostId: playerId, hostName: playerName, maxRounds: 3, language: 'es', isPublic: publicRoom, maxPlayers, gameMode: 'classic' });
      setRoom(created); setRoomCode(created.roomCode);
    } catch (error) { Alert.alert('No se pudo crear la sala', error instanceof Error ? error.message : 'Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  };

  const join = async () => {
    const code = roomCode.trim().toUpperCase();
    if (!playerId || !code) return;
    setBusy(true);
    try { setRoom(await joinRoom(code, { playerId, playerName })); }
    catch (error) { Alert.alert('No se pudo unir', error instanceof Error ? error.message : 'Comprueba el código.'); }
    finally { setBusy(false); }
  };

  const start = async () => {
    if (!room?.roomCode || !playerId || room.hostId !== playerId) return;
    setBusy(true);
    try { setRoom(await startRoom(room.roomCode, playerId)); }
    catch (error) { Alert.alert('No se pudo iniciar', error instanceof Error ? error.message : 'Inténtalo de nuevo.'); }
    finally { setBusy(false); }
  };

  const finishRound = async (useStop: boolean) => {
    if (!room?.roomCode || !playerId || submitted || busy) return;
    setBusy(true);
    try {
      if (useStop) await stopRoom(room.roomCode, playerId, playerName);
      await submitRoomResults(room.roomCode, { playerId, answers });
      setSubmitted(true);
      setRoom(await getRoom(room.roomCode, playerId));
    } catch (error) {
      Alert.alert('No se pudo enviar la ronda', error instanceof Error ? error.message : 'Comprueba tu conexión e inténtalo de nuevo.');
    } finally { setBusy(false); }
  };

  useEffect(() => {
    if (room?.status === 'playing' && remaining === 0 && !submitted && !busy) void finishRound(false);
  }, [remaining, room?.status, submitted, busy]);

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>Multijugador</Text><Text style={styles.subtitle}>Crea una sala o entra con un código.</Text>
    {!room ? <>
      <Text style={styles.section}>Crear sala</Text><View style={styles.row}>{[2,4,6,8].map((n) => <Pressable key={n} onPress={() => setMaxPlayers(n)} style={[styles.option, maxPlayers === n && styles.selected]}><Text style={maxPlayers === n ? styles.selectedText : styles.optionText}>{n} jugadores</Text></Pressable>)}</View>
      <Pressable onPress={() => setPublicRoom((value) => !value)} style={styles.toggle}><Text>{publicRoom ? '🌐 Sala pública' : '🔒 Sala privada'}</Text></Pressable>
      <Pressable disabled={busy} onPress={() => void host()} style={styles.primary}><Text style={styles.primaryText}>{busy ? 'CREANDO...' : 'CREAR SALA'}</Text></Pressable>
      <Text style={styles.section}>Unirse</Text><TextInput value={roomCode} onChangeText={setRoomCode} autoCapitalize="characters" autoCorrect={false} maxLength={8} placeholder="CÓDIGO DE SALA" style={styles.input}/>
      <Pressable disabled={busy || !roomCode.trim()} onPress={() => void join()} style={styles.secondary}><Text style={styles.secondaryText}>{busy ? 'UNIENDO...' : 'UNIRME A LA SALA'}</Text></Pressable>
      <Text style={styles.section}>Salas públicas</Text>{rooms.length === 0 ? <Text style={styles.muted}>No hay salas públicas disponibles.</Text> : rooms.map((item) => <Pressable key={item.roomCode} onPress={() => setRoomCode(item.roomCode)} style={styles.roomRow}><Text style={styles.roomCode}>{item.roomCode}</Text><Text>{item.playerCount ?? item.players?.length ?? 0}/{item.maxPlayers ?? '?'} jugadores</Text></Pressable>)}
    </> : <View style={styles.lobby}>
      <Text style={styles.lobbyTitle}>Sala {room.roomCode}</Text>
      <Text style={styles.status}>{room.status === 'playing' ? '🟢 PARTIDA EN JUEGO' : room.status === 'finished' ? '🏁 PARTIDA TERMINADA' : '🟡 ESPERANDO PARA EMPEZAR'}</Text>
      {room.status === 'playing' ? <View style={styles.round}>
        <View style={styles.gameHeader}><Text style={styles.roundLabel}>Ronda {room.currentRound ?? 1} de {room.maxRounds}</Text><Text style={styles.timer}>{remaining}s</Text></View>
        <Text style={styles.letter}>{room.currentLetter ?? '—'}</Text>
        <Text style={styles.muted}>Escribe una palabra que empiece por la letra indicada.</Text>
        {categories.map((category) => <View key={category} style={styles.field}><Text style={styles.label}>{category}</Text><TextInput value={answers[category] ?? ''} onChangeText={(value) => setAnswers((current) => ({ ...current, [category]: value }))} editable={!submitted && !busy} autoCapitalize="characters" autoCorrect={false} maxLength={40} placeholder={`${category}...`} style={styles.input}/></View>)}
        {!submitted ? <Pressable disabled={busy} onPress={() => void finishRound(true)} style={styles.stop}><Text style={styles.stopText}>{busy ? 'ENVIANDO...' : '¡STOP!'}</Text></Pressable> : <Text style={styles.submitted}>Ronda enviada. Esperando a los demás jugadores…</Text>}
      </View> : null}
      <Text style={styles.section}>Jugadores</Text>
      {(room.players ?? []).map((player) => <View key={player.playerId} style={styles.player}><View><Text style={styles.playerName}>{player.playerName}</Text>{player.roundScore != null ? <Text style={styles.score}>{player.roundScore} puntos</Text> : null}</View>{player.playerId === room.hostId && <Text>👑</Text>}</View>)}
      {room.status === 'waiting' && room.hostId === playerId ? <Pressable disabled={busy} onPress={() => void start()} style={styles.primary}><Text style={styles.primaryText}>{busy ? 'INICIANDO...' : 'EMPEZAR PARTIDA'}</Text></Pressable> : null}
      {room.status === 'waiting' && room.hostId !== playerId ? <Text style={styles.muted}>El anfitrión debe iniciar la partida.</Text> : null}
      <Pressable onPress={() => void refreshRoom()} style={styles.secondary}><Text style={styles.secondaryText}>ACTUALIZAR AHORA</Text></Pressable>
    </View>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe:{flex:1,backgroundColor:'#f7f7f7'},content:{padding:20,paddingBottom:40},title:{fontSize:30,fontWeight:'900'},subtitle:{marginTop:6,marginBottom:22,opacity:.65,fontSize:16},section:{marginTop:22,marginBottom:10,fontSize:18,fontWeight:'800'},row:{flexDirection:'row',flexWrap:'wrap',gap:8},option:{padding:12,borderWidth:1,borderRadius:12,backgroundColor:'#fff'},selected:{backgroundColor:'#111',borderColor:'#111'},optionText:{fontWeight:'700'},selectedText:{color:'#fff',fontWeight:'800'},toggle:{padding:14,borderRadius:12,backgroundColor:'#fff',marginTop:12},primary:{marginTop:12,minHeight:54,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'#111'},primaryText:{color:'#fff',fontSize:17,fontWeight:'900'},input:{minHeight:50,borderWidth:1,borderRadius:12,paddingHorizontal:14,backgroundColor:'#fff',fontSize:17,paddingHorizontal:14},secondary:{marginTop:10,minHeight:52,borderRadius:14,borderWidth:1,alignItems:'center',justifyContent:'center',backgroundColor:'#fff'},secondaryText:{fontWeight:'900'},muted:{opacity:.6},roomRow:{marginTop:8,padding:14,borderRadius:12,backgroundColor:'#fff',flexDirection:'row',justifyContent:'space-between'},roomCode:{fontWeight:'900',letterSpacing:2},lobby:{marginTop:8,padding:18,borderRadius:16,backgroundColor:'#fff'},lobbyTitle:{fontSize:25,fontWeight:'900'},status:{marginTop:8,fontWeight:'800'},round:{marginTop:18,padding:18,borderRadius:14,borderWidth:1},gameHeader:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},roundLabel:{fontSize:16,fontWeight:'800'},timer:{fontSize:24,fontWeight:'900'},letter:{alignSelf:'center',fontSize:58,fontWeight:'900',marginVertical:8},field:{marginTop:12},label:{marginBottom:6,fontSize:15,fontWeight:'800'},stop:{minHeight:58,marginTop:18,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'#111'},stopText:{color:'#fff',fontSize:20,fontWeight:'900'},submitted:{marginTop:18,textAlign:'center',fontWeight:'700',opacity:.7},player:{paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#eee',flexDirection:'row',justifyContent:'space-between'},playerName:{fontSize:16,fontWeight:'700'},score:{marginTop:3,opacity:.6,fontSize:13}});