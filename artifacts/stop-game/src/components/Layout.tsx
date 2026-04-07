import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { usePlayer } from "@/hooks/use-player";
import { Crown, LogOut, Bell, BellOff, Home, Trophy, Users, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Input } from "./ui";
import { AuthModal } from "./AuthModal";
import { LanguageSelector } from "./LanguageSelector";
import { AVATAR_COLORS } from "@/lib/utils";
import { useT } from "@/i18n/useT";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { usePWAInstall } from "@/hooks/usePWAInstall";

const LOGO_URL = `${import.meta.env.BASE_URL}images/stop-logo.png`;

const NAV_ITEMS = [
  { href: "/", icon: Home, label: "Inicio" },
  { href: "/ranking", icon: Trophy, label: "Ranking" },
  { href: "/amigos", icon: Users, label: "Amigos" },
  { href: "/reto", icon: Calendar, label: "Reto" },
] as const;

export function Layout({ children }: { children: ReactNode }) {
  const { player, isLoaded, needsAuth, savePlayer, updateProfile, logout } = usePlayer();
  const { t, lang } = useT();
  const [location] = useLocation();
  const [showProfile, setShowProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const { isSupported, isSubscribed, permission, loading: notifLoading, subscribe, unsubscribe } =
    usePushNotifications(player?.id, lang);
  const { canInstall, isInstalled, isInstalling, triggerInstall } = usePWAInstall();
  const [notifToast, setNotifToast] = useState<string | null>(null);
  const [showNotifPrompt, setShowNotifPrompt] = useState(false);

  // Proactive prompt — show 3s after mount, if not subscribed/denied
  // In TWA/standalone mode: ignore the previous "dismissed" flag so users who installed
  // from Play Store still get prompted to allow notifications.
  useEffect(() => {
    const isStandalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as any).standalone;
    const dismissed = localStorage.getItem("stop_notif_prompt_v1");
    // In TWA/standalone mode, only respect dismissed flag if user is already subscribed
    if (dismissed && !(isStandalone && !isSubscribed)) return;
    const shouldShow = canInstall || (isSupported && !isSubscribed && permission !== "denied" && permission !== "granted");
    if (!shouldShow) return;
    const timer = setTimeout(() => setShowNotifPrompt(true), 3000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canInstall, isSupported, isSubscribed, permission]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.img
          src={LOGO_URL}
          alt="STOP"
          className="w-24 h-24 rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        />
      </div>
    );
  }

  const openProfile = () => {
    setEditName(player?.name || "");
    setEditColor(player?.avatarColor || AVATAR_COLORS[0]);
    setShowProfile(true);
  };

  const handleSaveProfile = () => {
    if (editName.trim()) {
      updateProfile({ name: editName.trim(), avatarColor: editColor });
    }
    setShowProfile(false);
  };

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      <AnimatePresence>
        {needsAuth && (
          <AuthModal
            onSave={savePlayer}
            initial={player}
          />
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="w-full px-4 py-3 flex items-center justify-between z-10 max-w-5xl mx-auto w-full">
        <Link href="/">
          <motion.img
            src={LOGO_URL}
            alt="STOP"
            className="w-12 h-12 rounded-full cursor-pointer"
            whileHover={{ scale: 1.08, rotate: -5 }}
            whileTap={{ scale: 0.95 }}
            style={{ boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}
          />
        </Link>

        <div className="flex items-center gap-2">
          {/* Language selector */}
          <LanguageSelector />

          {/* Notification bell — visible for all users on supported browsers */}
          {isSupported && permission !== "denied" && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={async () => {
                if (isSubscribed) {
                  await unsubscribe();
                  setNotifToast("🔕 Notificaciones desactivadas");
                } else {
                  const ok = await subscribe();
                  if (ok) setNotifToast("🔔 ¡Notificaciones activadas!");
                }
                setTimeout(() => setNotifToast(null), 3500);
              }}
              disabled={notifLoading}
              title={isSubscribed ? "Desactivar notificaciones" : "Activar notificaciones"}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10 relative"
              style={{ color: isSubscribed ? "#f9a825" : "rgba(255,255,255,0.45)" }}
            >
              {isSubscribed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              {/* Pulsing dot when not subscribed */}
              {!isSubscribed && (
                <motion.span
                  animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
                  transition={{ repeat: Infinity, duration: 1.8 }}
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-red-500"
                />
              )}
              {isSubscribed && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#f9a825]" />
              )}
            </motion.button>
          )}

          {/* Player chip */}
          {player && (
            <button
              onClick={openProfile}
              className="flex items-center gap-2 rounded-full px-2 py-1.5 transition-colors hover:bg-black/20"
            >
              <div
                className="w-8 h-8 rounded-full border-2 border-white/60 flex items-center justify-center text-white font-black text-sm shadow"
                style={{ backgroundColor: player.avatarColor }}
              >
                {player.name.charAt(0).toUpperCase()}
              </div>
              <span className="font-bold text-white text-sm truncate max-w-[90px] hidden sm:block">
                {player.name}
              </span>
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 pb-24 z-10 flex flex-col">
        {children}
      </main>

      {/* Bottom navigation bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around px-2 py-2 safe-area-pb"
        style={{
          background: "rgba(10,18,60,0.97)",
          backdropFilter: "blur(16px)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const isActive = href === "/"
            ? location === "/" || location === ""
            : location.startsWith(href);
          return (
            <Link key={href} href={href}>
              <motion.div
                whileTap={{ scale: 0.88 }}
                className="flex flex-col items-center gap-0.5 px-4 py-1 rounded-2xl transition-all cursor-pointer min-w-[60px]"
                style={isActive
                  ? { background: "rgba(249,168,37,0.15)" }
                  : {}
                }
              >
                <Icon
                  size={22}
                  style={{ color: isActive ? "#f9a825" : "rgba(255,255,255,0.4)" }}
                />
                <span
                  className="text-[10px] font-bold leading-none"
                  style={{ color: isActive ? "#f9a825" : "rgba(255,255,255,0.35)" }}
                >
                  {label}
                </span>
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <footer className="hidden w-full border-t border-white/10 mt-4 py-4 px-4 z-10">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-5 gap-y-1">
          <Link href="/acerca" className="text-white/40 hover:text-white/70 text-xs transition-colors">
            Acerca de
          </Link>
          <Link href="/privacy" className="text-white/40 hover:text-white/70 text-xs transition-colors">
            Privacidad
          </Link>
          <Link href="/terms" className="text-white/40 hover:text-white/70 text-xs transition-colors">
            Términos
          </Link>
          <Link href="/como-jugar" className="text-white/40 hover:text-white/70 text-xs transition-colors">
            Cómo jugar
          </Link>
          <a
            href="mailto:stopeljuegodepalabras@gmail.com"
            className="text-white/40 hover:text-white/70 text-xs transition-colors"
          >
            Contacto
          </a>
          <span className="text-white/20 text-xs">© 2026 STOP El Juego</span>
        </div>
      </footer>

      {/* Proactive install + notification prompt */}
      <AnimatePresence>
        {showNotifPrompt && (
          <motion.div
            key="notif-prompt"
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.35 }}
            className="fixed bottom-20 left-0 right-0 z-50 flex justify-center px-4"
          >
            <div
              className="w-full max-w-sm rounded-3xl p-5 shadow-2xl flex flex-col gap-3"
              style={{
                background: "linear-gradient(145deg, #1a237e 0%, #0d1757 100%)",
                border: "2px solid rgba(249,168,37,0.4)",
              }}
            >
              {/* Header */}
              <div className="flex items-start gap-3">
                <span className="text-3xl mt-0.5">🔔</span>
                <div className="flex-1">
                  <p className="text-white font-black text-sm leading-tight">
                    {lang === "en" ? "Get daily notifications!" : lang === "pt" ? "Recebe notificações diárias!" : lang === "fr" ? "Reçois des notifs quotidiennes !" : "¡Activa las notificaciones!"}
                  </p>
                  <p className="text-white/55 text-xs mt-1 leading-relaxed">
                    {lang === "en"
                      ? "Install the app and allow notifications to get the daily challenge on your lock screen."
                      : lang === "pt"
                      ? "Instala a app e permite notificações para receber o desafio diário no ecrã de bloqueio."
                      : lang === "fr"
                      ? "Installe l'app et autorise les notifs pour recevoir le défi du jour sur ton écran verrouillé."
                      : "Instala la app y activa los avisos para recibir el reto diario en tu pantalla de bloqueo."}
                  </p>
                </div>
                <button
                  onClick={() => { setShowNotifPrompt(false); localStorage.setItem("stop_notif_prompt_v1", "1"); }}
                  className="text-white/30 hover:text-white/60 text-lg leading-none mt-0.5"
                >✕</button>
              </div>

              {/* Step indicators */}
              <div className="flex flex-col gap-2">
                {/* Step 1: Install PWA (only on Android Chrome when installable) */}
                {canInstall && (
                  <div className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: "rgba(249,168,37,0.12)", border: "1px solid rgba(249,168,37,0.3)" }}>
                    <span className="text-lg">📲</span>
                    <div className="flex-1">
                      <p className="text-white font-black text-xs">
                        {lang === "en" ? "Step 1 · Install the app" : lang === "pt" ? "Passo 1 · Instalar a app" : lang === "fr" ? "Étape 1 · Installer l'app" : "Paso 1 · Instalar la app"}
                      </p>
                      <p className="text-white/50 text-[10px]">
                        {lang === "en" ? "Appears in your home screen & notification settings" : lang === "pt" ? "Aparece no ecrã inicial e nas notificações" : lang === "fr" ? "Apparaît sur l'écran d'accueil et dans les notifs" : "Aparece en tu pantalla de inicio y ajustes de notif."}
                      </p>
                    </div>
                    <button
                      onClick={async () => {
                        const result = await triggerInstall();
                        if (result === "accepted") {
                          setNotifToast("📲 ¡App instalada!");
                          setTimeout(() => setNotifToast(null), 3000);
                        }
                      }}
                      disabled={isInstalling}
                      className="px-3 py-1.5 rounded-xl font-black text-[11px] text-[#0d1757] flex-shrink-0"
                      style={{ background: "#f9a825" }}
                    >
                      {isInstalling ? "..." : lang === "en" ? "Install" : lang === "pt" ? "Instalar" : lang === "fr" ? "Installer" : "Instalar"}
                    </button>
                  </div>
                )}

                {/* Step 2: Allow notifications */}
                {isSupported && permission !== "denied" && (
                  <div
                    className="flex items-center gap-3 p-3 rounded-2xl"
                    style={{
                      background: isSubscribed ? "rgba(74,222,128,0.1)" : "rgba(255,255,255,0.06)",
                      border: `1px solid ${isSubscribed ? "rgba(74,222,128,0.3)" : "rgba(255,255,255,0.1)"}`,
                    }}
                  >
                    <span className="text-lg">{isSubscribed ? "✅" : "🔔"}</span>
                    <div className="flex-1">
                      <p className="text-white font-black text-xs">
                        {canInstall
                          ? (lang === "en" ? "Step 2 · Allow notifications" : lang === "pt" ? "Passo 2 · Permitir notificações" : lang === "fr" ? "Étape 2 · Autoriser les notifs" : "Paso 2 · Permitir notificaciones")
                          : (lang === "en" ? "Allow notifications" : lang === "pt" ? "Permitir notificações" : lang === "fr" ? "Autoriser les notifs" : "Permitir notificaciones")}
                      </p>
                      <p className="text-white/50 text-[10px]">
                        {isSubscribed
                          ? (lang === "en" ? "Active ✓" : lang === "pt" ? "Ativo ✓" : lang === "fr" ? "Activé ✓" : "Activadas ✓")
                          : (lang === "en" ? "The browser will ask for permission" : lang === "pt" ? "O navegador pedirá permissão" : lang === "fr" ? "Le navigateur demandera la permission" : "El navegador te pedirá permiso")}
                      </p>
                    </div>
                    {!isSubscribed && (
                      <button
                        onClick={async () => {
                          const ok = await subscribe();
                          if (ok) {
                            setNotifToast("🔔 ¡Notificaciones activadas!");
                            setTimeout(() => setNotifToast(null), 3500);
                            setShowNotifPrompt(false);
                            localStorage.setItem("stop_notif_prompt_v1", "1");
                          }
                        }}
                        disabled={notifLoading}
                        className="px-3 py-1.5 rounded-xl font-black text-[11px] text-[#0d1757] flex-shrink-0"
                        style={{ background: "#f9a825" }}
                      >
                        {notifLoading ? "..." : lang === "en" ? "Allow" : lang === "pt" ? "Permitir" : lang === "fr" ? "Autoriser" : "Permitir"}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Dismiss */}
              <button
                onClick={() => { setShowNotifPrompt(false); localStorage.setItem("stop_notif_prompt_v1", "1"); }}
                className="text-center text-white/35 text-xs font-bold py-1"
              >
                {lang === "en" ? "No thanks" : lang === "pt" ? "Não, obrigado" : lang === "fr" ? "Non merci" : "Ahora no"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Notification toast */}
      <AnimatePresence>
        {notifToast && (
          <motion.div
            initial={{ opacity: 0, y: -40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -40 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl font-bold text-sm text-white shadow-2xl"
            style={{ background: "rgba(26,35,126,0.95)", border: "1px solid rgba(249,168,37,0.5)", whiteSpace: "nowrap" }}
          >
            {notifToast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Profile modal */}
      <AnimatePresence>
        {showProfile && (
          <Modal onClose={() => setShowProfile(false)} title={t.nav.home}>
            <div className="space-y-5">
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-16 h-16 rounded-full border-4 border-white/30 flex items-center justify-center text-white font-black text-3xl shadow-lg"
                  style={{ backgroundColor: editColor }}
                >
                  {editName.charAt(0).toUpperCase() || "?"}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-white/60 uppercase tracking-wider mb-1 block">
                  {t.multiplayer.playerName}
                </label>
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  maxLength={14}
                  placeholder={t.multiplayer.enterName}
                />
              </div>

              <div>
                <label className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2 block">
                  Avatar
                </label>
                <div className="flex flex-wrap gap-2">
                  {AVATAR_COLORS.map(color => (
                    <button
                      key={color}
                      onClick={() => setEditColor(color)}
                      className="w-9 h-9 rounded-full border-4 transition-all hover:scale-110"
                      style={{
                        backgroundColor: color,
                        borderColor: editColor === color ? "white" : "transparent",
                        boxShadow: editColor === color ? "0 0 0 2px rgba(255,255,255,0.4)" : "none",
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Notification toggle in profile */}
              {isSupported && permission !== "unsupported" && (
                <div>
                  <label className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2 block">
                    🔔 {lang === "en" ? "Notifications" : lang === "pt" ? "Notificações" : lang === "fr" ? "Notifications" : "Notificaciones"}
                  </label>
                  {permission === "denied" ? (
                    <div className="flex items-center gap-2 py-2 px-3 rounded-xl" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)" }}>
                      <span className="text-red-400 text-xs font-bold flex-1">
                        {lang === "en" ? "Blocked in browser settings. Go to Settings → Apps → Chrome → Notifications to enable." : lang === "pt" ? "Bloqueado. Vai a Definições → Apps → Chrome → Notificações." : lang === "fr" ? "Bloqué. Va dans Réglages → Apps → Chrome → Notifications." : "Bloqueadas. Ve a Ajustes → Apps → Chrome → Notificaciones para activarlas."}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={async () => {
                        if (isSubscribed) {
                          await unsubscribe();
                          setNotifToast("🔕 Notificaciones desactivadas");
                        } else {
                          const ok = await subscribe();
                          if (ok) {
                            setNotifToast("🔔 ¡Notificaciones activadas! Ahora aparecerás en Ajustes → Notificaciones");
                            localStorage.setItem("stop_notif_prompt_v1", "1");
                          }
                        }
                        setTimeout(() => setNotifToast(null), 5000);
                      }}
                      disabled={notifLoading}
                      className="w-full flex items-center gap-3 py-3 px-4 rounded-xl transition-all active:scale-95"
                      style={isSubscribed
                        ? { background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.35)" }
                        : { background: "rgba(249,168,37,0.12)", border: "1px solid rgba(249,168,37,0.35)" }
                      }
                    >
                      <span className="text-2xl">{isSubscribed ? "🔔" : "🔕"}</span>
                      <div className="flex-1 text-left">
                        <p className="text-white font-black text-sm">
                          {isSubscribed
                            ? (lang === "en" ? "Notifications ON" : lang === "pt" ? "Notificações ATIVAS" : lang === "fr" ? "Notifications ACTIVÉES" : "Notificaciones ACTIVADAS")
                            : (lang === "en" ? "Activate notifications" : lang === "pt" ? "Ativar notificações" : lang === "fr" ? "Activer les notifications" : "Activar notificaciones")}
                        </p>
                        <p className="text-white/50 text-xs">
                          {isSubscribed
                            ? (lang === "en" ? "Tap to disable" : lang === "pt" ? "Toca para desativar" : lang === "fr" ? "Appuie pour désactiver" : "Toca para desactivar")
                            : (lang === "en" ? "Get daily challenge alerts" : lang === "pt" ? "Recebe alertas do desafio diário" : lang === "fr" ? "Reçois les alertes du défi quotidien" : "Recibe el reto diario en tu pantalla")}
                        </p>
                      </div>
                      <span className="text-xs font-black px-2 py-1 rounded-lg" style={{ background: isSubscribed ? "rgba(74,222,128,0.2)" : "rgba(249,168,37,0.25)", color: isSubscribed ? "#4ade80" : "#f9a825" }}>
                        {notifLoading ? "..." : isSubscribed ? (lang === "en" ? "ON" : "ON") : (lang === "en" ? "OFF" : "OFF")}
                      </span>
                    </button>
                  )}
                </div>
              )}

              <Button className="w-full" onClick={handleSaveProfile}>
                ✓ Guardar
              </Button>

              <button
                onClick={() => { setShowProfile(false); logout(); }}
                className="w-full flex items-center justify-center gap-2 text-white/40 text-sm hover:text-white/70 transition-colors py-1"
              >
                <LogOut className="w-4 h-4" /> {t.nav.logout}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </div>
  );
}

function Modal({
  children,
  title,
  onClose,
}: {
  children: ReactNode;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative z-10 w-full max-w-sm rounded-3xl p-6 shadow-2xl"
        style={{
          background: "linear-gradient(145deg, #1a237e 0%, #0d1757 100%)",
          border: "2px solid rgba(249,168,37,0.3)",
        }}
      >
        {title && (
          <h2 className="text-xl font-black text-white mb-5 text-center">{title}</h2>
        )}
        {children}
      </motion.div>
    </div>
  );
}
