import { useState, useEffect } from "react";
import { AVATAR_COLORS } from "@/lib/utils";

export interface PlayerProfile {
  id: string;
  name: string;
  avatarColor: string;
  loginMethod?: string | null;
  picture?: string | null;
  fbAccessToken?: string | null;
}

const STORAGE_KEY = "stop_player_v2";

// 🔄 Cross-component sync: every mounted `usePlayer` instance had its own
// useState, so a rename in <Layout> never reached <Multiplayer> until that
// page remounted. The join request kept sending the old name and the server's
// new unique-name guard rejected it as a duplicate. We solve this with a tiny
// pub/sub: writers dispatch `player-changed`, all hooks re-read from storage.
const PLAYER_EVENT = "stop:player-changed";

function readStoredPlayer(): PlayerProfile | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.id && parsed.name) return parsed as PlayerProfile;
    return null;
  } catch {
    return null;
  }
}

function writeStoredPlayer(profile: PlayerProfile | null) {
  if (profile) localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  else localStorage.removeItem(STORAGE_KEY);
  // Notify every hook instance in this tab. The native `storage` event only
  // fires across tabs, so we use a custom event for the same-tab case.
  window.dispatchEvent(new CustomEvent(PLAYER_EVENT));
}

export function usePlayer() {
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

  useEffect(() => {
    const refresh = () => {
      let stored = readStoredPlayer();
      // Auto-creación de perfil invitado en la primera visita: en vez de
      // bloquear al usuario con el modal de login al abrir la app, le creamos
      // un perfil anónimo persistente y entra directo a jugar. Puede iniciar
      // sesión con Google/Facebook luego desde su perfil (botón "Cambiar
      // cuenta" / showAuth). Esto resuelve el caso TWA donde el localStorage
      // del dominio replit.app se pierde con frecuencia y la app pedía login
      // en cada cold start, frustrando al usuario.
      if (!stored) {
        const randomId = (typeof crypto !== "undefined" && crypto.randomUUID)
          ? crypto.randomUUID()
          : "guest_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
        const guestNumber = Math.floor(1000 + Math.random() * 9000);
        const guestProfile: PlayerProfile = {
          id: randomId,
          name: `Jugador ${guestNumber}`,
          avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)],
          loginMethod: "guest",
          picture: null,
          fbAccessToken: null,
        };
        writeStoredPlayer(guestProfile);
        stored = guestProfile;
      }
      setPlayer(stored);
      setNeedsAuth(false);
    };
    refresh();
    setIsLoaded(true);

    const handler = () => refresh();
    window.addEventListener(PLAYER_EVENT, handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener(PLAYER_EVENT, handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const savePlayer = (profile: PlayerProfile) => {
    writeStoredPlayer(profile);
    setPlayer(profile);
    setNeedsAuth(false);
  };

  const updateProfile = (updates: Partial<PlayerProfile>) => {
    const current = player ?? readStoredPlayer();
    if (!current) return;
    const updated = { ...current, ...updates };
    savePlayer(updated);
  };

  const saveFbToken = (token: string) => {
    const current = player ?? readStoredPlayer();
    if (!current) return;
    const updated = { ...current, fbAccessToken: token };
    writeStoredPlayer(updated);
    setPlayer(updated);
  };

  const logout = () => {
    writeStoredPlayer(null);
    setPlayer(null);
    setNeedsAuth(true);
  };

  const showAuth = () => setNeedsAuth(true);

  return { player, isLoaded, needsAuth, savePlayer, updateProfile, saveFbToken, logout, showAuth };
}
