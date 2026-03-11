import { ReactNode, useState } from "react";
import { Link } from "wouter";
import { usePlayer } from "@/hooks/use-player";
import { Crown, LogOut, Edit2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Input } from "./ui";
import { AuthModal } from "./AuthModal";
import { AVATAR_COLORS } from "@/lib/utils";

const LOGO_URL = `${import.meta.env.BASE_URL}images/stop-logo.png`;

export function Layout({ children }: { children: ReactNode }) {
  const { player, isLoaded, needsAuth, savePlayer, updateProfile, logout, showAuth } = usePlayer();
  const [showProfile, setShowProfile] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

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
      {/* Auth modal — shown when no player profile exists */}
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
          {/* PRO badge */}
          <motion.button
            whileHover={{ scale: 1.05, y: -1 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setShowPremium(true)}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black text-sm shadow-md"
            style={{ background: "linear-gradient(135deg, #f9a825, #f57f17)", color: "#1a237e" }}
          >
            <Crown className="w-3.5 h-3.5" /> PRO
          </motion.button>

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

      {/* ── Modals ── */}
      <AnimatePresence>
        {showProfile && (
          <Modal onClose={() => setShowProfile(false)} title="Mi Perfil">
            <div className="space-y-5">
              {/* Avatar preview */}
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-16 h-16 rounded-full border-4 border-white/30 flex items-center justify-center text-white font-black text-3xl shadow-lg"
                  style={{ backgroundColor: editColor }}
                >
                  {editName.charAt(0).toUpperCase() || "?"}
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-xs font-bold text-white/60 uppercase tracking-wider mb-1 block">
                  Nombre
                </label>
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  maxLength={14}
                  placeholder="Tu nombre de jugador"
                />
              </div>

              {/* Avatar color */}
              <div>
                <label className="text-xs font-bold text-white/60 uppercase tracking-wider mb-2 block">
                  Color de avatar
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
                Guardar cambios
              </Button>

              <button
                onClick={() => { setShowProfile(false); logout(); }}
                className="w-full flex items-center justify-center gap-2 text-white/40 text-sm hover:text-white/70 transition-colors py-1"
              >
                <LogOut className="w-4 h-4" /> Cerrar sesión
              </button>
            </div>
          </Modal>
        )}

        {showPremium && (
          <Modal onClose={() => setShowPremium(false)} title="">
            <div className="space-y-5 text-center">
              <div className="flex justify-center">
                <img src={LOGO_URL} alt="STOP" className="w-20 h-20 rounded-full shadow-xl" />
              </div>
              <div>
                <p className="text-[#f9a825] font-black text-xs uppercase tracking-widest mb-1">STOP Premium</p>
                <h3 className="text-2xl font-black text-white">¡Juega sin límites!</h3>
                <p className="text-white/50 text-sm mt-1">Por solo €2,99/mes</p>
              </div>
              <ul className="text-left text-sm space-y-3 bg-white/5 p-4 rounded-2xl border border-white/10">
                {[
                  "🚫 Sin anuncios ni interrupciones",
                  "🔒 Salas privadas ilimitadas",
                  "🎨 Avatares y colores exclusivos",
                  "📚 Categorías extra: Películas, Canciones, Deportes…",
                  "⚡ Modo relámpago (30 segundos)",
                  "📊 Estadísticas detalladas",
                ].map(item => (
                  <li key={item} className="flex items-start gap-2 text-white/80 font-medium">
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <button
                className="w-full py-4 rounded-2xl font-black text-lg text-[#1a237e] shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, #f9a825, #f57f17)" }}
                onClick={() => setShowPremium(false)}
              >
                Próximamente… 🚀
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
