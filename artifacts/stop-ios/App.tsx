import { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { checkApiHealth } from './src/api';

export default function App() {
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking');

  useEffect(() => {
    checkApiHealth().then(() => setApiStatus('online')).catch(() => setApiStatus('offline'));
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.logo}>STOP!</Text>
        <Text style={styles.title}>Juego de Palabras Online</Text>
        <Text style={styles.subtitle}>Estamos preparando la versión nativa para iPhone.</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Conexión con STOP</Text>
          <Text style={styles.cardText}>
            {apiStatus === 'checking' && 'Comprobando el servidor…'}
            {apiStatus === 'online' && '✓ Servidor conectado correctamente'}
            {apiStatus === 'offline' && '✕ No se ha podido conectar con el servidor'}
          </Text>
        </View>
        <StatusBar style="auto" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo: { fontSize: 52, fontWeight: '900', letterSpacing: 1 },
  title: { fontSize: 22, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  subtitle: { fontSize: 16, lineHeight: 23, textAlign: 'center', marginTop: 14, maxWidth: 420 },
  card: { width: '100%', maxWidth: 420, padding: 20, borderRadius: 18, marginTop: 28 },
  cardTitle: { fontSize: 18, fontWeight: '700' },
  cardText: { fontSize: 15, lineHeight: 22, marginTop: 8 },
});
