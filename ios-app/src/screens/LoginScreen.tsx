import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { isAppleSignInAvailable } from '../appleAuth';
import { useSession } from '../session';

export default function LoginScreen() {
  const { signInApple, signInGoogle, signInFacebook } = useSession();
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [loading, setLoading] = useState<'apple' | 'google' | 'facebook' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  const runLogin = async (provider: 'apple' | 'google' | 'facebook', login: () => Promise<unknown>) => {
    setLoading(provider);
    setError(null);
    try {
      await login();
    } catch (e) {
      if ((e as { code?: string })?.code !== 'ERR_REQUEST_CANCELED') {
        setError(e instanceof Error ? e.message : 'No se pudo iniciar sesión.');
      }
    } finally {
      setLoading(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.logo}>STOP!</Text>
        <Text style={styles.title}>Juego de Palabras Online</Text>
        <Text style={styles.subtitle}>Inicia sesión para conservar tu progreso, ranking y colección.</Text>

        {appleAvailable && (
          <Pressable accessibilityRole="button" onPress={() => runLogin('apple', signInApple)} disabled={loading !== null} style={styles.apple}>
            {loading === 'apple' ? <ActivityIndicator color="#fff" /> : <Text style={styles.appleText}>Continuar con Apple</Text>}
          </Pressable>
        )}

        <Pressable accessibilityRole="button" onPress={() => runLogin('google', signInGoogle)} disabled={loading !== null} style={styles.google}>
          {loading === 'google' ? <ActivityIndicator /> : <Text style={styles.googleText}>Continuar con Google</Text>}
        </Pressable>

        <Pressable accessibilityRole="button" onPress={() => runLogin('facebook', signInFacebook)} disabled={loading !== null} style={styles.facebook}>
          {loading === 'facebook' ? <ActivityIndicator color="#fff" /> : <Text style={styles.facebookText}>Continuar con Facebook</Text>}
        </Pressable>

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
  apple: { width: '100%', minHeight: 50, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#000' },
  appleText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  google: { width: '100%', minHeight: 50, marginTop: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' },
  googleText: { color: '#222', fontSize: 16, fontWeight: '700' },
  facebook: { width: '100%', minHeight: 50, marginTop: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#1877F2' },
  facebookText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  error: { marginTop: 18, color: '#b00020', textAlign: 'center' },
});
