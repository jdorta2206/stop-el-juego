import { useEffect, useRef, useState } from "react";
import { Gift, Star, Zap } from "lucide-react";
import { getT } from "@/i18n/index";
import { isLikelyPlayTwa } from "@/lib/playBilling";
import { acknowledgeRewardResult, initTwaAdBridge, isTwaAdBridgeAvailable, requestRewardedAd, retryRewardedResult, setRewardedAdPlayerId } from "@/lib/twaAdBridge";
import { pauseGameTimer, resumeGameTimer } from "@/lib/timerPauseGuard";
import { trackAnalyticsEvent } from "@/lib/analyticsClient";
import { ADMOB_ADS_ENABLED } from "@/lib/admobPolicy";

const GAME_TIMER_PAUSE_EVENT = "stop:rewarded-ad-pause";
const GAME_TIMER_RESUME_EVENT = "stop:rewarded-ad-resume";
const PENDING_REWARD_STORAGE_KEY = "stop_admob_pending_confirmation_v1";

type StoredPendingReward = {
  requestId: string;
  playerId: string;
  rewardType: "points" | "hint" | "extraTime";
  rewardAmount: number;
  createdAt: number;
  status?: "pending" | "applied";
};

function pendingRewardStorageKey(playerId: string): string {
  return `${PENDING_REWARD_STORAGE_KEY}:${encodeURIComponent(playerId)}`;
}

function readStoredPendingReward(playerId?: string): StoredPendingReward | null {
  // Never use a shared guest bucket: each guest profile has its own UUID.
  if (!playerId?.trim()) return null;
  const ownerId = playerId;
  const storageKey = pendingRewardStorageKey(ownerId);
  try {
    let raw = window.localStorage.getItem(storageKey);
    if (!raw) {
      // Migrate the previous single-key record only for the account that owns it.
      // A different account must never read, acknowledge, or delete that record.
      const legacyRaw = window.localStorage.getItem(PENDING_REWARD_STORAGE_KEY);
      if (!legacyRaw) return null;
      const legacy = JSON.parse(legacyRaw) as StoredPendingReward;
      if (legacy.playerId !== ownerId) return null;
      raw = legacyRaw;
      window.localStorage.setItem(storageKey, raw);
      window.localStorage.removeItem(PENDING_REWARD_STORAGE_KEY);
    }
    const value = JSON.parse(raw) as StoredPendingReward;
    if (value.playerId !== ownerId || !value.requestId || !value.rewardType
      || !Number.isFinite(value.rewardAmount) || !Number.isFinite(value.createdAt)
      || Date.now() - value.createdAt > 24 * 60 * 60 * 1000) {
      window.localStorage.removeItem(storageKey);
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function saveStoredPendingReward(value: StoredPendingReward): boolean {
  if (!value.playerId?.trim()) return false;
  try {
    const ownerId = value.playerId;
    window.localStorage.setItem(pendingRewardStorageKey(ownerId), JSON.stringify(value));
    const legacyRaw = window.localStorage.getItem(PENDING_REWARD_STORAGE_KEY);
    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw) as StoredPendingReward;
        if (legacy.playerId === ownerId) window.localStorage.removeItem(PENDING_REWARD_STORAGE_KEY);
      } catch {}
    }
    return true;
  } catch {
    return false;
  }
}

function markStoredRewardApplied(requestId: string, playerId?: string): boolean {
  if (!playerId?.trim()) return false;
  try {
    const stored = readStoredPendingReward(playerId);
    if (!stored || stored.requestId !== requestId) return false;
    return saveStoredPendingReward({ ...stored, status: "applied" });
  } catch {
    return false;
  }
}

function clearStoredPendingReward(playerId?: string): void {
  if (!playerId?.trim()) return;
  const ownerId = playerId;
  try {
    window.localStorage.removeItem(pendingRewardStorageKey(ownerId));
    const legacyRaw = window.localStorage.getItem(PENDING_REWARD_STORAGE_KEY);
    if (legacyRaw) {
      try {
        const legacy = JSON.parse(legacyRaw) as StoredPendingReward;
        if (legacy.playerId === ownerId) window.localStorage.removeItem(PENDING_REWARD_STORAGE_KEY);
      } catch {}
    }
  } catch {}
}

