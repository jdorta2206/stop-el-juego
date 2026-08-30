import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { isAppleSignInAvailable } from '../appleAuth';
import { useSession } from '../session';

export default function LoginScreen() {
  const { signInApple } = useSession();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  const loginApple = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInApple();
    } catch (e) {
      if ((e as { code?: string })?.code !== 'ERR_REQUEST_CANCELED') {
        setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión con Apple.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.logo}>STOP!</Text>
        <Text style={styles.title}>Juego de Palabras Online</Text>
        <Text style={styles.subtitle}>Inicia sesión para conservar tu progreso, ranking y colección.</Text>

        {appleAvailable && (
          <Pressable accessibilityRole="button" onPress={loginApple} disabled={loading} style={styles.apple}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.appleText}>Continuar con Apple</Text>}
          </Pressable>
        )}

        {error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo: { fontSize: 48, fontWeight: '900', letterSpacing: 2 },
  title: { marginTop: 8, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  subtitle: { marginTop: 12, marginBottom: 32, color: '#666', fontSize: 16, lineHeight: 22, textAlign: 'center' },
  apple: { minWidth: 260, minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#000' },
  appleText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: { marginTop: 18, color: '#b00020', textAlign: 'center' },
});
