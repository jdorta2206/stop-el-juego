import { useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { apiFetch } from "./api";
import type { StopSession } from "./auth";

type Profile = {
  playerId: string; playerName: string; avatarColor?: string; totalScore: number; gamesPlayed: number; wins: number;
  currentStreak: number; longestStreak: number; isPremium: boolean; xp: number; level: number; coins: number;
  globalRank: number; monthlyScore: number; modeStats: Record<string, { games:number; totalScore:number; bestScore:number; wins:number }>;
  recentGames: Array<{ id:string|number; score:number; letter:string; mode:string; won:boolean; createdAt:string }>;
};

export function ProfileScreen({ session, onExit, onLogout }: { session: StopSession; onExit:()=>void; onLogout:()=>void }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { apiFetch<Profile>(`/api/ranking/profile/${encodeURIComponent(session.user.id)}`).then(setProfile).catch(e => setError(e instanceof Error ? e.message : "No se pudo cargar el perfil.")); }, [session.user.id]);
  if (!profile && !error) return <View style={styles.center}><ActivityIndicator size="large" /><Text style={styles.loading}>Cargando tu perfil…</Text></View>;
  if (error) return <View style={styles.center}><Text style={styles.error}>{error}</Text><TouchableOpacity style={styles.primary} onPress={onExit}><Text style={styles.primaryText}>Volver</Text></TouchableOpacity></View>;
  return <ScrollView style={styles.container} contentContainerStyle={styles.content}>
    <View style={styles.header}><TouchableOpacity onPress={onExit}><Text style={styles.back}>‹</Text></TouchableOpacity><Text style={styles.heading}>👤 Tu perfil</Text></View>
    <View style={styles.hero}><View style={[styles.avatar,{backgroundColor:profile?.avatarColor||"#3182ce"}]}><Text style={styles.avatarText}>{(profile?.playerName||session.user.name||"?").slice(0,1).toUpperCase()}</Text></View><Text style={styles.name}>{profile?.playerName || session.user.name || "Jugador STOP"}</Text><Text style={styles.rank}>#{profile?.globalRank} · Nivel {profile?.level} · {profile?.xp} XP</Text></View>
    <View style={styles.grid}>
      <Stat label="Puntuación" value={profile?.totalScore} /><Stat label="Partidas" value={profile?.gamesPlayed} /><Stat label="Victorias" value={profile?.wins} /><Stat label="Monedas" value={profile?.coins} />
    </View>
    <View style={styles.card}><Text style={styles.cardTitle}>🔥 Rachas</Text><Text style={styles.line}>Actual: <Text style={styles.bold}>{profile?.currentStreak}</Text></Text><Text style={styles.line}>Mejor: <Text style={styles.bold}>{profile?.longestStreak}</Text></Text><Text style={styles.line}>Puntuación este mes: <Text style={styles.bold}>{profile?.monthlyScore}</Text></Text></View>
    <View style={styles.card}><Text style={styles.cardTitle}>🎮 Por modo</Text>{Object.entries(profile?.modeStats ?? {}).map(([mode, s]) => <View style={styles.mode} key={mode}><Text style={styles.modeName}>{mode}</Text><Text style={styles.modeMeta}>{s.games} partidas · {s.wins} victorias · mejor {s.bestScore}</Text></View>)}{Object.keys(profile?.modeStats ?? {}).length===0 && <Text style={styles.muted}>Todavía no hay partidas registradas.</Text>}</View>
    <TouchableOpacity style={styles.logout} onPress={onLogout}><Text style={styles.logoutText}>Cerrar sesión</Text></TouchableOpacity>
  </ScrollView>;
}
function Stat({label,value}:{label:string;value?:number}){return <View style={styles.stat}><Text style={styles.statValue}>{Number(value||0).toLocaleString("es-ES")}</Text><Text style={styles.statLabel}>{label}</Text></View>}
const styles=StyleSheet.create({container:{flex:1,backgroundColor:"#f7f8fc"},content:{padding:18,paddingBottom:35},header:{flexDirection:"row",alignItems:"center",marginBottom:15},back:{fontSize:38,color:"#151f63",width:42},heading:{fontSize:25,fontWeight:"900"},hero:{backgroundColor:"white",borderRadius:20,alignItems:"center",padding:22},avatar:{width:74,height:74,borderRadius:37,alignItems:"center",justifyContent:"center"},avatarText:{color:"white",fontSize:30,fontWeight:"900"},name:{fontSize:22,fontWeight:"900",marginTop:10},rank:{color:"#666b78",marginTop:4},grid:{flexDirection:"row",flexWrap:"wrap",gap:10,marginTop:12},stat:{width:"48%",backgroundColor:"white",borderRadius:16,padding:15},statValue:{fontSize:21,fontWeight:"900",color:"#151f63"},statLabel:{fontSize:12,color:"#777b89",marginTop:3},card:{backgroundColor:"white",borderRadius:16,padding:16,marginTop:12},cardTitle:{fontSize:17,fontWeight:"900",marginBottom:10},line:{fontSize:14,color:"#555a68",marginTop:5},bold:{fontWeight:"900",color:"#151f63"},mode:{borderTopWidth:1,borderTopColor:"#eceef3",paddingVertical:9},modeName:{fontWeight:"800"},modeMeta:{fontSize:12,color:"#777b89",marginTop:2},muted:{color:"#777b89"},logout:{marginTop:20,alignItems:"center",padding:13},logoutText:{color:"#b42318",fontWeight:"800"},center:{flex:1,alignItems:"center",justifyContent:"center",padding:30,backgroundColor:"#f7f8fc"},loading:{marginTop:12,color:"#666b78"},error:{color:"#b42318",textAlign:"center"},primary:{marginTop:20,backgroundColor:"#151f63",paddingHorizontal:28,paddingVertical:12,borderRadius:12},primaryText:{color:"white",fontWeight:"800"}
});
