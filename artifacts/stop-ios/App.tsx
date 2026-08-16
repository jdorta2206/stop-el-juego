import { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { checkApiHealth } from "./src/api";
import type { Screen } from "./src/types";

export default function App() {
  const [screen, setScreen] = useState<Screen>("home");
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    checkApiHealth().then(() => setApiStatus("online")).catch(() => setApiStatus("offline"));
  }, []);

  if (screen === "play" || screen === "ranking" || screen === "profile") {
    const content = {
      play: ["🎯", "Jugar", "El motor de juego nativo se conectará aquí al backend real de STOP."],
      ranking: ["🏆", "Ranking", "Aquí conectaremos el ranking real de STOP."],
      profile: ["👤", "Tu perfil", "Aquí conectaremos cuenta, XP, niveles, logros y colección."],
    }[screen];

    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.emoji}>{content[0]}</Text>
          <Text style={styles.heading}>{content[1]}</Text>
          <Text style={styles.body}>{content[2]}</Text>
          <TouchableOpacity style={styles.primary} onPress={() => setScreen("home")}>
            <Text style={styles.primaryText}>Volver</Text>
          </TouchableOpacity>
        </View>
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.logo}>STOP!</Text>
          <Text style={styles.title}>Juego de Palabras Online</Text>
          <View style={styles.statusPill}>
            <View style={[styles.dot, apiStatus === "checking" && styles.dotChecking]} />
            <Text style={styles.statusText}>
              {apiStatus === "checking" ? "Comprobando servidor…" : apiStatus === "online" ? "Servidor conectado" : "Servidor no disponible"}
            </Text>
          </View>
        </View>

        <TouchableOpacity style={styles.playCard} onPress={() => setScreen("play")} activeOpacity={0.85}>
          <Text style={styles.cardEmoji}>🎯</Text>
          <View style={styles.cardContent}>
            <Text style={styles.cardTitle}>Jugar</Text>
            <Text style={styles.cardText}>Empieza una partida de STOP</Text>
          </View>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.row}>
          <TouchableOpacity style={styles.smallCard} onPress={() => setScreen("ranking")}>
            <Text style={styles.cardEmoji}>🏆</Text>
            <Text style={styles.smallTitle}>Ranking</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.smallCard} onPress={() => setScreen("profile")}>
            <Text style={styles.cardEmoji}>👤</Text>
            <Text style={styles.smallTitle}>Perfil</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomNav}>
          <NavButton label="Inicio" active onPress={() => setScreen("home")} />
          <NavButton label="Jugar" active={false} onPress={() => setScreen("play")} />
          <NavButton label="Ranking" active={false} onPress={() => setScreen("ranking")} />
          <NavButton label="Perfil" active={false} onPress={() => setScreen("profile")} />
        </View>
      </View>
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

function NavButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return <TouchableOpacity style={styles.navButton} onPress={onPress}><Text style={[styles.navText, active && styles.navTextActive]}>{label}</Text></TouchableOpacity>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f7f8fc" },
  container: { flex: 1, paddingHorizontal: 20 },
  hero: { paddingTop: 30, paddingBottom: 24 },
  logo: { fontSize: 48, fontWeight: "900", letterSpacing: 1 },
  title: { fontSize: 20, fontWeight: "700", marginTop: 2 },
  statusPill: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", marginTop: 12, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: "#e9f8ee" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#24a148", marginRight: 7 },
  dotChecking: { opacity: 0.35 },
  statusText: { fontSize: 13, fontWeight: "600" },
  playCard: { flexDirection: "row", alignItems: "center", padding: 20, borderRadius: 20, backgroundColor: "#151f63", minHeight: 105 },
  cardEmoji: { fontSize: 30 },
  cardContent: { flex: 1, marginLeft: 15 },
  cardTitle: { color: "white", fontSize: 24, fontWeight: "800" },
  cardText: { color: "white", opacity: 0.85, marginTop: 4, fontSize: 14 },
  arrow: { color: "white", fontSize: 38, fontWeight: "300" },
  row: { flexDirection: "row", gap: 12, marginTop: 12 },
  smallCard: { flex: 1, minHeight: 110, padding: 18, borderRadius: 18, backgroundColor: "white", justifyContent: "center" },
  smallTitle: { fontSize: 16, fontWeight: "700", marginTop: 8 },
  bottomNav: { flexDirection: "row", marginTop: "auto", paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#e2e4ec" },
  navButton: { flex: 1, alignItems: "center", paddingVertical: 8 },
  navText: { fontSize: 12, fontWeight: "600", color: "#777b89" },
  navTextActive: { color: "#151f63", fontWeight: "800" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  emoji: { fontSize: 54, marginBottom: 16 },
  heading: { fontSize: 26, fontWeight: "800", textAlign: "center" },
  body: { fontSize: 16, lineHeight: 23, textAlign: "center", color: "#5d6170", marginTop: 12 },
  primary: { marginTop: 24, backgroundColor: "#151f63", paddingHorizontal: 30, paddingVertical: 13, borderRadius: 14 },
  primaryText: { color: "white", fontWeight: "800", fontSize: 16 },
});
