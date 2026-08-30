import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";

const GAME_URL = "https://www.stopjuegodepalabras.com";

export function GameScreen({ onExit }: { onExit: () => void }) {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(false);
  }, []);

  const handleMessage = useCallback((_event: WebViewMessageEvent) => {
    // Reserved for the native bridge: Apple Sign In, purchases, notifications and deep links.
    // Keep the web game as the single gameplay implementation.
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onExit} accessibilityRole="button" accessibilityLabel="Volver">
            <Text style={styles.back}>‹ Volver</Text>
          </TouchableOpacity>
          <Text style={styles.title}>STOP!</Text>
        </View>

        <View style={styles.webViewContainer}>
          <WebView
            ref={webViewRef}
            source={{ uri: GAME_URL }}
            style={styles.webView}
            originWhitelist={["https://www.stopjuegodepalabras.com", "https://stopjuegodepalabras.com"]}
            javaScriptEnabled
            domStorageEnabled
            sharedCookiesEnabled
            thirdPartyCookiesEnabled
            allowsBackForwardNavigationGestures
            setSupportMultipleWindows={false}
            onLoadStart={() => { setLoading(true); setError(false); }}
            onLoadEnd={() => setLoading(false)}
            onError={() => { setLoading(false); setError(true); }}
            onMessage={handleMessage}
          />

          {loading && (
            <View style={styles.overlay} pointerEvents="none">
              <ActivityIndicator size="large" />
              <Text style={styles.loadingText}>Cargando STOP…</Text>
            </View>
          )}

          {error && (
            <View style={styles.errorOverlay}>
              <Text style={styles.errorTitle}>No se ha podido cargar STOP</Text>
              <Text style={styles.errorText}>Comprueba tu conexión a Internet e inténtalo de nuevo.</Text>
              <TouchableOpacity style={styles.retry} onPress={() => webViewRef.current?.reload()}>
                <Text style={styles.retryText}>Reintentar</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f7f8fc" },
  container: { flex: 1 },
  topBar: { height: 52, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#f7f8fc" },
  back: { fontSize: 16, fontWeight: "700", color: "#151f63" },
  title: { fontSize: 18, fontWeight: "900" },
  webViewContainer: { flex: 1, overflow: "hidden" },
  webView: { flex: 1, backgroundColor: "#f7f8fc" },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "#f7f8fc" },
  loadingText: { marginTop: 10, fontSize: 15, fontWeight: "700" },
  errorOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", padding: 28, backgroundColor: "#f7f8fc" },
  errorTitle: { fontSize: 21, fontWeight: "800", textAlign: "center" },
  errorText: { marginTop: 10, color: "#656a79", lineHeight: 22, textAlign: "center" },
  retry: { marginTop: 20, backgroundColor: "#151f63", paddingHorizontal: 24, paddingVertical: 13, borderRadius: 14 },
  retryText: { color: "white", fontWeight: "800", fontSize: 16 },
});
