import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Linking, SafeAreaView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { createNativeBridgeScript, NativeBridgeEvent } from './iosBridge';

const GAME_URL = 'https://www.stopjuegodepalabras.com';
const GAME_HOST = 'www.stopjuegodepalabras.com';
const OAUTH_CALLBACK_PREFIX = 'stopjuego://oauth';

function isGameUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && (parsed.hostname === GAME_HOST || parsed.hostname === 'stopjuegodepalabras.com');
  } catch {
    return false;
  }
}

function isOAuthCallback(url: string) {
  return url.toLowerCase().startsWith(OAUTH_CALLBACK_PREFIX);
}

function oauthCallbackToWebUrl(url: string) {
  // The backend already supports stopjuego://oauth as a safe mobile return
  // origin. Its bridge page puts the authenticated handoff in the URL fragment.
  // Bring that callback back into the same WebView so the existing web session
  // and OAuth handoff logic can finish without opening Safari or another app.
  return `${GAME_URL}${url.slice(OAUTH_CALLBACK_PREFIX.length) || '/'}`;
}

export default function App() {
  const webViewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  const finishOAuthInWebView = useCallback((url: string) => {
    const target = oauthCallbackToWebUrl(url);
    webViewRef.current?.injectJavaScript(`window.location.replace(${JSON.stringify(target)}); true;`);
  }, []);

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url && isOAuthCallback(url)) finishOAuthInWebView(url);
    }).catch(() => undefined);

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (isOAuthCallback(url)) finishOAuthInWebView(url);
    });
    return () => subscription.remove();
  }, [finishOAuthInWebView]);

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

    if (isOAuthCallback(url)) {
      finishOAuthInWebView(url);
      return false;
    }

    // Keep ordinary iOS schemes out of the WebView and let iOS handle them.
    if (/^(mailto:|tel:|sms:)/i.test(url)) {
      void Linking.openURL(url);
      return false;
    }

    // Do not let unrelated websites take over the embedded app.
    if (/^https?:\/\//i.test(url)) {
      void Linking.openURL(url);
      return false;
    }

    return true;
  }, [finishOAuthInWebView]);

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const message = JSON.parse(event.nativeEvent.data) as NativeBridgeEvent;
      if (message.type === 'ready') {
        setReady(true);
        return;
      }
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
