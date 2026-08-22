import { Platform } from 'react-native';

export type NativeBridgeEvent =
  | { type: 'ready' }
  | { type: 'app-state'; state: 'active' | 'inactive' | 'background' }
  | { type: 'native-action'; action: string; payload?: unknown };

export function createNativeBridgeScript(): string {
  return `
    (function () {
      if (window.__STOP_IOS_BRIDGE__) return;
      var listeners = [];
      var nativeBridge = {
        platform: ${JSON.stringify(Platform.OS)},
        post: function (event) {
          try {
            window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(event));
          } catch (_) {}
        },
        on: function (listener) {
          listeners.push(listener);
          return function () {
            listeners = listeners.filter(function (item) { return item !== listener; });
          };
        },
        emit: function (event) {
          listeners.slice().forEach(function (listener) {
            try { listener(event); } catch (_) {}
          });
        }
      };
      window.__STOP_IOS_BRIDGE__ = nativeBridge;
      nativeBridge.post({ type: 'ready' });
    })();
    true;
  `;
}
