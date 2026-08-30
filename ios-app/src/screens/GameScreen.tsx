import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { authenticatedFetch } from '../auth';
import { buildValidationPayload, createRound, isFinalRound, nextRound, setAnswer, type GameCategory, type GameRound, type ValidateRoundResult } from '../game/gameEngine';
import { getCategoriesForConfig, normalizeGameConfig } from '../game/gameConfig';
import type { RootStackParamList } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamList, 'Game'>;

export default function GameScreen({ route }: Props) {
  const config = normalizeGameConfig(route.params?.config);
  const categories = useMemo<GameCategory[]>(() => getCategoriesForConfig(config), [config.categoryPack, config.language]);
  const [round, setRound] = useState<GameRound>(() => createRound(categories, { mode: config.mode }));
  const [previousLetters, setPreviousLetters] = useState<string[]>([]);
  const [remaining, setRemaining] = useState(round.seconds);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ValidateRoundResult | null>(null);
  const stoppedRef = useRef(false);

  const finishRound = useCallback(async () => {
    if (stoppedRef.current || submitting || result) return;
    stoppedRef.current = true;
    setSubmitting(true);
    try {
      const payload = buildValidationPayload(round, config.language);
      const validated = await authenticatedFetch<ValidateRoundResult>('/api/game/validate', { method: 'POST', body: JSON.stringify(payload) });
      setResult(validated);
    } catch (error) {
      stoppedRef.current = false;
      Alert.alert('No se pudo validar', error instanceof Error ? error.message : 'Comprueba tu conexión e inténtalo de nuevo.');
    } finally { setSubmitting(false); }
  }, [round, config.language, submitting, result]);

  useEffect(() => {
    if (result || submitting) return;
    if (remaining <= 0) { void finishRound(); return; }
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [remaining, result, submitting, finishRound]);

  const updateAnswer = (category: string, value: string) => setRound((current) => setAnswer(current, category, value));

  const startNextRound = () => {
    const next = nextRound(round, categories, previousLetters);
    if (!next) return;
    setPreviousLetters((letters) => [...letters, round.letter]);
    setRound(next); setRemaining(next.seconds); setResult(null); stoppedRef.current = false;
  };

  const score = result ? Number(result.playerTotalScore) || 0 : 0;
  const final = result ? isFinalRound(round) : false;
  const statusText = useMemo(() => result ? `Ronda ${round.round}: ${score} puntos` : 'Escribe una palabra que empiece por la letra indicada.', [result, round.round, score]);

  return <SafeAreaView style={styles.safe}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
    <View style={styles.header}><Text style={styles.round}>RONDA {round.round}/{round.maxRounds}</Text><Text style={styles.timer}>{remaining}s</Text></View>
    <Text style={styles.mode}>{config.mode === 'quick' ? 'RÁPIDO' : 'NORMAL'} · {config.language.toUpperCase()}</Text>
    <Text style={styles.letter}>{round.letter}</Text><Text style={styles.instructions}>{statusText}</Text>
    {round.categories.map((category) => <View key={category.id} style={styles.field}><Text style={styles.label}>{category.name}</Text><TextInput value={round.answers[category.name] ?? ''} onChangeText={(value) => updateAnswer(category.name, value)} editable={!result && !submitting} autoCapitalize="characters" autoCorrect={false} maxLength={40} placeholder={`${category.name}...`} style={styles.input}/></View>)}
    {!result ? <Pressable style={styles.stop} disabled={submitting} onPress={() => void finishRound()}><Text style={styles.stopText}>{submitting ? 'VALIDANDO...' : '¡STOP!'}</Text></Pressable> : <View style={styles.resultBox}><Text style={styles.resultTitle}>Resultado</Text><Text style={styles.score}>{score} puntos</Text><Text style={styles.detail}>Tu resultado ha sido validado por el servidor.</Text>{final ? <Text style={styles.final}>Partida terminada</Text> : <Pressable style={styles.next} onPress={startNextRound}><Text style={styles.nextText}>SIGUIENTE RONDA</Text></Pressable>}</View>}
  </ScrollView></SafeAreaView>;
}

const styles = StyleSheet.create({ safe:{flex:1,backgroundColor:'#f7f7f7'},content:{padding:20,paddingBottom:40},header:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},round:{fontSize:14,fontWeight:'800',opacity:.65},timer:{fontSize:24,fontWeight:'900'},mode:{alignSelf:'center',marginTop:8,fontSize:12,fontWeight:'800',opacity:.55},letter:{alignSelf:'center',marginVertical:18,fontSize:72,fontWeight:'900'},instructions:{textAlign:'center',marginBottom:18,fontSize:15,opacity:.7},field:{marginBottom:12},label:{marginBottom:6,fontSize:15,fontWeight:'800'},input:{minHeight:50,borderWidth:1,borderRadius:12,paddingHorizontal:14,backgroundColor:'#fff',fontSize:17},stop:{minHeight:58,marginTop:12,borderRadius:14,alignItems:'center',justifyContent:'center',backgroundColor:'#111'},stopText:{color:'#fff',fontSize:20,fontWeight:'900'},resultBox:{marginTop:18,padding:20,borderRadius:16,backgroundColor:'#fff',alignItems:'center'},resultTitle:{fontSize:18,fontWeight:'800'},score:{marginTop:6,fontSize:36,fontWeight:'900'},detail:{marginTop:8,textAlign:'center',opacity:.65},final:{marginTop:18,fontSize:17,fontWeight:'800'},next:{width:'100%',minHeight:52,marginTop:18,borderRadius:12,alignItems:'center',justifyContent:'center',backgroundColor:'#111'},nextText:{color:'#fff',fontWeight:'900'}});