// STOP uses the existing native Google AdMob integration inside the Android TWA.
// Do not load Adsterra or AdSense scripts from the website; native rewarded and
// interstitial placements are handled by the Android AdMob SDK.
export function BannerAd(_props: { className?: string; isPremium?: boolean }) {
  return null;
}

export function RewardedAd({ onComplete, onSkip, playerId, isPremium = false, rewardType = "points", rewardAmount = 20 }: { onComplete: (reward: number, requestId: string) => void | Promise<void>; onSkip: () => void; playerId?: string; isPremium?: boolean; rewardType?: "points" | "hint" | "extraTime"; rewardAmount?: number }) {
  const [phase, setPhase] = useState<"pre" | "loading" | "error" | "pending" | "done">("pre");
  const [errorDetail, setErrorDetail] = useState<string>("");
  const [retryRequestId, setRetryRequestId] = useState<string | null>(null);
  const [consumeAckPending, setConsumeAckPending] = useState(false);
  const t = getT();
  const timeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const onCompleteRef = useRef(onComplete);
  const onSkipRef = useRef(onSkip);
  onCompleteRef.current = onComplete;
  onSkipRef.current = onSkip;
  // A rapid double tap / overlapping SSV retry must never apply the same
  // confirmed request twice during this mounted game session.
  const completedRewardRequestsRef = useRef(new Set<string>());
  const applyConfirmedRewardOnce = async (requestId: string, amount: number) => {
    if (completedRewardRequestsRef.current.has(requestId)) return false;
    completedRewardRequestsRef.current.add(requestId);
    let rewardAppliedLocally = false;
    try {
      await onCompleteRef.current(amount, requestId);
      rewardAppliedLocally = true;
      // Never report success or consume the server result unless the durable
      // applied marker was actually written. Keep the in-memory guard if the
      // local effect succeeded but persistence failed, so retries in this
      // mounted session cannot apply the same reward twice.
      const persisted = markStoredRewardApplied(requestId, playerId);
      if (!persisted) {
        throw new Error("STOP aplicó la recompensa, pero no pudo guardar su confirmación local. No se volverá a aplicar automáticamente en esta sesión.");
      }
      const acknowledged = await acknowledgeRewardResult(requestId);
      if (acknowledged) clearStoredPendingReward(playerId);
      setRetryRequestId(null);
      return true;
    } catch (error) {
      if (!rewardAppliedLocally) completedRewardRequestsRef.current.delete(requestId);
      throw error;
    }
  };
  useEffect(() => () => {
    mountedRef.current = false;
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    // Defensive cleanup: if the rewarded overlay is unmounted while the
    // native activity is opening/closing, never leave the game globally paused.
    resumeGameTimer();
    window.dispatchEvent(new Event(GAME_TIMER_RESUME_EVENT));
  }, []);
  const labels = { points: `+${rewardAmount} pts`, hint: t.ads.reward, extraTime: "+30s" };
  const icons = { points: <Star className="w-8 h-8 text-[#f9a825]" />, hint: <Zap className="w-8 h-8 text-[#f9a825]" />, extraTime: <Gift className="w-8 h-8 text-[#f9a825]" /> };

  useEffect(() => { initTwaAdBridge(); }, []);

  useEffect(() => {
    const stored = readStoredPendingReward(playerId);
    if (!playerId || !stored || stored.playerId !== playerId) return;
    if (stored.status === "applied") {
      // The reward was already delivered in the previous session. Block new
      // ads until its server acknowledgement is completed; never reapply it.
      setConsumeAckPending(true);
      setErrorDetail("La recompensa anterior ya se aplicó. Falta cerrar su confirmación con el servidor.");
      setPhase("pending");
      void acknowledgeRewardResult(stored.requestId).then((acknowledged) => {
        if (acknowledged) {
          clearStoredPendingReward(playerId);
          if (mountedRef.current) {
            setConsumeAckPending(false);
            setErrorDetail("");
            setPhase("pre");
          }
        }
      });
      return;
    }
    if (!playerId || stored.playerId !== playerId
      || stored.rewardType !== rewardType
      || stored.rewardAmount !== rewardAmount) return;
    setRetryRequestId(stored.requestId);
    setErrorDetail("Hay una recompensa pendiente de una sesión anterior. Comprueba si Google ya la ha confirmado.");
    setPhase("pending");
  }, [playerId, rewardType, rewardAmount]);

  const startWatching = async () => {
    // Never request or recover a reward without the unique profile identity.
    if (!playerId?.trim()) {
      setErrorDetail("No se ha podido identificar al jugador. Vuelve a intentarlo.");
      setPhase("error");
      return;
    }
    // Premium and unmounted overlays must never request or grant an ad reward.
    if (!ADMOB_ADS_ENABLED || isPremium || !mountedRef.current) {
      if (mountedRef.current) onSkipRef.current();
      return;
    }
    setRewardedAdPlayerId(playerId);
    const placement = rewardType === "extraTime" ? "extra_time" : rewardType === "hint" ? "hint" : "double_points";
    void trackAnalyticsEvent("rewarded_ad_requested", { metadata: { placement } });
    pauseGameTimer();
    window.dispatchEvent(new Event(GAME_TIMER_PAUSE_EVENT));
    setPhase("loading");
    setErrorDetail("");

    try {
      const bridgeReady = isTwaAdBridgeAvailable();
      const knownTwa = isLikelyPlayTwa();

      if (bridgeReady || knownTwa) {
        const result = await requestRewardedAd(placement, (requestId) => {
          void trackAnalyticsEvent("rewarded_ad_request_created", { metadata: { placement, requestId, phase: "native_request_created" } });
          const saved = saveStoredPendingReward({
            requestId,
            playerId,
            rewardType,
            rewardAmount,
            createdAt: Date.now(),
          });
          if (!saved) {
            // Let the error propagate to requestRewardedAd's caller. Its
            // callback runs before the native deep link is opened.
            throw new Error("No se pudo guardar la solicitud del anuncio en este dispositivo. Por seguridad, no se abrirá el anuncio.");
          }
        });
        // The server only reports source=admob after validating Google's signed SSV callback.
        if (result.rewarded === true && result.source === "admob") {
          if (!mountedRef.current) return;
          void trackAnalyticsEvent("rewarded_ad_ssv_confirmed", { metadata: { placement, requestId: result.requestId ?? null } });
          timeoutRef.current = window.setTimeout(async () => {
            timeoutRef.current = null;
            if (mountedRef.current) {
              try {
                const applied = await applyConfirmedRewardOnce(result.requestId!, rewardAmount);
                if (applied) {
                  void trackAnalyticsEvent("rewarded_ad_completed", { metadata: { placement, source: "admob", requestId: result.requestId ?? null } });
                  void trackAnalyticsEvent("powerup_used", { metadata: { powerup: placement, source: "admob", requestId: result.requestId ?? null } });
                  setPhase("done");
                } else {
                  setErrorDetail("Esta recompensa ya se había aplicado en esta sesión. No se volverá a aplicar.");
                  setPhase("pending");
                }
              } catch {
                setRetryRequestId(result.requestId!);
                setErrorDetail("Google confirmó el anuncio, pero STOP no pudo aplicar la recompensa. Puedes reintentarla.");
                setPhase("pending");
              }
            }
          }, 500);
        } else if (result.pendingSsv && result.requestId) {
          void trackAnalyticsEvent("rewarded_ad_pending", { metadata: { placement, requestId: result.requestId, phase: "awaiting_ssv" } });
          setRetryRequestId(result.requestId);
          try {
            saveStoredPendingReward({
              requestId: result.requestId,
              playerId,
              rewardType,
              rewardAmount,
              createdAt: Date.now(),
            });
          } catch {}
          setErrorDetail(result.errorMessage || "El anuncio se ha visto, pero falta la confirmación de Google.");
          if (!mountedRef.current) return;
          setPhase("pending");
        } else {
          clearStoredPendingReward(playerId);
          const detail = [
            result.errorCode != null ? `código ${result.errorCode}` : "",
            result.errorDomain || "",
            result.errorMessage || "",
          ].filter(Boolean).join(" · ");
          setErrorDetail(detail);
          void trackAnalyticsEvent("rewarded_ad_failed", { metadata: {
            placement,
            errorCode: result.errorCode ?? null,
            errorDomain: result.errorDomain ?? null,
            errorMessage: (result.errorMessage || detail).slice(0, 300),
            requestId: result.requestId ?? null,
            error: detail.slice(0, 300),
            phase: "native_result",
          } });
          if (!mountedRef.current) return;
          setPhase("error");
          timeoutRef.current = window.setTimeout(() => {
            timeoutRef.current = null;
            if (mountedRef.current) onSkipRef.current();
          }, detail ? 5000 : 900);
        }
        return;
      }

      void trackAnalyticsEvent("rewarded_ad_failed", { metadata: { placement, errorCode: "BRIDGE_UNAVAILABLE", errorDomain: "STOP_TWA_BRIDGE", errorMessage: "Native rewarded-ad bridge unavailable", phase: "bridge_check" } });
      setErrorDetail("El puente nativo de anuncios no está disponible.");
      if (!mountedRef.current) return;
      setPhase("error");
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        if (mountedRef.current) onSkipRef.current();
      }, 5000);
    } catch (error) {
      const stored = readStoredPendingReward(playerId);
      if (stored
        && stored.playerId === playerId
        && stored.rewardType === rewardType
        && stored.rewardAmount === rewardAmount) {
        // The native request may already have started before the bridge/poll
        // failed. Keep its requestId so the signed SSV result can be retried.
        setRetryRequestId(stored.requestId);
        setErrorDetail("La solicitud del anuncio quedó pendiente. Comprueba la confirmación de Google antes de volver a intentarlo.");
        if (mountedRef.current) setPhase("pending");
        return;
      }
      const message = error instanceof Error ? error.message : "Error desconocido";
      void trackAnalyticsEvent("rewarded_ad_failed", { metadata: { placement, errorCode: "CLIENT_EXCEPTION", errorDomain: "STOP_CLIENT", errorMessage: message.slice(0, 300), phase: "request_exception" } });
      setErrorDetail(message.slice(0, 300));
      if (!mountedRef.current) return;
      setPhase("error");
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        if (mountedRef.current) onSkipRef.current();
      }, 5000);
    }
  };

  const retryConsumeAcknowledgement = async () => {
    const stored = readStoredPendingReward(playerId);
    if (!stored || stored.playerId !== playerId || stored.status !== "applied" || !mountedRef.current) return;
    setPhase("loading");
    const acknowledged = await acknowledgeRewardResult(stored.requestId);
    if (!mountedRef.current) return;
    if (acknowledged) {
      clearStoredPendingReward(playerId);
      setConsumeAckPending(false);
      setErrorDetail("");
      setPhase("pre");
    } else {
      setErrorDetail("La recompensa ya está aplicada. No vuelvas a ver otro anuncio todavía; reintenta cerrar la confirmación.");
      setPhase("pending");
    }
  };

  const retryConfirmation = async () => {
    if (!retryRequestId || !mountedRef.current) return;
    setPhase("loading");
    setErrorDetail("");
    const result = await retryRewardedResult(retryRequestId);
    if (!mountedRef.current) return;
    if (result.rewarded === true && result.source === "admob") {
      const placement = rewardType === "extraTime" ? "extra_time" : rewardType === "hint" ? "hint" : "double_points";
      void trackAnalyticsEvent("rewarded_ad_ssv_confirmed", { metadata: { placement, retry: true, requestId: retryRequestId } });
      timeoutRef.current = window.setTimeout(async () => {
        timeoutRef.current = null;
        if (mountedRef.current) {
          try {
            const applied = await applyConfirmedRewardOnce(retryRequestId, rewardAmount);
            if (applied) {
              const placement = rewardType === "extraTime" ? "extra_time" : rewardType === "hint" ? "hint" : "double_points";
              void trackAnalyticsEvent("rewarded_ad_completed", { metadata: { placement, source: "admob", retry: true, requestId: retryRequestId } });
              void trackAnalyticsEvent("powerup_used", { metadata: { powerup: placement, source: "admob", retry: true, requestId: retryRequestId } });
              setPhase("done");
            } else {
              setErrorDetail("Esta recompensa ya se había aplicado en esta sesión. No se volverá a aplicar.");
              setPhase("pending");
            }
          } catch {
            setErrorDetail("Google confirmó el anuncio, pero STOP no pudo aplicar la recompensa. Puedes reintentarla.");
            setPhase("pending");
          }
        }
      }, 500);
    } else if (result.pendingSsv) {
      setErrorDetail(result.errorMessage || "La confirmación de Google sigue pendiente.");
      setPhase("pending");
    } else {
      // A definitive non-reward result (for example, the user skipped the ad)
      // must not be restored as a pending confirmation on the next mount.
      if (!result.pendingSsv) {
        clearStoredPendingReward(playerId);
        setRetryRequestId(null);
      }
      setErrorDetail(result.errorMessage || "No se pudo confirmar la recompensa.");
      setPhase("error");
    }
  };

  if (isPremium) return null;
  const continueWithoutReward = () => {
    clearStoredPendingReward(playerId);
    setRetryRequestId(null);
    onSkipRef.current();
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-sm rounded-3xl overflow-hidden bg-white shadow-2xl"><div className="p-6 text-center"><h3 className="text-xl font-black">{phase === "done" ? "¡Recompensa!" : phase === "error" ? "Anuncio no disponible" : phase === "pending" ? "Confirmación pendiente" : "Mira el anuncio"}</h3>{phase === "pre" && <><div className="my-5 flex justify-center">{icons[rewardType]}</div><p className="text-gray-600 text-sm mb-5">{labels[rewardType]}</p><button onClick={startWatching} className="w-full py-3 rounded-xl font-bold bg-[#f9a825] text-[#0d1757]">Ver anuncio</button><button onClick={continueWithoutReward} className="w-full py-2 mt-2 text-gray-500">Ahora no</button></>}{phase === "loading" && <div className="py-10"><div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#f9a825]"/><p className="text-sm text-gray-600">Cargando anuncio…</p></div>}{phase === "error" && <><div className="py-8 text-4xl">📺</div><p className="text-sm text-gray-600">No se ha podido mostrar o confirmar el anuncio recompensado.</p>{errorDetail && <p className="mt-2 rounded-lg bg-gray-100 px-3 py-2 text-left text-[11px] leading-4 text-gray-600 break-words">{errorDetail}</p>}<button onClick={continueWithoutReward} className="w-full py-2 mt-4 text-gray-500">Continuar</button></>}
      {phase === "pending" && <><div className="py-8 text-4xl">⏳</div><p className="text-sm text-gray-700">{consumeAckPending ? "La recompensa anterior ya se aplicó. Solo falta confirmar al servidor que se ha cerrado; no se volverá a aplicar." : "El anuncio se ha visto, pero Google todavía no ha confirmado la recompensa. No se concederá hasta recibir la verificación segura."}</p>{errorDetail && <p className="mt-2 rounded-lg bg-gray-100 px-3 py-2 text-left text-[11px] leading-4 text-gray-600 break-words">{errorDetail}</p>}<button onClick={consumeAckPending ? retryConsumeAcknowledgement : retryConfirmation} className="w-full py-3 mt-4 rounded-xl font-bold bg-[#f9a825] text-[#0d1757]">{consumeAckPending ? "Reintentar cierre" : "Reintentar comprobación"}</button><button onClick={continueWithoutReward} className="w-full py-2 mt-2 text-gray-500">Continuar sin recompensa</button></>}{phase === "done" && <div className="py-8"><div className="text-5xl mb-3">🎉</div><p className="text-gray-700">{labels[rewardType]}</p></div>}</div></div></div>;
}