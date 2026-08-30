import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { getApiUrl } from "./api";
import { type StopSession } from "./auth";
import { STOP_CATEGORIES, type StopMode, type ValidationResponse, buildValidationRequest, chooseLetter, getModeDuration, validateRound, getDailyChallenge } from "./game/gameEngine";

type Answers = Record<string, string>;
type DailyChallenge = { date: string; letter: string; categories: { id: string; label: string }[]; completed?: boolean };
const MODES: StopMode[] = ["normal", "rapido", "caos", "random", "diario"];
const emptyAnswers = (categories = STOP_CATEGORIES): Answers => Object.fromEntries(categories.map(({ id }) => [id, ""]));
function modeLabel(mode: StopMode) { if (mode === "rapido") return "RÁPIDO · 30s"; if (mode === "caos") return "CAOS"; if (mode === "random") return "STOP RANDOM"; if (mode === "diario") return "RETO DIARIO"; return "NORMAL · 60s"; }

export function GameScreen({ onExit, session }: { onExit: () => void; session: StopSession | null }) {
  const [mode, setMode] = useState<StopMode>("normal");
  const [letter, setLetter] = useState(() => chooseLetter());
  const [categories, setCategories] = useState(STOP_CATEGORIES as readonly { id: string; label: string }[]);
  const [answers, setAnswers] = useState<Answers>(() => emptyAnswers());
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [running, setRunning] = useState(false);
  const [loadingDaily, setLoadingDaily] = useState(false);
  const [daily, setDaily] = useState<DailyChallenge | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ValidationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const submittedRef = useRef(false);
  const roundTime = useMemo(() => { try { return getModeDuration(mode); } catch { return 60; } }, [mode]);
  const progress = secondsLeft / Math.max(1, roundTime);

  const loadDaily = useCallback(async () => {
    setLoadingDaily(true); setError(null);
    try { const challenge = await getDailyChallenge(getApiUrl(), "es", undefined, session?.token); setDaily({ ...challenge, categories: challenge.categories.map(id => ({ id, label: STOP_CATEGORIES.find(c => c.id === id)?.label ?? id })) }); return challenge; }
    catch (e) { setError(e instanceof Error ? e.message : "No se ha podido cargar el reto diario."); return null; }
    finally { setLoadingDaily(false); }
  }, [session?.token]);

  useEffect(() => { if (mode === "diario" && !daily) void loadDaily(); }, [mode, daily, loadDaily]);

  const finishRound = useCallback(async () => {
    if (submittedRef.current || !running) return;
    submittedRef.current = true; setRunning(false); setSubmitting(true); setError(null);
    try {
      const validation = await validateRound(getApiUrl(), buildValidationRequest(letter, "es", answers, categories), undefined, session?.token);
      setResult(validation);
      if (mode === "diario") setDaily(current => current ? { ...current, completed: true } : current);
    } catch (e) { submittedRef.current = false; setRunning(true); setError(e instanceof Error ? e.message : "No se ha podido validar la partida."); }
    finally { setSubmitting(false); }
  }, [answers, categories, letter, mode, running, session?.token]);

  useEffect(() => { if (!running) return; const timer = setInterval(() => setSecondsLeft(v => { if (v <= 1) { clearInterval(timer); void finishRound(); return 0; } return v - 1; }), 1000); return () => clearInterval(timer); }, [running, finishRound]);

  const startGame = async (nextMode: StopMode = mode) => {
    setError(null); setResult(null); submittedRef.current = false; setMode(nextMode);
    if (nextMode === "diario") {
      const challenge = daily ?? await loadDaily(); if (!challenge) return;
      if (challenge.completed) { setError("Ya has completado el Reto Diario de hoy."); return; }
      const dailyCategories = challenge.categories.map(id => ({ id, label: STOP_CATEGORIES.find(c => c.id === id)?.label ?? id }));
      setLetter(challenge.letter); setCategories(dailyCategories); setAnswers(emptyAnswers(dailyCategories)); setSecondsLeft(getModeDuration("diario"));
    } else {
      if (nextMode === "random") { setError("STOP Random todavía no está conectado a su regla oficial; no se iniciará con una regla inventada."); return; }
      const nextLetter = chooseLetter(); setLetter(nextLetter); setCategories(STOP_CATEGORIES); setAnswers(emptyAnswers()); setSecondsLeft(getModeDuration(nextMode));
    }
    setRunning(true);
  };
  const updateAnswer = (category: string, word: string) => { if (running) setAnswers(current => ({ ...current, [category]: word })); };

  if (!running && !result) return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.container}>
    <View style={styles.header}><TouchableOpacity onPress={onExit}><Text style={styles.back}>‹ Volver</Text></TouchableOpacity><Text style={styles.headerTitle}>STOP!</Text><Text style={styles.mode}>SOLO</Text></View>
    <Text style={styles.pageTitle}>Elige cómo jugar</Text><Text style={styles.pageSub}>Partida nativa iOS conectada al backend real de STOP.</Text>
    {MODES.map(item => <TouchableOpacity key={item} style={styles.modeCard} onPress={() => void startGame(item)} disabled={item === "diario" && loadingDaily} activeOpacity={0.85}><View style={styles.modeIcon}><Text style={styles.modeEmoji}>{item === "normal" ? "🎯" : item === "rapido" ? "⚡" : item === "caos" ? "🌪️" : item === "random" ? "🎲" : "📅"}</Text></View><View style={styles.modeContent}><Text style={styles.modeTitle}>{modeLabel(item)}</Text><Text style={styles.modeText}>{item === "normal" ? "La partida clásica de STOP." : item === "rapido" ? "Una ronda rápida." : item === "caos" ? "Ronda especial de Caos." : item === "random" ? "Modo aleatorio." : "El reto diario oficial."}</Text></View><Text style={styles.arrow}>›</Text></TouchableOpacity>)}
    {loadingDaily && <ActivityIndicator style={{ marginTop: 8 }} />} {error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}
  </ScrollView></SafeAreaView>;

  return <SafeAreaView style={styles.safeArea}><ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled"><View style={styles.header}><TouchableOpacity onPress={onExit}><Text style={styles.back}>‹ Salir</Text></TouchableOpacity><Text style={styles.headerTitle}>STOP!</Text><Text style={styles.mode}>{modeLabel(mode)}</Text></View><View style={styles.letterCard}><Text style={styles.letterLabel}>LETRA</Text><Text style={styles.letter}>{letter}</Text><View style={styles.timerTrack}><View style={[styles.timerFill,{width:`${Math.max(0,Math.min(1,progress))*100}%`}]} /></View><Text style={styles.timer}>{secondsLeft}s</Text></View>{mode === "diario" && daily && <View style={styles.infoBox}><Text style={styles.infoTitle}>Reto Diario · {daily.date}</Text><Text style={styles.infoText}>Reto oficial asignado por el servidor.</Text></View>}<View style={styles.infoBox}><Text style={styles.infoTitle}>Escribe una palabra por categoría</Text><Text style={styles.infoText}>Todas deben empezar por {letter}. STOP termina la ronda y el servidor valida las respuestas.</Text></View>{categories.map(({ id, label }) => { const item = result?.results?.[id]; return <View key={id} style={styles.categoryCard}><View style={styles.categoryHeader}><Text style={styles.category}>{label}</Text>{item && <Text style={item.player.isValid ? styles.valid : styles.invalid}>{item.player.isValid ? `+${item.player.score}` : "0"}</Text>}</View><TextInput value={answers[id] ?? ""} onChangeText={v=>updateAnswer(id,v)} placeholder={`${letter}…`} editable={running} autoCapitalize="words" returnKeyType="next" style={[styles.input,item&&(item.player.isValid?styles.inputValid:styles.inputInvalid)]}/></View>; })}{error && <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text></View>}{result ? <View style={styles.resultCard}><Text style={styles.resultTitle}>Ronda terminada</Text><Text style={styles.resultScore}>{result.playerTotalScore} puntos</Text><TouchableOpacity style={styles.primaryButton} onPress={()=>{setResult(null);setRunning(false);}}><Text style={styles.primaryText}>Elegir otro modo</Text></TouchableOpacity>{mode !== "diario" && <TouchableOpacity style={styles.secondaryButton} onPress={()=>void startGame(mode)}><Text style={styles.secondaryText}>Jugar otra vez</Text></TouchableOpacity>}</View> : <TouchableOpacity style={styles.stopButton} onPress={()=>void finishRound()} disabled={!running||submitting}>{submitting?<ActivityIndicator color="white"/>:<Text style={styles.stopText}>¡STOP!</Text>}<Text style={styles.stopHint}>Terminar y validar</Text></TouchableOpacity>}</ScrollView></SafeAreaView>;
}
const styles=StyleSheet.create({safeArea:{flex:1,backgroundColor:"#f7f8fc"},container:{padding:18,paddingBottom:36},header:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginBottom:16},back:{color:"#151f63",fontSize:16,fontWeight:"800"},headerTitle:{fontSize:22,fontWeight:"900"},mode:{fontSize:10,fontWeight:"800",color:"#6b7280",maxWidth:110,textAlign:"right"},pageTitle:{fontSize:28,fontWeight:"900",marginBottom:5},pageSub:{fontSize:14,lineHeight:20,color:"#666b78",marginBottom:16},modeCard:{flexDirection:"row",alignItems:"center",backgroundColor:"white",borderRadius:18,padding:16,marginBottom:10,minHeight:86},modeIcon:{width:48,height:48,borderRadius:14,backgroundColor:"#eef0fb",alignItems:"center",justifyContent:"center"},modeEmoji:{fontSize:25},modeContent:{flex:1,marginLeft:13},modeTitle:{fontSize:16,fontWeight:"900"},modeText:{fontSize:12,color:"#666b78",marginTop:3,lineHeight:17},arrow:{fontSize:34,color:"#777b89",fontWeight:"300"},letterCard:{alignItems:"center",backgroundColor:"#151f63",borderRadius:24,paddingVertical:20,marginBottom:12},letterLabel:{color:"white",opacity:.7,fontSize:12,fontWeight:"800",letterSpacing:2},letter:{color:"white",fontSize:64,lineHeight:72,fontWeight:"900"},timerTrack:{height:6,width:"80%",backgroundColor:"rgba(255,255,255,.22)",borderRadius:3,overflow:"hidden",marginTop:6},timerFill:{height:"100%",backgroundColor:"white",borderRadius:3},timer:{color:"white",marginTop:7,fontSize:14,fontWeight:"800"},infoBox:{backgroundColor:"white",borderRadius:16,padding:14,marginBottom:12},infoTitle:{fontSize:15,fontWeight:"800"},infoText:{marginTop:4,color:"#666b78",lineHeight:19,fontSize:13},categoryCard:{backgroundColor:"white",borderRadius:16,padding:12,marginBottom:9},categoryHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:7},category:{fontSize:15,fontWeight:"800"},valid:{color:"#16803c",fontWeight:"900"},invalid:{color:"#b42318",fontWeight:"900"},input:{borderWidth:1,borderColor:"#d9dce6",borderRadius:11,paddingHorizontal:13,height:46,fontSize:16,backgroundColor:"#fbfcff"},inputValid:{borderColor:"#72c58b"},inputInvalid:{borderColor:"#e29a94"},stopButton:{marginTop:6,borderRadius:18,backgroundColor:"#c62828",minHeight:72,alignItems:"center",justifyContent:"center"},stopText:{color:"white",fontSize:25,fontWeight:"900"},stopHint:{color:"white",opacity:.82,fontSize:12,marginTop:1},resultCard:{backgroundColor:"white",borderRadius:20,padding:20,marginTop:6,alignItems:"center"},resultTitle:{fontSize:20,fontWeight:"900"},resultScore:{fontSize:42,fontWeight:"900",marginTop:4,color:"#151f63"},primaryButton:{marginTop:18,backgroundColor:"#151f63",borderRadius:14,paddingHorizontal:24,paddingVertical:13},primaryText:{color:"white",fontSize:15,fontWeight:"800"},secondaryButton:{marginTop:9,borderWidth:1,borderColor:"#d9dce6",borderRadius:14,paddingHorizontal:24,paddingVertical:12},secondaryText:{color:"#151f63",fontSize:15,fontWeight:"800"},errorBox:{backgroundColor:"#fff0ef",borderRadius:12,padding:12,marginTop:3,marginBottom:10},errorText:{color:"#b42318",fontSize:13,textAlign:"center"}});
