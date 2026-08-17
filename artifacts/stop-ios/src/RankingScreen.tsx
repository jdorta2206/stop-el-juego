import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiFetch } from "./api";

type Player = {
  playerId: string;
  playerName: string;
  avatarColor?: string;
  totalScore: number;
  gamesPlayed: number;
  wins: number;
  currentStreak: number;
  title: string;
  rank: number;
};

type RankingResponse = { players: Player[]; total?: number; nextReset?: string };

export function RankingScreen({ onExit }: { onExit: () => void }) {
  const [tab, setTab] = useState<"global" | "weekly">("global");
  const [data, setData] = useState<RankingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const result = await apiFetch<RankingResponse>(tab === "global" ? "/api/ranking/scores?limit=100" : "/api/ranking/weekly");
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el ranking.");
    }
  }

  useEffect(() => { load(); }, [tab]);

  return <View style={styles.container}>
    <View style={styles.header}><TouchableOpacity onPress={onExit}><Text style={styles.back}>‹</Text></TouchableOpacity><Text style={styles.heading}>🏆 Ranking</Text><TouchableOpacity onPress={load}><Text style={styles.refresh}>↻</Text></TouchableOpacity></View>
    <View style={styles.tabs}>
      <TouchableOpacity style={[styles.tab, tab === "global" && styles.tabActive]} onPress={() => setTab("global")}><Text style={[styles.tabText, tab === "global" && styles.tabTextActive]}>Global</Text></TouchableOpacity>
      <TouchableOpacity style={[styles.tab, tab === "weekly" && styles.tabActive]} onPress={() => setTab("weekly")}><Text style={[styles.tabText, tab === "weekly" && styles.tabTextActive]}>Esta semana</Text></TouchableOpacity>
    </View>
    {error && <View style={styles.errorBox}><Text style={styles.error}>{error}</Text></View>}
    {!data && !error ? <ActivityIndicator size="large" style={styles.loader} /> : <FlatList data={data?.players ?? []} keyExtractor={(item) => item.playerId} contentContainerStyle={styles.list} renderItem={({ item }) => <View style={styles.row}>
      <Text style={styles.rank}>{item.rank <= 3 ? ["🥇", "🥈", "🥉"][item.rank - 1] : `#${item.rank}`}</Text>
      <View style={[styles.avatar, { backgroundColor: item.avatarColor || "#3182ce" }]}><Text style={styles.avatarText}>{(item.playerName || "?").slice(0, 1).toUpperCase()}</Text></View>
      <View style={styles.info}><Text style={styles.name}>{item.playerName || "Jugador"}</Text><Text style={styles.meta}>{item.title} · {item.wins} victorias · 🔥 {item.currentStreak}</Text></View>
      <Text style={styles.score}>{Number(item.totalScore || 0).toLocaleString("es-ES")}</Text>
    </View>} ListEmptyComponent={<Text style={styles.empty}>Todavía no hay jugadores en este ranking.</Text>} />}
  </View>;
}

const styles = StyleSheet.create({ container:{flex:1,backgroundColor:"#f7f8fc",paddingHorizontal:18},header:{flexDirection:"row",alignItems:"center",paddingTop:18,paddingBottom:14},back:{fontSize:38,color:"#151f63",width:42},heading:{flex:1,fontSize:25,fontWeight:"900"},refresh:{fontSize:28,color:"#151f63"},tabs:{flexDirection:"row",backgroundColor:"#e9ebf2",borderRadius:12,padding:3},tab:{flex:1,paddingVertical:11,alignItems:"center",borderRadius:10},tabActive:{backgroundColor:"white"},tabText:{fontWeight:"700",color:"#666b78"},tabTextActive:{color:"#151f63"},list:{paddingVertical:12},row:{flexDirection:"row",alignItems:"center",backgroundColor:"white",borderRadius:15,padding:12,marginBottom:9},rank:{width:40,textAlign:"center",fontWeight:"800",fontSize:14},avatar:{width:42,height:42,borderRadius:21,alignItems:"center",justifyContent:"center"},avatarText:{color:"white",fontWeight:"900",fontSize:18},info:{flex:1,marginLeft:10},name:{fontSize:15,fontWeight:"800"},meta:{fontSize:11,color:"#777b89",marginTop:3},score:{fontSize:15,fontWeight:"900",color:"#151f63"},loader:{marginTop:60},errorBox:{backgroundColor:"#fff0f0",padding:12,borderRadius:12,marginTop:12},error:{color:"#b42318",textAlign:"center"},empty:{textAlign:"center",color:"#777b89",marginTop:40}
});
