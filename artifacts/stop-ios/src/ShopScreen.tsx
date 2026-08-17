import { useMemo } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { StopSession } from "./auth";
import { useInventory } from "./useInventory";

const WORLD_CUP_PACK_IDS = [
  "avatar_wc_ball", "avatar_wc_jersey", "avatar_wc_goal", "avatar_wc_gloves", "avatar_wc_boots",
  "avatar_wc_medal", "avatar_wc_trophy", "avatar_wc_flag_es", "avatar_wc_flag_br", "avatar_wc_flag_ar",
  "avatar_wc_flag_fr", "avatar_wc_flag_de", "avatar_wc_flag_pt", "avatar_wc_flag_it", "avatar_wc_flag_nl",
  "avatar_wc_flag_mx", "avatar_wc_flag_us", "avatar_wc_flag_uy", "avatar_wc_flag_co", "avatar_wc_flag_jp",
  "frame_wc_cesped", "frame_wc_espana", "frame_wc_copa", "bg_wc_cesped", "bg_wc_noche", "bg_wc_espana", "bg_wc_copa",
];

export function ShopScreen({ session, onExit }: { session: StopSession; onExit: () => void }) {
  const { inventory, loading, refresh } = useInventory(session.user.id);

  const ownedWorldCupCount = useMemo(() => {
    if (!inventory) return 0;
    const ownedIds = new Set([
      ...inventory.owned.avatars.map((item) => item.id),
      ...inventory.owned.frames.map((item) => item.id),
      ...inventory.owned.backgrounds.map((item) => item.id),
    ]);
    return WORLD_CUP_PACK_IDS.filter((id) => ownedIds.has(id)).length;
  }, [inventory]);

  const hasPack = ownedWorldCupCount === WORLD_CUP_PACK_IDS.length;

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onExit} style={styles.back}>
            <Text style={styles.backText}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tienda</Text>
          <View style={styles.coinPill}>
            <Text style={styles.coinIcon}>🪙</Text>
            <Text style={styles.coinText}>{inventory?.coins ?? 0}</Text>
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.globe}>🌍</Text>
          <View style={styles.heroContent}>
            <Text style={styles.title}>Pack Mundial</Text>
            <Text style={styles.subtitle}>27 cosméticos exclusivos del Mundial</Text>
            <View style={styles.badges}>
              <Text style={styles.badge}>⚽ 20 avatares</Text>
              <Text style={styles.badge}>🖼️ 3 marcos</Text>
              <Text style={styles.badge}>🎨 4 fondos</Text>
            </View>
          </View>
        </View>

        <View style={styles.purchaseCard}>
          <View>
            <Text style={styles.price}>2,99 €</Text>
            <Text style={styles.priceNote}>Pago único · sin suscripción</Text>
          </View>
          {hasPack ? (
            <View style={styles.ownedPill}>
              <Text style={styles.ownedText}>✓ Ya lo tienes</Text>
            </View>
          ) : (
            <View style={styles.comingPill}>
              <Text style={styles.comingText}>App Store · próximamente</Text>
            </View>
          )}
        </View>

        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <Text style={styles.sectionTitle}>Tu colección</Text>
            <Text style={styles.progressCount}>{ownedWorldCupCount}/27</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${(ownedWorldCupCount / 27) * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {hasPack ? "Colección mundial completa. 🏆" : "Los cosméticos que consigas aparecerán aquí automáticamente."}
          </Text>
        </View>

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>🔐 Compra segura</Text>
          <Text style={styles.infoText}>
            La compra se validará en el servidor antes de conceder los cosméticos. Si reinstalas STOP, tu colección se recuperará al iniciar sesión.
          </Text>
        </View>

        <TouchableOpacity onPress={() => void refresh()} disabled={loading} style={styles.refreshButton}>
          <Text style={styles.refreshText}>{loading ? "Actualizando…" : "Actualizar colección"}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#f7f8fc" },
  container: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: "row", alignItems: "center", marginBottom: 18 },
  back: { width: 42, height: 42, borderRadius: 14, backgroundColor: "white", alignItems: "center", justifyContent: "center" },
  backText: { fontSize: 34, lineHeight: 36, color: "#151f63" },
  headerTitle: { flex: 1, marginLeft: 14, fontSize: 28, fontWeight: "900" },
  coinPill: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff7dc", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9 },
  coinIcon: { fontSize: 16 },
  coinText: { marginLeft: 5, fontWeight: "900", color: "#7a5600" },
  hero: { flexDirection: "row", alignItems: "center", borderRadius: 24, padding: 20, backgroundColor: "#dc6b12" },
  globe: { fontSize: 58, marginRight: 15 },
  heroContent: { flex: 1 },
  title: { color: "white", fontSize: 25, fontWeight: "900" },
  subtitle: { color: "white", opacity: 0.9, marginTop: 4, fontSize: 14 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  badge: { color: "white", backgroundColor: "rgba(0,0,0,0.22)", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 8, fontSize: 11, fontWeight: "700" },
  purchaseCard: { marginTop: 14, backgroundColor: "white", borderRadius: 20, padding: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  price: { fontSize: 25, fontWeight: "900" },
  priceNote: { color: "#6b7080", marginTop: 3, fontSize: 12 },
  ownedPill: { backgroundColor: "#e9f8ee", borderWidth: 1, borderColor: "#9ad6aa", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  ownedText: { color: "#166534", fontWeight: "900", fontSize: 12 },
  comingPill: { backgroundColor: "#eef0f7", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  comingText: { color: "#555b6d", fontWeight: "800", fontSize: 11 },
  progressCard: { marginTop: 14, backgroundColor: "white", borderRadius: 20, padding: 18 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionTitle: { fontSize: 19, fontWeight: "900" },
  progressCount: { fontWeight: "900", color: "#151f63" },
  progressTrack: { height: 10, backgroundColor: "#e6e8ef", borderRadius: 10, overflow: "hidden", marginTop: 12 },
  progressFill: { height: "100%", backgroundColor: "#151f63", borderRadius: 10 },
  progressText: { marginTop: 10, color: "#626878", lineHeight: 19, fontSize: 13 },
  infoCard: { marginTop: 14, backgroundColor: "#fffdf5", borderRadius: 18, borderWidth: 1, borderColor: "#ead9ad", padding: 17 },
  infoTitle: { fontSize: 16, fontWeight: "900" },
  infoText: { marginTop: 7, color: "#68604d", lineHeight: 19, fontSize: 13 },
  refreshButton: { marginTop: 16, alignItems: "center", paddingVertical: 13 },
  refreshText: { color: "#151f63", fontWeight: "800" },
});
