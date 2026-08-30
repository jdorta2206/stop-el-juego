import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export type RootStackParamList = {
  Home: undefined;
  Game: undefined;
  Ranking: undefined;
  Profile: undefined;
  Shop: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function HomeScreen({ navigation }: any) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>STOP! Juego de Palabras</Text>
      <Text style={styles.subtitle}>La aplicación nativa para iPhone</Text>
      <Pressable style={styles.button} onPress={() => navigation.navigate('Game')}><Text style={styles.buttonText}>Jugar</Text></Pressable>
      <Pressable style={styles.button} onPress={() => navigation.navigate('Ranking')}><Text style={styles.buttonText}>Ranking</Text></Pressable>
      <Pressable style={styles.button} onPress={() => navigation.navigate('Profile')}><Text style={styles.buttonText}>Perfil</Text></Pressable>
      <Pressable style={styles.button} onPress={() => navigation.navigate('Shop')}><Text style={styles.buttonText}>Tienda</Text></Pressable>
    </View>
  );
}

function PlaceholderScreen({ title }: { title: string }) {
  return <View style={styles.container}><Text style={styles.title}>{title}</Text><Text style={styles.subtitle}>Pantalla nativa en construcción.</Text></View>;
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'STOP' }} />
        <Stack.Screen name="Game" children={() => <PlaceholderScreen title="Partida" />} />
        <Stack.Screen name="Ranking" children={() => <PlaceholderScreen title="Ranking" />} />
        <Stack.Screen name="Profile" children={() => <PlaceholderScreen title="Perfil" />} />
        <Stack.Screen name="Shop" children={() => <PlaceholderScreen title="Tienda" />} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', marginBottom: 10 },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 24 },
  button: { width: '100%', maxWidth: 360, padding: 16, borderRadius: 12, marginVertical: 6, backgroundColor: '#111' },
  buttonText: { color: '#fff', textAlign: 'center', fontSize: 17, fontWeight: '600' },
});
