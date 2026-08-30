import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, Pressable, StyleSheet } from 'react-native';

export type RootStackParamList = {
  Home: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>STOP! Juego de Palabras</Text>
      <Text style={styles.subtitle}>Aplicación nativa de iOS</Text>
      <Pressable style={styles.button} accessibilityRole="button">
        <Text style={styles.buttonText}>Jugar</Text>
      </Pressable>
    </View>
  );
}

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'STOP' }} />
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
