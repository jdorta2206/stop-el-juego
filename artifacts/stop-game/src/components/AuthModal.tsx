import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AVATAR_COLORS } from "@/lib/utils";
import type { PlayerProfile } from "@/hooks/use-player";
import { Mail, User, Palette, AlertCircle } from "lucide-react";
import {
  signInWithGoogle,
  signInWithFacebook,
  signInWithInstagram,
  signInWithTikTok,
  signInWithApple,
  checkOAuthReturn,
  isGoogleConfigured,
  isFacebookConfigured,
  isInstagramConfigured,
  isTikTokConfigured,
  isAppleConfigured,
  type OAuthUser,
} from "@/lib/oauth";
import { useT } from "@/i18n/useT";
import { LanguageSelector } from "./LanguageSelector";

const LOGO_URL = `${import.meta.env.BASE_URL}images/stop-logo.png`;

interface AuthModalProps {
  onSave: (profile: PlayerProfile) => void;
  initial?: PlayerProfile | null;
}

export function AuthModal({ onSave, initial }: AuthModalProps) {
  const { t } = useT();
  const [step, setStep] = useState<"login" | "profile">(initial ? "profile" : "login");
  const [name, setName] = useState(initial?.name || "");
  const [avatarColor, setAvatarColor] = useState(initial?.avatarColor || AVATAR_COLORS[0]);
  const [loginMethod, setLoginMethod] = useState<string | null>(null);
  const [oauthPicture, setOauthPicture] = useState<string | null>(null);
  const [fbToken, setFbToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const oauthUser = checkOAuthReturn();
      if (oauthUser) {
        const storedFbToken = sessionStorage.getItem("fb_access_token");
        if (storedFbToken) {
          sessionStorage.removeItem("fb_access_token");
          setFbToken(storedFbToken);
        }
        handleOAuthSuccess(oauthUser);
      }
    } catch (e: any) {
      setError(e.message || "Error.");
    }
  }, []);

  const handleOAuthSuccess = (oauthUser: OAuthUser) => {
    setLoginMethod(oauthUser.provider);
    setName((oauthUser.name || "").slice(0, 14));
    setOauthPicture(oauthUser.picture || null);
    setError(null);
    setStep("profile");
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({
      id: initial?.id || crypto.randomUUID(),
      name: name.trim().slice(0, 14),
      avatarColor,
      loginMethod,
      picture: oauthPicture,
      fbAccessToken: fbToken || initial?.fbAccessToken || null,
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
          <div className="text-center pt-8 pb-4 px-6 relative">
            {/* Language selector top-right */}
            <div className="absolute top-4 right-4">
              <LanguageSelector />
            </div>

            <motion.img
              src={LOGO_URL}
              alt="STOP"
              className="mx-auto mb-3 w-20 h-20 rounded-full shadow-xl"
              animate={{ rotate: [0, 3, -3, 0] }}
              transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
              style={{ boxShadow: "0 6px 24px rgba(0,0,0,0.4)" }}
            />
            <h2 className="text-2xl font-black text-white">
              {step === "login" ? t.auth.title : "👤"}
            </h2>
            <p className="text-white/60 text-sm mt-1">
              {step === "login" ? t.auth.subtitle : t.multiplayer.enterName}
            </p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mx-6 mb-2 flex items-center gap-2 bg-red-500/20 border border-red-500/40 rounded-xl px-3 py-2 text-red-300 text-sm"
              >
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

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
                  <SocialButton
                    onClick={signInWithGoogle}
                    configured={isGoogleConfigured}
                    icon={
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    }
                    label={t.auth.google}
                    bg="white"
                    textColor="#333"
                    soonLabel={t.auth.soon}
                  />

                  <SocialButton
                    onClick={signInWithFacebook}
                    configured={isFacebookConfigured}
                    icon={
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#1877F2">
                        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                      </svg>
                    }
                    label={t.auth.facebook}
                    bg="#1877F2"
                    textColor="white"
                    soonLabel={t.auth.soon}
                  />

                  <SocialButton
                    onClick={signInWithInstagram}
                    configured={isInstagramConfigured}
                    icon={
                      <svg viewBox="0 0 24 24" className="w-5 h-5">
                        <defs>
                          <linearGradient id="ig-grad" x1="0%" y1="100%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#f09433" />
                            <stop offset="25%" stopColor="#e6683c" />
                            <stop offset="50%" stopColor="#dc2743" />
                            <stop offset="75%" stopColor="#cc2366" />
                            <stop offset="100%" stopColor="#bc1888" />
                          </linearGradient>
                        </defs>
                        <rect width="24" height="24" rx="5" fill="url(#ig-grad)" />
                        <path d="M12 7.5A4.5 4.5 0 1 0 16.5 12 4.505 4.505 0 0 0 12 7.5zm0 7.5a3 3 0 1 1 3-3 3 3 0 0 1-3 3zm5.885-8.153a1.05 1.05 0 1 1-1.05-1.05 1.05 1.05 0 0 1 1.05 1.05z" fill="white"/>
                      </svg>
                    }
                    label={t.auth.instagram}
                    bg="linear-gradient(45deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888)"
                    textColor="white"
                    soonLabel={t.auth.soon}
                  />

                  <SocialButton
                    onClick={signInWithTikTok}
                    configured={isTikTokConfigured}
                    icon={
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white">
                        <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.2 8.2 0 0 0 4.79 1.52V6.76a4.85 4.85 0 0 1-1.02-.07z"/>
                      </svg>
                    }
                    label={t.auth.tiktok}
                    bg="#010101"
                    textColor="white"
                    soonLabel={t.auth.soon}
                  />

                  <SocialButton
                    onClick={signInWithApple}
                    configured={isAppleConfigured}
                    icon={
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="white">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                      </svg>
                    }
                    label={t.auth.apple}
                    bg="#000000"
                    textColor="white"
                    soonLabel={t.auth.soon}
                  />

                  <div className="flex items-center gap-3 py-1">
                    <div className="flex-1 h-px bg-white/15" />
                    <span className="text-white/40 text-xs font-bold uppercase tracking-wider">o</span>
                    <div className="flex-1 h-px bg-white/15" />
                  </div>

                  <button
                    onClick={() => { setLoginMethod("guest"); setStep("profile"); }}
                    className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 border-white/20 text-white/80 font-bold hover:bg-white/10 transition-all text-sm"
                  >
                    <Mail className="w-4 h-4" />
                    {t.auth.guest}
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
                  {loginMethod && loginMethod !== "guest" && (
                    <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-full bg-white/10 w-fit mx-auto">
                      <span className="text-[#f9a825] font-black text-xs uppercase tracking-wider">{loginMethod}</span>
                      <span className="text-green-400 text-xs font-bold">✓</span>
                    </div>
                  )}

                  <div className="flex justify-center">
                    {oauthPicture ? (
                      <img
                        src={oauthPicture}
                        alt="avatar"
                        className="w-16 h-16 rounded-full border-4 border-[#f9a825] shadow-xl object-cover"
                        onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                      />
                    ) : (
                      <div
                        className="w-16 h-16 rounded-full border-4 border-white/30 flex items-center justify-center text-white font-black text-3xl shadow-lg"
                        style={{ backgroundColor: avatarColor }}
                      >
                        {name.charAt(0).toUpperCase() || "?"}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="text-xs font-bold text-white/60 uppercase tracking-wider mb-1.5 block">
                      {t.multiplayer.playerName}
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                      <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        maxLength={14}
                        placeholder={t.multiplayer.enterName}
                        autoFocus
                        onKeyDown={e => e.key === "Enter" && handleSave()}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border-2 border-white/20 text-white placeholder:text-white/40 font-bold text-base focus:outline-none focus:border-[#f9a825] transition-colors"
                      />
                    </div>
                    <p className="text-white/30 text-xs mt-1 text-right">{name.length}/14</p>
                  </div>

                  {!oauthPicture && (
                    <div>
                      <label className="flex items-center gap-1.5 text-white/60 text-xs font-bold uppercase tracking-wider mb-2">
                        <Palette className="w-3.5 h-3.5" /> Avatar
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
                              boxShadow: avatarColor === color ? "0 0 0 2px rgba(255,255,255,0.5)" : "none",
                              transform: avatarColor === color ? "scale(1.15)" : undefined,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  <motion.button
                    whileHover={{ scale: name.trim() ? 1.02 : 1 }}
                    whileTap={{ scale: name.trim() ? 0.97 : 1 }}
                    onClick={handleSave}
                    disabled={!name.trim()}
                    className="w-full py-4 rounded-xl font-black text-xl tracking-wider transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: name.trim() ? "#e63012" : "#555",
                      color: "white",
                      fontFamily: "'Baloo 2', sans-serif",
                      boxShadow: name.trim() ? "0 4px 20px rgba(230,48,18,0.4)" : "none",
                    }}
                  >
                    {t.home.play}
                  </motion.button>

                  {!initial && (
                    <button
                      onClick={() => { setStep("login"); setLoginMethod(null); setOauthPicture(null); }}
                      className="w-full text-white/40 text-sm text-center hover:text-white/60 transition-colors"
                    >
                      ← {t.auth.guest}
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
  configured = true,
  soonLabel = "Soon",
}: {
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  bg: string;
  textColor: string;
  configured?: boolean;
  soonLabel?: string;
}) {
  return (
    <motion.button
      whileHover={{ scale: configured ? 1.02 : 1, y: configured ? -1 : 0 }}
      whileTap={{ scale: configured ? 0.98 : 1 }}
      onClick={configured ? onClick : undefined}
      className="w-full flex items-center gap-3 py-3.5 px-5 rounded-xl font-bold text-sm transition-all shadow-md relative"
      style={{
        background: bg,
        color: textColor,
        boxShadow: "0 2px 12px rgba(0,0,0,0.2)",
        opacity: configured ? 1 : 0.45,
        cursor: configured ? "pointer" : "not-allowed",
      }}
    >
      <span className="w-5 h-5 flex-shrink-0">{icon}</span>
      <span className="flex-1 text-left">{label}</span>
      {configured
        ? <span className="opacity-50">→</span>
        : <span className="text-xs font-bold opacity-70 bg-black/20 px-2 py-0.5 rounded-full">{soonLabel}</span>
      }
    </motion.button>
  );
}
