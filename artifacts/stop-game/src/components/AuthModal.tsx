import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AVATAR_COLORS } from "@/lib/utils";
import type { PlayerProfile } from "@/hooks/use-player";
import { Mail, User, Palette, AlertCircle } from "lucide-react";
import {
  signInWithGoogle,
  signInWithFacebook,
  signInWithTikTok,
  signInWithApple,
  checkOAuthReturn,
  consumeFacebookAccessToken,
  isGoogleConfigured,
  isFacebookConfigured,
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
  onDismiss?: () => void;
}

export function AuthModal({ onSave, initial, onDismiss }: AuthModalProps) {
  const { t } = useT();
  const [step, setStep] = useState<"login" | "profile" | "welcome_back">(initial ? "profile" : "login");
  const [name, setName] = useState(initial?.name || "");
  const [avatarColor, setAvatarColor] = useState(initial?.avatarColor || AVATAR_COLORS[0]);
  const [loginMethod, setLoginMethod] = useState<string | null>(null);
  const [oauthPicture, setOauthPicture] = useState<string | null>(null);
  const [oauthId, setOauthId] = useState<string | null>(null);
  const [fbToken, setFbToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existingStats, setExistingStats] = useState<{ totalScore: number; gamesPlayed: number } | null>(null);

  useEffect(() => {
    try {
      const oauthUser = checkOAuthReturn();
      if (oauthUser) {
        // The handoff can persist the Facebook token in sessionStorage or
        // localStorage depending on where the OAuth callback landed. Always
        // consume it through the same helper so AuthModal and the early
        // handoff bootstrap cannot race or use different storage rules.
        const storedFbToken = consumeFacebookAccessToken();
        if (storedFbToken) setFbToken(storedFbToken);
        handleOAuthSuccess(oauthUser, storedFbToken);
      }
    } catch (e: any) {
      setError(e.message || "Error.");
    }
  }, []);

  const handleOAuthSuccess = (oauthUser: OAuthUser, fbAccessToken: string | null = null) => {
    setOauthId(oauthUser.id);
    setLoginMethod(oauthUser.provider);
    setName((oauthUser.name || "").slice(0, 14));
    setOauthPicture(oauthUser.picture || null);
    setError(null);
    setStep("profile");

    const apiBase = (import.meta as any).env?.VITE_API_URL ?? window.location.origin;
    fetch(`${apiBase}/api/ranking/scores/${encodeURIComponent(oauthUser.id)}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.score?.gamesPlayed > 0) {
          const stats = { totalScore: data.score.totalScore, gamesPlayed: data.score.gamesPlayed };
          setExistingStats(stats);
          setStep("welcome_back");
          const colorIdx = oauthUser.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % AVATAR_COLORS.length;
          const profile = {
            id: oauthUser.id,
            name: (oauthUser.name || "").slice(0, 14),
            avatarColor: AVATAR_COLORS[colorIdx],
            loginMethod: oauthUser.provider,
            picture: oauthUser.picture || null,
            fbAccessToken: fbAccessToken,
          } as any;
          setTimeout(() => onSave(profile), 2000);
        }
      })
      .catch(() => {
        // On network error, stay on profile step (user confirms manually)
      });
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const persistentId = oauthId || initial?.id || crypto.randomUUID();
    onSave({
      id: persistentId,
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
          style={{ background: "linear-gradient(145deg, #1a237e 0%, #0d1757 100%)", border: "2px solid rgba(249,168,37,0.4)" }}
        >
          <div className="text-center pt-8 pb-4 px-6 relative">
            {onDismiss && step === "login" && (
              <button onClick={onDismiss} aria-label="Cerrar" className="absolute top-3 left-3 w-8 h-8 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-colors text-lg leading-none">✕</button>
            )}
            <div className="absolute top-4 right-4"><LanguageSelector /></div>
            <motion.img src={LOGO_URL} alt="STOP" className="mx-auto mb-3 w-20 h-20 rounded-full shadow-xl" animate={{ rotate: [0, 3, -3, 0] }} transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }} style={{ boxShadow: "0 6px 24px rgba(0,0,0,0.4)" }} />
            <h2 className="text-2xl font-black text-white">{step === "login" ? t.auth.title : "👤"}</h2>
            <p className="text-white/60 text-sm mt-1">{step === "login" ? t.auth.subtitle : t.multiplayer.enterName}</p>
          </div>

          <AnimatePresence>
            {error && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mx-6 mb-2 flex items-center gap-2 bg-red-500/20 border border-red-500/40 rounded-xl px-3 py-2 text-red-300 text-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="px-6 pb-8 space-y-4">
            <AnimatePresence mode="wait">
              {step === "welcome_back" ? (
                <motion.div key="welcome_back" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex flex-col items-center gap-4 py-4 text-center">
                  {oauthPicture && <img src={oauthPicture} alt="avatar" className="w-20 h-20 rounded-full border-4 border-[#f9a825] shadow-xl object-cover" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />}
                  <div><p className="text-white font-black text-xl">¡Bienvenido de vuelta, {name}!</p><p className="text-white/50 text-sm mt-1">Restaurando tu cuenta…</p></div>
                  {existingStats && <div className="flex items-center gap-3 px-5 py-3 rounded-2xl w-full" style={{ background: "rgba(249,168,37,0.15)", border: "1px solid rgba(249,168,37,0.4)" }}><span className="text-2xl">🏆</span><div className="text-left"><p className="text-[#f9a825] font-black text-sm">{existingStats.totalScore.toLocaleString()} pts</p><p className="text-white/50 text-xs">{existingStats.gamesPlayed} partidas jugadas</p></div></div>}
                  <div className="flex gap-1.5 mt-2">{[0,1,2].map(i => <motion.div key={i} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: i * 0.25 }} className="w-2 h-2 rounded-full bg-[#f9a825]" />)}</div>
                </motion.div>
              ) : step === "login" ? (
                <motion.div key="login" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-3">
                  <SocialButton onClick={signInWithGoogle} configured={isGoogleConfigured} icon={<svg viewBox="0 0 24 24" className="w-5 h-5" fill="none"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 1 12 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>} label={t.auth.google} bg="white" textColor="#333" soonLabel={t.auth.soon} />
                  <SocialButton onClick={signInWithFacebook} configured={isFacebookConfigured} icon={<svg viewBox="0 0 24 24" className="w-5 h-5"><circle cx="12" cy="12" r="12" fill="white" /><path d="M13.397 20.997v-8.196h2.765l.411-3.209h-3.176V7.548c0-.926.258-1.56 1.587-1.56h1.684V3.127A22.336 22.336 0 0 0 14.201 3c-2.444 0-4.122 1.492-4.122 4.231v2.355H7.332v3.209h2.753v8.202h3.312z" fill="#1877F2" /></svg>} label={t.auth.facebook} bg="#1877F2" textColor="white" soonLabel={t.auth.soon} />
                  {isTikTokConfigured && (
                    <SocialButton onClick={signInWithTikTok} configured={isTikTokConfigured} icon={<span className="text-lg">♪</span>} label="TikTok" bg="#000" textColor="white" soonLabel={t.auth.soon} />
                  )}
                  {isAppleConfigured && (
                    <SocialButton onClick={signInWithApple} configured={isAppleConfigured} icon={<span className="text-lg"></span>} label="Apple" bg="#000" textColor="white" soonLabel={t.auth.soon} />
                  )}
                  <div className="relative my-2"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10" /></div><div className="relative flex justify-center"><span className="bg-[#10195f] px-3 text-white/30 text-xs">{t.auth.or}</span></div></div>
                  <div className="space-y-2"><label className="text-white/70 text-sm flex items-center gap-2"><User className="w-4 h-4" />{t.auth.name}</label><input value={name} onChange={e => setName(e.target.value)} placeholder={t.auth.namePlaceholder} maxLength={14} className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/10 text-white placeholder-white/30 outline-none focus:border-[#f9a825]" /><button onClick={handleSave} className="w-full py-3 rounded-xl bg-[#f9a825] text-[#111] font-black hover:brightness-110 transition">{t.auth.continue}</button></div>
                </motion.div>
              ) : (
                <motion.div key="profile" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <div className="flex items-center gap-3">{oauthPicture ? <img src={oauthPicture} alt="avatar" className="w-14 h-14 rounded-full object-cover" /> : <div className="w-14 h-14 rounded-full" style={{ background: avatarColor }} />}<div><p className="text-white font-bold">{name || "Tu nombre"}</p><p className="text-white/40 text-xs">{loginMethod || "Cuenta"}</p></div></div>
                  <label className="text-white/70 text-sm flex items-center gap-2"><Palette className="w-4 h-4" />{t.auth.color}</label>
                  <div className="grid grid-cols-6 gap-2">{AVATAR_COLORS.map(color => <button key={color} onClick={() => setAvatarColor(color)} className="w-8 h-8 rounded-full border-2" style={{ background: color, borderColor: avatarColor === color ? "white" : "transparent" }} />)}</div>
                  <button onClick={handleSave} className="w-full py-3 rounded-xl bg-[#f9a825] text-[#111] font-black hover:brightness-110 transition">{t.auth.continue}</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function SocialButton({ onClick, configured, icon, label, bg, textColor, soonLabel }: { onClick: () => void; configured: boolean; icon: React.ReactNode; label: string; bg: string; textColor: string; soonLabel: string }) {
  return <button onClick={configured ? onClick : undefined} disabled={!configured} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold transition disabled:opacity-50" style={{ background: bg, color: textColor }}><span className="w-6 flex justify-center">{icon}</span><span className="flex-1">{label}</span>{!configured && <span className="text-xs opacity-60">{soonLabel}</span>}</button>;
}
