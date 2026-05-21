import { useEffect, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Bell, BellOff, Clock, MoonStar, ArrowLeft } from "lucide-react";
import { usePlayer } from "@/hooks/use-player";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useT } from "@/i18n/useT";

const HOURS = Array.from({ length: 24 }, (_, i) => i);

type Prefs = {
  enabled: boolean;
  hourLocal: number;
  mutedUntil: number;
  tzOffsetMinutes: number;
} | null;

export default function NotificationsPage() {
  const { player } = usePlayer();
  const { lang } = useT();
  const {
    isSupported, isSubscribed, permission, loading,
    subscribe, unsubscribe, getPreferences, updatePreferences,
  } = usePushNotifications(player?.id, lang);

  const [prefs, setPrefs] = useState<Prefs>(null);
  const [savingHour, setSavingHour] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // Load prefs whenever the subscription becomes active.
  useEffect(() => {
    if (!isSubscribed) { setPrefs(null); return; }
    getPreferences().then(setPrefs);
  }, [isSubscribed, getPreferences]);

  const flashToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const T = {
    es: {
      title: "Notificaciones",
      back: "Volver",
      blockedTitle: "Notificaciones bloqueadas",
      blockedBody: "Has bloqueado las notificaciones en el navegador. Ábrelas desde los ajustes del navegador para volver a activarlas.",
      unsupportedTitle: "Tu navegador no las soporta",
      unsupportedBody: "Necesitas instalar la app o usar un navegador compatible.",
      enableTitle: "Activar notificaciones",
      enableBody: "Recibirás un recordatorio diario del reto, avisos de racha y de misiones para reclamar.",
      enableBtn: "Activar",
      disableBtn: "Desactivar",
      activeTitle: "Notificaciones activadas",
      hourTitle: "Hora del recordatorio",
      hourBody: "Cuándo quieres recibir el aviso diario.",
      muteTitle: "Silenciar 7 días",
      muteBody: "Pausa las notificaciones una semana sin desactivar.",
      muteBtn: "Silenciar",
      unmuteBtn: "Reanudar",
      mutedUntil: (d: string) => `En pausa hasta ${d}.`,
      saved: "Hora guardada",
      muted: "Silenciado 7 días",
      unmuted: "Reanudado",
      activated: "Notificaciones activadas",
      deactivated: "Notificaciones desactivadas",
    },
    en: {
      title: "Notifications",
      back: "Back",
      blockedTitle: "Notifications blocked",
      blockedBody: "You blocked notifications in the browser. Re-enable them from your browser settings.",
      unsupportedTitle: "Your browser doesn't support them",
      unsupportedBody: "Install the app or use a compatible browser.",
      enableTitle: "Enable notifications",
      enableBody: "Get a daily challenge reminder, streak alerts, and missions ready to claim.",
      enableBtn: "Enable",
      disableBtn: "Disable",
      activeTitle: "Notifications on",
      hourTitle: "Reminder time",
      hourBody: "When you want the daily reminder.",
      muteTitle: "Mute for 7 days",
      muteBody: "Pause notifications for a week without turning them off.",
      muteBtn: "Mute",
      unmuteBtn: "Resume",
      mutedUntil: (d: string) => `Paused until ${d}.`,
      saved: "Time saved",
      muted: "Muted for 7 days",
      unmuted: "Resumed",
      activated: "Notifications enabled",
      deactivated: "Notifications disabled",
    },
    pt: {
      title: "Notificações",
      back: "Voltar",
      blockedTitle: "Notificações bloqueadas",
      blockedBody: "Bloqueaste as notificações no navegador. Reativa-as nos ajustes.",
      unsupportedTitle: "O teu navegador não suporta",
      unsupportedBody: "Instala a app ou usa um navegador compatível.",
      enableTitle: "Ativar notificações",
      enableBody: "Recebe um lembrete diário do desafio, alertas de sequência e missões a reclamar.",
      enableBtn: "Ativar",
      disableBtn: "Desativar",
      activeTitle: "Notificações ativadas",
      hourTitle: "Hora do lembrete",
      hourBody: "Quando queres receber o aviso diário.",
      muteTitle: "Silenciar 7 dias",
      muteBody: "Pausa as notificações uma semana sem desativar.",
      muteBtn: "Silenciar",
      unmuteBtn: "Retomar",
      mutedUntil: (d: string) => `Em pausa até ${d}.`,
      saved: "Hora guardada",
      muted: "Silenciado 7 dias",
      unmuted: "Retomado",
      activated: "Notificações ativadas",
      deactivated: "Notificações desativadas",
    },
    fr: {
      title: "Notifications",
      back: "Retour",
      blockedTitle: "Notifications bloquées",
      blockedBody: "Tu as bloqué les notifications dans le navigateur. Réactive-les dans les réglages.",
      unsupportedTitle: "Ton navigateur ne les supporte pas",
      unsupportedBody: "Installe l'app ou utilise un navigateur compatible.",
      enableTitle: "Activer les notifications",
      enableBody: "Reçois un rappel quotidien du défi, alertes de série, et missions à réclamer.",
      enableBtn: "Activer",
      disableBtn: "Désactiver",
      activeTitle: "Notifications activées",
      hourTitle: "Heure du rappel",
      hourBody: "Quand recevoir l'avis quotidien.",
      muteTitle: "Couper 7 jours",
      muteBody: "Pause les notifications une semaine sans désactiver.",
      muteBtn: "Couper",
      unmuteBtn: "Reprendre",
      mutedUntil: (d: string) => `En pause jusqu'au ${d}.`,
      saved: "Heure enregistrée",
      muted: "Coupé 7 jours",
      unmuted: "Repris",
      activated: "Notifications activées",
      deactivated: "Notifications désactivées",
    },
  } as const;
  const t = T[lang as keyof typeof T] ?? T.es;

  const isMuted = !!(prefs && prefs.mutedUntil > Date.now());
  const mutedUntilStr = prefs && prefs.mutedUntil > 0
    ? new Date(prefs.mutedUntil).toLocaleDateString(lang)
    : "";

  return (
    <div className="w-full max-w-md mx-auto pt-4 pb-12">
      <Link href="/" className="inline-flex items-center gap-2 text-white/60 text-sm mb-4 hover:text-white">
        <ArrowLeft size={16} /> {t.back}
      </Link>

      <h1 className="text-2xl font-black text-white mb-1 flex items-center gap-2">
        <Bell size={22} className="text-[#f9a825]" /> {t.title}
      </h1>

      {/* Browser blocked */}
      {permission === "denied" && (
        <Card>
          <p className="text-white font-bold mb-1">{t.blockedTitle}</p>
          <p className="text-white/55 text-sm">{t.blockedBody}</p>
        </Card>
      )}

      {/* Unsupported */}
      {permission === "unsupported" && (
        <Card>
          <p className="text-white font-bold mb-1">{t.unsupportedTitle}</p>
          <p className="text-white/55 text-sm">{t.unsupportedBody}</p>
        </Card>
      )}

      {/* Master toggle */}
      {isSupported && permission !== "denied" && (
        <Card>
          <div className="flex items-start gap-3 mb-3">
            {isSubscribed
              ? <Bell size={22} className="text-[#f9a825] mt-0.5" />
              : <BellOff size={22} className="text-white/40 mt-0.5" />}
            <div className="flex-1">
              <p className="text-white font-black">{isSubscribed ? t.activeTitle : t.enableTitle}</p>
              <p className="text-white/55 text-sm mt-1">{t.enableBody}</p>
            </div>
          </div>
          <button
            onClick={async () => {
              if (isSubscribed) {
                await unsubscribe();
                flashToast(t.deactivated);
              } else {
                const ok = await subscribe();
                if (ok) flashToast(t.activated);
              }
            }}
            disabled={loading}
            className="w-full py-3 rounded-2xl font-black text-sm transition-colors disabled:opacity-50"
            style={{
              background: isSubscribed ? "rgba(255,255,255,0.08)" : "#f9a825",
              color: isSubscribed ? "white" : "#0d1757",
            }}
          >
            {isSubscribed ? t.disableBtn : t.enableBtn}
          </button>
        </Card>
      )}

      {/* Hour picker */}
      {isSubscribed && prefs && (
        <Card>
          <div className="flex items-start gap-3 mb-3">
            <Clock size={22} className="text-[#f9a825] mt-0.5" />
            <div className="flex-1">
              <p className="text-white font-black">{t.hourTitle}</p>
              <p className="text-white/55 text-sm mt-1">{t.hourBody}</p>
            </div>
          </div>
          <select
            value={prefs.hourLocal}
            disabled={savingHour}
            onChange={async (e) => {
              const h = parseInt(e.target.value, 10);
              setSavingHour(true);
              const ok = await updatePreferences({ hourLocal: h });
              if (ok) {
                setPrefs({ ...prefs, hourLocal: h });
                flashToast(t.saved);
              }
              setSavingHour(false);
            }}
            className="w-full py-3 px-4 rounded-2xl text-white font-black text-sm bg-black/30 border border-white/15"
          >
            {HOURS.map(h => (
              <option key={h} value={h} className="bg-[#0d1757]">
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </Card>
      )}

      {/* Mute 7 days */}
      {isSubscribed && prefs && (
        <Card>
          <div className="flex items-start gap-3 mb-3">
            <MoonStar size={22} className="text-[#f9a825] mt-0.5" />
            <div className="flex-1">
              <p className="text-white font-black">{t.muteTitle}</p>
              <p className="text-white/55 text-sm mt-1">
                {isMuted ? t.mutedUntil(mutedUntilStr) : t.muteBody}
              </p>
            </div>
          </div>
          <button
            onClick={async () => {
              const days = isMuted ? 0 : 7;
              const ok = await updatePreferences({ muteDays: days });
              if (ok) {
                const next = await getPreferences();
                setPrefs(next);
                flashToast(isMuted ? t.unmuted : t.muted);
              }
            }}
            className="w-full py-3 rounded-2xl font-black text-sm bg-white/8 text-white hover:bg-white/15"
          >
            {isMuted ? t.unmuteBtn : t.muteBtn}
          </button>
        </Card>
      )}

      {toast && (
        <motion.div
          initial={{ y: 40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-[#f9a825] text-[#0d1757] font-black text-sm px-4 py-2 rounded-full shadow-2xl z-50"
        >
          {toast}
        </motion.div>
      )}
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-3xl p-5 mb-4"
      style={{
        background: "linear-gradient(145deg, #1a237e 0%, #0d1757 100%)",
        border: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      {children}
    </div>
  );
}
