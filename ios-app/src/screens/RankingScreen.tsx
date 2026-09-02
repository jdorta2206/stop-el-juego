import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Ranking'>;
type Period = 'global' | 'weekly' | 'monthly';
type Player = { playerId: string; playerName?: string; totalScore?: number; wins?: number; gamesPlayed?: number; rank?: number; title?: string; };

export default function RankingScreen({ navigation }: Props) {
  const [period, setPeriod] = useState<Period>('global');
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: Period) => {
    setLoading(true); setError(null);
    try {
      const path = p === 'global' ? '/api/ranking/scores?limit=100' : `/api/ranking/${p}`;
      const data = await api.get<{ players: Player[] }>(path);
      setPlayers(Array.isArray(data.players) ? data.players : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo cargar el ranking');
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { void load(period); }, [period, load]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()}><Text style={styles.back}>‹ Atrás</Text></Pressable>
        <Text style={styles.title}>🏆 Ranking</Text>
      </View>
      <View style={styles.tabs}>
        {(['global', 'weekly', 'monthly'] as Period[]).map(p => (
          <Pressable key={p} onPress={() => setPeriod(p)} style={[styles.tab, period === p && styles.activeTab]}>
            <Text style={period === p ? styles.activeText : styles.tabText}>{p === 'global' ? 'Global' : p === 'weekly' ? 'Semanal' : 'Mensual'}</Text>
          </Pressable>
        ))}
      </View>
      {loading ? <ActivityIndicator style={styles.loader} /> : error ? <Text style={styles.error}>{error}</Text> : (
        <ScrollView contentContainerStyle={styles.list}>
          {players.map((player, index) => (
            <View key={player.playerId || String(index)} style={styles.row}>
              <Text style={styles.rank}>{player.rank ?? index + 1}</Text>
              <View style={styles.info}>
                <Text style={styles.name}>{player.playerName || 'Jugador'}</Text>
                {player.title ? <Text style={styles.subtitle}>{player.title}</Text> : null}
              </View>
              <View style={styles.stats}>
                <Text style={styles.score}>{Number(player.totalScore ?? 0).toLocaleString('es-ES')}</Text>
                <Text style={styles.games}>{Number(player.wins ?? 0)} vict.</Text>
              </View>
            </View>
          ))}
          {!players.length ? <Text style={styles.empty}>Todavía no hay jugadores en este ranking.</Text> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 18 },
  back: { fontSize: 16 }, title: { fontSize: 24, fontWeight: '900' }, tabs: { flexDirection: 'row', paddingHorizontal: 12, gap: 8 },
  tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderRadius: 10 }, activeTab: { backgroundColor: '#111' }, tabText: { fontWeight: '700' }, activeText: { color: '#fff', fontWeight: '800' },
  loader: { marginTop: 40 }, error: { margin: 24, textAlign: 'center' }, list: { padding: 16, gap: 10 }, row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, borderRadius: 12 },
  rank: { width: 34, fontSize: 18, fontWeight: '900', textAlign: 'center' }, info: { flex: 1 }, name: { fontSize: 16, fontWeight: '800' }, subtitle: { marginTop: 3, fontSize: 12, opacity: 0.65 }, stats: { alignItems: 'flex-end' }, score: { fontWeight: '900' }, games: { marginTop: 3, fontSize: 12, opacity: 0.65 }, empty: { textAlign: 'center', marginTop: 30, opacity: 0.65 },
});
