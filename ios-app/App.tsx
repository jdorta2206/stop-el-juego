import React from 'react';
import AppNavigator from './src/navigation/AppNavigator';
import { SessionProvider } from './src/session';

export default function App() {
  return (
    <SessionProvider>
      <AppNavigator />
    </SessionProvider>
  );
}
