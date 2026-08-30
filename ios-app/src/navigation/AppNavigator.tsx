import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useSession } from '../session';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import GameSetupScreen from '../screens/GameSetupScreen';
import GameScreen from '../screens/GameScreen';
import MultiplayerScreen from '../screens/MultiplayerScreen';
import type { NativeGameConfig } from '../game/gameConfig';

export type RootStackParamList = {
  Login: undefined;
  Home: undefined;
  GameSetup: undefined;
  Game: { config?: NativeGameConfig };
  Multiplayer: undefined;
};

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
            <Stack.Screen name="GameSetup" component={GameSetupScreen} options={{ title: 'Nueva partida' }} />
            <Stack.Screen name="Game" component={GameScreen} options={{ title: 'STOP' }} />
            <Stack.Screen name="Multiplayer" component={MultiplayerScreen} options={{ title: 'Multijugador' }} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
