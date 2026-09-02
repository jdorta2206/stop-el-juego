import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../session';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import ProfileScreen from '../screens/ProfileScreen';
import RankingScreen from '../screens/RankingScreen';
import CollectionScreen from '../screens/CollectionScreen';
import GameSetupScreen from '../screens/GameSetupScreen';
import GameScreen from '../screens/GameScreen';
import MultiplayerScreen from '../screens/MultiplayerScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function LoadingScreen() {
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator size="large" /></View>;
}

export default function AppNavigator() {
  const { session, loading } = useSession();
  if (loading) return <LoadingScreen />;

  return (
    <NavigationContainer>
      <Stack.Navigator>
        {!session ? (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'STOP' }} />
            <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Mi perfil' }} />
            <Stack.Screen name="Ranking" component={RankingScreen} options={{ title: 'Ranking' }} />
            <Stack.Screen name="Collection" component={CollectionScreen} options={{ title: 'Colección' }} />
            <Stack.Screen name="GameSetup" component={GameSetupScreen} options={{ title: 'Nueva partida' }} />
            <Stack.Screen name="Game" component={GameScreen} options={{ title: 'STOP' }} />
            <Stack.Screen name="Multiplayer" component={MultiplayerScreen} options={{ title: 'Multijugador' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
