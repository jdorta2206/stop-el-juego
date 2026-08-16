export type AuthProvider = "google" | "facebook" | "apple";

export const AUTH_PROVIDER_LABELS: Record<AuthProvider, string> = {
  google: "Continuar con Google",
  facebook: "Continuar con Facebook",
  apple: "Continuar con Apple",
};

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://workspaceapi-server-production-178e6.up.railway.app";

export function oauthStartUrl(provider: Exclude<AuthProvider, "apple">, returnPath = "/") {
  return `${API_BASE_URL}/api/auth/${provider}/start?return=${encodeURIComponent(returnPath)}`;
}
