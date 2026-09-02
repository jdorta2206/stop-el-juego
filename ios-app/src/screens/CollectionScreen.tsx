import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { authenticatedFetch } from '../auth';
import { useSession } from '../session';

type RewardSet = { id: string; name?: string; target: number; progress?: number; completed?: boolean; claimed?: boolean; reward?: { coins?: number; frame?: string } };
type CollectionResponse = { stats?: Record<string, number>; sets: RewardSet[] };

type Props = { navigation: { goBack: () => void } };

export default function CollectionScreen({ navigation }: Props) {
  const { session } = useSession();
  const [data, setData] = useState<CollectionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session?.playerId) return;
    setError(null);
    try {
      const result = await authenticatedFetch<CollectionResponse>('/api/rewards/collection');
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar la colección');
    }
  }, [session?.playerId]);

  useEffect(() => { void load(); }, [load]);

  const claim = async (setId: string) => {
    setClaiming(setId);
    setError(null);
    try {
      await authenticatedFetch('/api/rewards/collection/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ setId }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo reclamar la recompensa');
    } finally { setClaiming(null); }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}><Pressable onPress={navigation.goBack}><Text>‹ Atrás</Text></Pressable><Text style={styles.title}>Colección</Text><View /></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!data ? <ActivityIndicator style={styles.loader} /> : (
        <ScrollView contentContainerStyle={styles.list}>
          {data.sets.map(set => {
            const progress = Math.min(Number(set.progress ?? 0), Number(set.target ?? 0));
            const complete = Boolean(set.completed) || progress >= set.target;
            return <View key={set.id} style={styles.card}>
              <Text style={styles.name}>{set.name || set.id}</Text>
              <Text style={styles.progress}>{progress} / {set.target}</Text>
              <Text style={styles.reward}>🎁 {set.reward?.coins ?? 0} monedas{set.reward?.frame ? ` · Marco ${set.reward.frame}` : ''}</Text>
              {set.claimed ? <Text style={styles.claimed}>✓ Reclamada</Text> : complete ? <Pressable style={styles.button} disabled={claiming === set.id} onPress={() => void claim(set.id)}><Text style={styles.buttonText}>{claiming === set.id ? 'Reclamando…' : 'RECLAMAR'}</Text></Pressable> : <Text style={styles.locked}>Completa el conjunto para reclamar</Text>}
            </View>;
          })}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe:{flex:1,backgroundColor:'#fff'}, header:{padding:18,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}, title:{fontSize:24,fontWeight:'900'}, list:{padding:16,gap:12}, card:{borderWidth:1,borderRadius:14,padding:16}, name:{fontSize:18,fontWeight:'900'}, progress:{marginTop:8,fontSize:16}, reward:{marginTop:6,opacity:.75}, button:{marginTop:14,minHeight:46,borderRadius:10,backgroundColor:'#111',alignItems:'center',justifyContent:'center'}, buttonText:{color:'#fff',fontWeight:'900'}, claimed:{marginTop:14,fontWeight:'800'}, locked:{marginTop:14,opacity:.6}, loader:{marginTop:40}, error:{marginHorizontal:18,textAlign:'center'} });
