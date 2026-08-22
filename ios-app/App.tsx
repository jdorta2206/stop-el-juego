import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { createNativeBridgeScript, NativeBridgeEvent } from './iosBridge';

const GAME_URL = 'https://www.stopjuegodepalabras.com';
const GAME_HOST = 'www.stopjuegodepalabras.com';

function isGameUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && (parsed.hostname === GAME_HOST || parsed.hostname === 'stopjuegodepalabras.com');
  } catch {
    return false;
  }
}

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  const postAppState = useCallback((state: string) => {
    webViewRef.current?.injectJavaScript(`
      window.__STOP_IOS_BRIDGE__ && window.__STOP_IOS_BRIDGE__.emit(${JSON.stringify({
        type: 'app-state',
        state,
      })});
      true;
    `);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', postAppState);
    return () => subscription.remove();
  }, [postAppState]);

  const handleNavigation = useCallback((request: ShouldStartLoadRequest) => {
    const { url } = request;

    if (isGameUrl(url)) return true;

    // Keep normal iOS schemes (Apple sign-in callbacks, mail, tel, etc.) out
    // of the WebView and let iOS handle them natively.
    if (/^(mailto:|tel:|sms:|stopjuego:)/i.test(url)) {
      void Linking.openURL(url);
      return false;
    }

    // Do not let unrelated websites take over the embedded app.
    if (/^https?:\/\//i.test(url)) {
      void Linking.openURL(url);
      return false;
    }

    return true;
  }, []);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as NativeBridgeEvent;
      if (message.type === 'ready') {
        setReady(true);
        return;
      }
      // Native actions will be connected here later (StoreKit, share sheet,
      // notifications, etc.). We deliberately keep this layer passive for now.
      if (message.type === 'native-action') return;
    } catch {
      // Ignore non-bridge messages from the web app.
    }
  }, []);

  return (
    <SafeAreaView style={styles.root}>
      <StatusBar style="auto" />
      <WebView
        ref={webViewRef}
        source={{ uri: GAME_URL }}
        originWhitelist={['https://*']}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        allowsInlineMediaPlayback
        setSupportMultipleWindows={false}
        injectedJavaScriptBeforeContentLoaded={createNativeBridgeScript()}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={handleNavigation}
        startInLoadingState
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" />
          </View>
        )}
      />
      {!ready && null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
