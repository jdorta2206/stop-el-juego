import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { authenticatedFetch } from '../auth';

type Tier = { tier: number; gamesRequired?: number; games?: number; reached?: boolean; claimed?: boolean; reward?: { coins?: number; frame?: string } };
type Props = { navigation: { goBack: () => void } };

export default function PrestigeScreen({ navigation }: Props) {
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claiming, setClaiming] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await authenticatedFetch<Tier[]>('/api/rewards/prestige');
      setTiers(Array.isArray(result) ? result : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron cargar las recompensas');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const claim = async (tier: number) => {
    setClaiming(tier); setError(null);
    try {
      await authenticatedFetch('/api/rewards/prestige/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tier }) });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo reclamar la recompensa');
    } finally { setClaiming(null); }
  };

  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}><Pressable onPress={navigation.goBack}><Text>‹ Atrás</Text></Pressable><Text style={styles.title}>Prestigio</Text><View /></View>
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {loading ? <ActivityIndicator style={styles.loader} /> : <ScrollView contentContainerStyle={styles.list}>
      {tiers.map(t => <View key={t.tier} style={styles.card}>
        <Text style={styles.name}>Nivel de prestigio {t.tier}</Text>
        <Text>{Number(t.games ?? 0)} / {Number(t.gamesRequired ?? 0)} partidas</Text>
        <Text style={styles.reward}>🎁 {Number(t.reward?.coins ?? 0)} monedas{t.reward?.frame ? ` · Marco ${t.reward.frame}` : ''}</Text>
        {t.claimed ? <Text style={styles.claimed}>✓ Reclamada</Text> : t.reached ? <Pressable style={styles.button} disabled={claiming === t.tier} onPress={() => void claim(t.tier)}><Text style={styles.buttonText}>{claiming === t.tier ? 'Reclamando…' : 'RECLAMAR'}</Text></Pressable> : <Text style={styles.locked}>Sigue jugando para desbloquearla</Text>}
      </View>)}
      {!tiers.length ? <Text style={styles.empty}>No hay recompensas disponibles.</Text> : null}
    </ScrollView>}
  </SafeAreaView>;
}

const styles = StyleSheet.create({ safe:{flex:1,backgroundColor:'#fff'}, header:{padding:18,flexDirection:'row',justifyContent:'space-between',alignItems:'center'}, title:{fontSize:24,fontWeight:'900'}, list:{padding:16,gap:12}, card:{borderWidth:1,borderRadius:14,padding:16}, name:{fontSize:18,fontWeight:'900',marginBottom:8}, reward:{marginTop:8,opacity:.75}, button:{marginTop:14,minHeight:46,borderRadius:10,backgroundColor:'#111',alignItems:'center',justifyContent:'center'}, buttonText:{color:'#fff',fontWeight:'900'}, claimed:{marginTop:14,fontWeight:'800'}, locked:{marginTop:14,opacity:.6}, loader:{marginTop:40}, error:{marginHorizontal:18,textAlign:'center'}, empty:{textAlign:'center',marginTop:30,opacity:.65} });
