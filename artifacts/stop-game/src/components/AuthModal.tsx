import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Input } from "./ui";
import { AVATAR_COLORS } from "@/lib/utils";
import type { PlayerProfile } from "@/hooks/use-player";
import { X, Mail, User, Palette } from "lucide-react";

interface AuthModalProps {
  onSave: (profile: PlayerProfile) => void;
  initial?: PlayerProfile | null;
}

const GOOGLE_COLORS = ["#4285F4", "#EA4335", "#FBBC05", "#34A853"];

export function AuthModal({ onSave, initial }: AuthModalProps) {
  const [step, setStep] = useState<"login" | "profile">(initial ? "profile" : "login");
  const [name, setName] = useState(initial?.name || "");
  const [avatarColor, setAvatarColor] = useState(initial?.avatarColor || AVATAR_COLORS[0]);
  const [loginMethod, setLoginMethod] = useState<string | null>(null);

  const handleSocialLogin = (method: string) => {
    setLoginMethod(method);
    // Pre-fill name based on method for demo
    if (!name) setName("");
    setStep("profile");
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: initial?.id || crypto.randomUUID(),
      name: name.trim().slice(0, 14),
      avatarColor,
      loginMethod,
    } as any);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.85, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.85, opacity: 0, y: 30 }}
        transition={{ type: "spring", bounce: 0.4 }}
        className="relative z-10 w-full max-w-sm"
      >
        <div
          className="rounded-3xl overflow-hidden shadow-2xl"
          style={{
            background: "linear-gradient(145deg, #1a237e 0%, #0d1757 100%)",
            border: "2px solid rgba(249,168,37,0.4)",
          }}
        >
          {/* Header */}
          <div className="relative text-center pt-8 pb-4 px-6">
            <div
              className="mx-auto mb-3 w-20 h-20 rounded-2xl flex items-center justify-center text-4xl font-black shadow-xl"
              style={{
                background: "#e63012",
                color: "white",
                fontFamily: "'Baloo 2', sans-serif",
                transform: "rotate(-3deg)",
              }}
            >
              STOP
            </div>
            <h2 className="text-2xl font-black text-white">
              {step === "login" ? "¡Únete a STOP!" : "Tu perfil"}
            </h2>
            <p className="text-white/60 text-sm mt-1">
              {step === "login"
                ? "Crea tu cuenta y compite con el mundo"
                : "Elige tu nombre y avatar"}
            </p>
          </div>

          <div className="px-6 pb-8 space-y-4">
            <AnimatePresence mode="wait">
              {step === "login" ? (
                <motion.div
                  key="login"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-3"
                >
                  {/* Google */}
                  <SocialButton
                    onClick={() => handleSocialLogin("google")}
                    icon={
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    }
                    label="Continuar con Google"
                    bg="white"
                    textColor="#333"
                  />

                  {/* Facebook */}
                  <SocialButton
                    onClick={() => handleSocialLogin("facebook")}
                    icon={
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#1877F2">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    }
                    label="Continuar con Facebook"
                    bg="#1877F2"
                    textColor="white"
                  />

                  {/* Instagram */}
                  <SocialButton
                    onClick={() => handleSocialLogin("instagram")}
                    icon={
                      <svg viewBox="0 0 24 24" className="w-5 h-5">
                        <defs>
                          <linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#f09433" />
                            <stop offset="25%" stopColor="#e6683c" />
                            <stop offset="50%" stopColor="#dc2743" />
                            <stop offset="75%" stopColor="#cc2366" />
                            <stop offset="100%" stopColor="#bc1888" />
                          </linearGradient>
                        </defs>
                        <rect width="24" height="24" rx="5" fill="url(#ig)" />
                        <path d="M12 7.5A4.5 4.5 0 1 0 16.5 12 4.505 4.505 0 0 0 12 7.5zm0 7.5a3 3 0 1 1 3-3 3 3 0 0 1-3 3zm5.885-8.153a1.05 1.05 0 1 1-1.05-1.05 1.05 1.05 0 0 1 1.05 1.05z" fill="white"/>
                        <rect x="2" y="2" width="20" height="20" rx="5" fill="none" stroke="white" strokeOpacity="0.2" strokeWidth="0.5"/>
                      </svg>
                    }
                    label="Continuar con Instagram"
                    bg="linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)"
                    textColor="white"
                  />

                  {/* Separator */}
                  <div className="flex items-center gap-3 my-2">
                    <div className="flex-1 h-px bg-white/15" />
                    <span className="text-white/40 text-xs font-bold uppercase tracking-wider">o</span>
                    <div className="flex-1 h-px bg-white/15" />
                  </div>

                  {/* Guest / email */}
                  <button
                    onClick={() => handleSocialLogin("guest")}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-white/20 text-white/80 font-bold hover:bg-white/10 transition-all text-sm"
                  >
                    <Mail className="w-4 h-4" />
                    Entrar como invitado
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="profile"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  {/* Login method badge */}
                  {loginMethod && loginMethod !== "guest" && (
                    <div className="flex items-center justify-center gap-2 text-sm font-bold text-[#f9a825]">
                      <span className="uppercase tracking-wider">{loginMethod}</span>
                      <span className="text-white/40">conectado ✓</span>
                    </div>
                  )}

                  {/* Name */}
                  <div>
                    <label className="block text-white/70 text-xs font-bold uppercase tracking-wider mb-1.5">
                      Tu nombre de jugador
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        maxLength={14}
                        placeholder="Ej: CrakVillarreal10"
                        autoFocus
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder:text-white/40 font-bold text-base focus:outline-none focus:border-[#f9a825] transition-colors"
                      />
                    </div>
                    <p className="text-white/30 text-xs mt-1 text-right">{name.length}/14</p>
                  </div>

                  {/* Avatar color */}
                  <div>
                    <label className="flex items-center gap-1.5 text-white/70 text-xs font-bold uppercase tracking-wider mb-2">
                      <Palette className="w-3.5 h-3.5" /> Color de avatar
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {AVATAR_COLORS.map(color => (
                        <button
                          key={color}
                          onClick={() => setAvatarColor(color)}
                          className="w-9 h-9 rounded-full border-4 transition-all hover:scale-110"
                          style={{
                            backgroundColor: color,
                            borderColor: avatarColor === color ? "white" : "transparent",
                            transform: avatarColor === color ? "scale(1.15)" : undefined,
                            boxShadow: avatarColor === color ? "0 0 0 2px rgba(255,255,255,0.5)" : "none",
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="flex items-center gap-3 bg-white/5 rounded-xl p-3">
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-lg shadow"
                      style={{ backgroundColor: avatarColor }}
                    >
                      {name.charAt(0).toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="font-bold text-white">{name || "Tu nombre"}</p>
                      <p className="text-white/40 text-xs">Jugador STOP</p>
                    </div>
                  </div>

                  <button
                    onClick={handleSave}
                    disabled={!name.trim()}
                    className="w-full py-4 rounded-xl font-black text-xl tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-95"
                    style={{
                      background: name.trim() ? "#e63012" : "#555",
                      color: "white",
                      fontFamily: "'Baloo 2', sans-serif",
                      boxShadow: name.trim() ? "0 4px 20px rgba(230,48,18,0.4)" : "none",
                    }}
                  >
                    ¡JUGAR!
                  </button>

                  {!initial && (
                    <button
                      onClick={() => setStep("login")}
                      className="w-full text-white/40 text-sm text-center hover:text-white/60 transition-colors"
                    >
                      ← Volver
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SocialButton({
  onClick,
  icon,
  label,
  bg,
  textColor,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  bg: string;
  textColor: string;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -1 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3.5 px-5 rounded-xl font-bold text-sm transition-all shadow-md"
      style={{ background: bg, color: textColor, boxShadow: "0 2px 12px rgba(0,0,0,0.2)" }}
    >
      <span className="w-5 h-5 flex-shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      <span className="opacity-50">→</span>
    </motion.button>
  );
}
