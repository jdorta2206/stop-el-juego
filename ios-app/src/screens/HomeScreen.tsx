import React from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useSession } from '../session';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { session, signOut } = useSession();

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.logo}>STOP!</Text>
        <Text style={styles.title}>Juego de Palabras Online</Text>
        <Text style={styles.welcome}>
          {session?.displayName ? `Hola, ${session.displayName}` : 'Listo para jugar'}
        </Text>

        <Pressable style={styles.primary} onPress={() => navigation.navigate('GameSetup')}>
          <Text style={styles.primaryText}>JUGAR</Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => navigation.navigate('Multiplayer')}>
          <Text style={styles.secondaryText}>MULTIJUGADOR</Text>
        </Pressable>

        <Pressable style={styles.secondary} onPress={() => navigation.navigate('Profile')}>
          <Text style={styles.secondaryText}>MI PERFIL</Text>
        </Pressable>

        <Pressable accessibilityRole="button" onPress={signOut} style={styles.logout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  logo: { fontSize: 52, fontWeight: '900', letterSpacing: 2 },
  title: { marginTop: 4, fontSize: 24, fontWeight: '800', textAlign: 'center' },
  welcome: { marginTop: 14, marginBottom: 28, fontSize: 16 },
  primary: { width: '100%', maxWidth: 360, minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#111', marginBottom: 12 },
  primaryText: { color: '#fff', fontSize: 19, fontWeight: '900' },
  secondary: { width: '100%', maxWidth: 360, minHeight: 52, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  secondaryText: { fontSize: 16, fontWeight: '800' },
  logout: { marginTop: 16, padding: 10 },
  logoutText: { fontSize: 14, opacity: 0.65 },
});
