# iOS authentication architecture

STOP iOS keeps one account identity and uses the existing STOP API. Google and Facebook use the backend OAuth endpoints; Apple uses native Sign in with Apple and will exchange the Apple credential with the backend once the Apple service is configured.

Tokens must be stored with `expo-secure-store`, never AsyncStorage. OAuth provider secrets stay on the server. The iOS app must use a development build/EAS build for native Google/Facebook/Apple authentication; Expo Go is not sufficient for providers requiring custom native code.

Account linking must be performed server-side using verified provider identities. The app must never create a second STOP player solely because the same person used another provider.
