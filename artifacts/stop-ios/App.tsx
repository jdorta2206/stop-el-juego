import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import * as AppleAuthentication from "expo-apple-authentication";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { checkApiHealth } from "./src/api";
import { loadSession, signInWithApple, signInWithProvider, clearSession, type StopSession } from "./src/auth";
import { GameScreen } from "./src/GameScreen";
import { MultiplayerScreen } from "./src/MultiplayerScreen";
import { RankingScreen } from "./src/RankingScreen";
import { ProfileScreen } from "./src/ProfileScreen";
import { AchievementsScreen } from "./src/AchievementsScreen";
import type { Screen } from "./src/types";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [session, setSession] = useState<StopSession | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    checkApiHealth().then(() => setApiStatus("online")).catch(() => setApiStatus("offline"));
    loadSession().then(setSession).catch(() => setSession(null));
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  async function handleProviderLogin(provider: "google" | "facebook") {
    setAuthBusy(true); setAuthError(null);
    try { setSession(await signInWithProvider(provider)); }
    catch (error) { const message = error instanceof Error ? error.message : "No se pudo iniciar sesión."; if (!message.toLowerCase().includes("cancelado")) setAuthError(message); }
    finally { setAuthBusy(false); }
  }

  async function handleAppleLogin() {
    setAuthBusy(true); setAuthError(null);
    try { setSession(await signInWithApple()); }
    catch (error) { const message = error instanceof Error ? error.message : "No se pudo iniciar sesión con Apple."; if (!message.toLowerCase().includes("cancel")) setAuthError(message); }
    finally { setAuthBusy(false); }
  }

  async function handleLogout() { await clearSession(); setSession(null); setScreen("home"); }

  if (screen === "play") return <GameScreen onExit={() => setScreen("home")} />;

  if (screen === "multiplayer") {
    if (!session) return <SafeAreaView style={styles.safeArea}><View style={styles.center}><Text style={styles.emoji}>🔐</Text><Text style={styles.heading}>Inicia sesión</Text><Text style={styles.body}>Para jugar al multijugador necesitas una cuenta de STOP.</Text><TouchableOpacity style={styles.primary} onPress={() => setScreen("home")}><Text style={styles.primaryText}>Volver al inicio</Text></TouchableOpacity></View><StatusBar style="auto" /></SafeAreaView>;
    return <MultiplayerScreen session={session} onExit={() => setScreen("home")} />;
  }

  if (screen === "ranking") return <RankingScreen onExit={() => setScreen("home")} />;
  if (screen === "achievements") {
    if (!session) return <SafeAreaView style={styles.safeArea}><View style={styles.center}><Text style={styles.emoji}>🏆</Text><Text style={styles.heading}>Logros</Text><Text style={styles.body}>Inicia sesión para cargar tus logros.</Text><TouchableOpacity style={styles.primary} onPress={() => setScreen("home")}><Text style={styles.primaryText}>Volver al inicio</Text></TouchableOpacity></View><StatusBar style="auto" /></SafeAreaView>;
    return <AchievementsScreen session={session} onExit={() => setScreen("home")} />;
  }
  if (screen === "profile") {
    if (!session) return <SafeAreaView style={styles.safeArea}><View style={styles.center}><Text style={styles.emoji}>👤</Text><Text style={styles.heading}>Tu perfil</Text><Text style={styles.body}>Inicia sesión para cargar tu perfil real.</Text><TouchableOpacity style={styles.primary} onPress={() => setScreen("home")}><Text style={styles.primaryText}>Volver al inicio</Text></TouchableOpacity></View><StatusBar style="auto" /></SafeAreaView>;
    return <ProfileScreen session={session} onExit={() => setScreen("home")} onLogout={handleLogout} />;
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.hero}><Text style={styles.logo}>STOP!</Text><Text style={styles.title}>Juego de Palabras Online</Text><View style={styles.statusPill}><View style={[styles.dot, apiStatus === "checking" && styles.dotChecking, apiStatus === "offline" && styles.dotOffline]} /><Text style={styles.statusText}>{apiStatus === "checking" ? "Comprobando servidor…" : apiStatus === "online" ? "Servidor conectado" : "Servidor no disponible"}</Text></View></View>

        {!session && <View style={styles.authBox}>
          <Text style={styles.authTitle}>Guarda tu progreso</Text>
          <TouchableOpacity style={styles.providerButton} disabled={authBusy} onPress={() => handleProviderLogin("google")}><Text style={styles.providerIcon}>G</Text><Text style={styles.providerText}>Continuar con Google</Text></TouchableOpacity>
          <TouchableOpacity style={styles.providerButton} disabled={authBusy} onPress={() => handleProviderLogin("facebook")}><Text style={styles.providerIcon}>f</Text><Text style={styles.providerText}>Continuar con Facebook</Text></TouchableOpacity>
          {appleAvailable && <AppleAuthentication.AppleAuthenticationButton buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE} buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK} cornerRadius={10} style={styles.appleButton} onPress={handleAppleLogin} />}
          {authBusy && <Text style={styles.authHint}>Conectando…</Text>}
          {authError && <Text style={styles.error}>{authError}</Text>}
        </View>}

        {session && <View style={styles.loggedIn}><Text style={styles.loggedInText}>✓ Sesión iniciada · {session.user.name || "Jugador STOP"}</Text></View>}
        <TouchableOpacity style={styles.playCard} onPress={() => setScreen("play")} activeOpacity={0.85}><Text style={styles.cardEmoji}>🎯</Text><View style={styles.cardContent}><Text style={styles.cardTitle}>Jugar</Text><Text style={styles.cardText}>Empieza una partida real de STOP</Text></View><Text style={styles.arrow}>›</Text></TouchableOpacity>
        {session && <TouchableOpacity style={styles.multiCard} onPress={() => setScreen("multiplayer")} activeOpacity={0.85}><Text style={styles.cardEmoji}>👥</Text><View style={styles.cardContent}><Text style={styles.multiTitle}>Multijugador</Text><Text style={styles.multiText}>Juega con iPhone, Android y Web</Text></View><Text style={styles.arrow}>›</Text></TouchableOpacity>}
        <View style={styles.row}><TouchableOpacity style={styles.smallCard} onPress={() => setScreen("ranking")}><Text style={styles.cardEmoji}>🏆</Text><Text style={styles.smallTitle}>Ranking</Text></TouchableOpacity><TouchableOpacity style={styles.smallCard} onPress={() => setScreen("profile")}><Text style={styles.cardEmoji}>👤</Text><Text style={styles.smallTitle}>Perfil</Text></TouchableOpacity></View>
        {session && <TouchableOpacity style={styles.achievementsCard} onPress={() => setScreen("achievements")} activeOpacity={0.85}><Text style={styles.cardEmoji}>🏅</Text><View style={styles.cardContent}><Text style={styles.achievementsTitle}>Logros</Text><Text style={styles.achievementsText}>Mira tus insignias y progreso</Text></View><Text style={styles.arrowDark}>›</Text></TouchableOpacity>}
        <View style={styles.bottomNav}><NavButton label="Inicio" active onPress={() => setScreen("home")} /><NavButton label="Jugar" active={false} onPress={() => setScreen("play")} /><NavButton label="Ranking" active={false} onPress={() => setScreen("ranking")} /><NavButton label="Perfil" active={false} onPress={() => setScreen("profile")} /></View>
      </View><StatusBar style="auto" />
    </SafeAreaView>
  );
}
function NavButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) { return <TouchableOpacity style={styles.navButton} onPress={onPress}><Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text></TouchableOpacity>; }
const styles = StyleSheet.create({ safeArea:{flex:1,backgroundColor:"#f7f8fc"},container:{flex:1,paddingHorizontal:20},hero:{paddingTop:30,paddingBottom:18},logo:{fontSize:48,fontWeight:"900",letterSpacing:1},title:{fontSize:20,fontWeight:"700",marginTop:2},statusPill:{flexDirection:"row",alignItems:"center",alignSelf:"flex-start",marginTop:12,paddingHorizontal:12,paddingVertical:7,borderRadius:20,backgroundColor:"#e9f8ee"},dot:{width:8,height:8,borderRadius:4,backgroundColor:"#24a148",marginRight:7},dotChecking:{opacity:0.35},dotOffline:{backgroundColor:"#d92d20"},statusText:{fontSize:13,fontWeight:"600"},authBox:{backgroundColor:"white",padding:16,borderRadius:18,marginBottom:12},authTitle:{fontSize:17,fontWeight:"800",marginBottom:10},providerButton:{height:48,borderRadius:10,borderWidth:1,borderColor:"#d9dce6",flexDirection:"row",alignItems:"center",justifyContent:"center",marginBottom:9},providerIcon:{position:"absolute",left:16,fontSize:20,fontWeight:"900"},providerText:{fontSize:15,fontWeight:"700"},appleButton:{width:"100%",height:48},authHint:{textAlign:"center",marginTop:8,color:"#5d6170",fontSize:13},error:{textAlign:"center",marginTop:8,color:"#b42318"},loggedIn:{backgroundColor:"#e9f8ee",padding:11,borderRadius:12,marginBottom:12},loggedInText:{textAlign:"center",color:"#166534",fontWeight:"700",fontSize:13},playCard:{flexDirection:"row",alignItems:"center",padding:20,borderRadius:20,backgroundColor:"#151f63",minHeight:105},multiCard:{flexDirection:"row",alignItems:"center",padding:18,borderRadius:20,backgroundColor:"#2d7a5a",minHeight:88,marginTop:12},multiTitle:{color:"white",fontSize:21,fontWeight:"800"},multiText:{color:"white",opacity:0.88,marginTop:3,fontSize:13},cardEmoji:{fontSize:30},cardContent:{flex:1,marginLeft:15},cardTitle:{color:"white",fontSize:24,fontWeight:"800"},cardText:{color:"white",opacity:0.85,marginTop:4,fontSize:14},arrow:{color:"white",fontSize:38,fontWeight:"300"},row:{flexDirection:"row",gap:12,marginTop:12},smallCard:{flex:1,minHeight:110,padding:18,borderRadius:18,backgroundColor:"white",justifyContent:"center"},smallTitle:{fontSize:16,fontWeight:"700",marginTop:8},achievementsCard:{flexDirection:"row",alignItems:"center",padding:18,borderRadius:18,backgroundColor:"white",minHeight:78,marginTop:12,borderWidth:1,borderColor:"#ead9ad"},achievementsTitle:{fontSize:18,fontWeight:"900"},achievementsText:{fontSize:13,color:"#666b78",marginTop:3},arrowDark:{fontSize:38,fontWeight:"300",color:"#222733"},bottomNav:{flexDirection:"row",marginTop:"auto",paddingVertical:12,borderTopWidth:1,borderTopColor:"#e2e4ec"},navButton:{flex:1,alignItems:"center",paddingVertical:8},navText:{fontSize:12,fontWeight:"600",color:"#777b89"},navTextActive:{color:"#151f63",fontWeight:"800"},center:{flex:1,alignItems:"center",justifyContent:"center",padding:28},emoji:{fontSize:54,marginBottom:16},heading:{fontSize:26,fontWeight:"800",textAlign:"center"},body:{fontSize:16,lineHeight:23,textAlign:"center",color:"#5d6170",marginTop:12},primary:{marginTop:24,backgroundColor:"#151f63",paddingHorizontal:30,paddingVertical:13,borderRadius:14},primaryText:{color:"white",fontWeight:"800",fontSize:16}}
});
