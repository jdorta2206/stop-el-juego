import { ReactNode, useState } from "react";
import { Link } from "wouter";
import { usePlayer } from "@/hooks/use-player";
import { Crown, LogOut, Bell, BellOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Input } from "./ui";
import { AuthModal } from "./AuthModal";
import { LanguageSelector } from "./LanguageSelector";
import { AVATAR_COLORS } from "@/lib/utils";
import { useT } from "@/i18n/useT";
import { usePushNotifications } from "@/hooks/usePushNotifications";

const LOGO_URL = `${import.meta.env.BASE_URL}images/stop-logo.png`;

export function Layout({ children }: { children: ReactNode }) {
  const { player, isLoaded, needsAuth, savePlayer, updateProfile, logout } = usePlayer();
  const { t, lang } = useT();
  const [showProfile, setShowProfile] = useState(false);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const { isSupported, isSubscribed, permission, loading: notifLoading, subscribe, unsubscribe } =
    usePushNotifications(player?.id, lang);
  const [notifToast, setNotifToast] = useState<string | null>(null);

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

          {/* Notification bell — only for logged-in, non-guest users on supported browsers */}
          {player && player.loginMethod !== "guest" && isSupported && permission !== "denied" && (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={async () => {
                if (isSubscribed) {
                  await unsubscribe();
                  setNotifToast("🔕 Notificaciones desactivadas");
                } else {
                  await subscribe();
                  setNotifToast("🔔 ¡Notificaciones activadas!");
                }
                setTimeout(() => setNotifToast(null), 3000);
              }}
              disabled={notifLoading}
              title={isSubscribed ? "Desactivar notificaciones" : "Activar notificaciones"}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10 relative"
              style={{ color: isSubscribed ? "#f9a825" : "rgba(255,255,255,0.5)" }}
            >
              {isSubscribed ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
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
      <main className="flex-1 w-full max-w-5xl mx-auto px-4 pb-4 z-10 flex flex-col">
        {children}
      </main>

      {/* Footer */}
      <footer className="w-full border-t border-white/10 mt-4 py-4 px-4 z-10">
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
