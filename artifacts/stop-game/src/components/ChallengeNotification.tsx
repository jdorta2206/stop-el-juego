import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, X, Check, DoorOpen } from "lucide-react";
import { respondToChallenge, type IncomingChallenge } from "@/lib/usePresence";
import { useLocation } from "wouter";

interface ChallengeNotificationProps {
  challenge: IncomingChallenge;
  onDismiss: () => void;
}

export function ChallengeNotification({ challenge, onDismiss }: ChallengeNotificationProps) {
  const [, setLocation] = useLocation();
  const [countdown, setCountdown] = useState(30);
  const [responding, setResponding] = useState(false);

  const isRoomInvite = !!challenge.isRoomInvite;

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((v) => {
        if (v <= 1) {
          clearInterval(timer);
          onDismiss();
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAccept = async () => {
    setResponding(true);
    if (!isRoomInvite) {
      await respondToChallenge(challenge.challengeId, true);
    }
    onDismiss();
    setLocation(`/room/${challenge.roomCode}`);
  };

  const handleDecline = async () => {
    setResponding(true);
    if (!isRoomInvite) {
      await respondToChallenge(challenge.challengeId, false);
    }
    onDismiss();
  };

  const accentColor = isRoomInvite ? "#34d399" : "#f9a825";
  const borderColor = isRoomInvite ? "rgba(52,211,153,0.4)" : "rgba(249,168,37,0.4)";
  const glowColor = isRoomInvite ? "rgba(52,211,153,0.15)" : "rgba(249,168,37,0.15)";

  return (
    <AnimatePresence>
      <div className="fixed inset-x-0 top-4 z-50 flex justify-center px-4 pointer-events-none">
      <motion.div
        initial={{ y: -80, opacity: 0, scale: 0.9 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: -80, opacity: 0, scale: 0.9 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="w-full max-w-sm pointer-events-auto"
      >
        <div
          className="rounded-2xl p-4 shadow-2xl"
          style={{
            background: "linear-gradient(135deg, hsl(222 47% 14%) 0%, hsl(222 47% 10%) 100%)",
            border: `1px solid ${borderColor}`,
            boxShadow: `0 0 30px ${glowColor}`,
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}50` }}
            >
              {isRoomInvite
                ? <DoorOpen className="w-5 h-5" style={{ color: accentColor }} />
                : <Swords className="w-5 h-5" style={{ color: accentColor }} />
              }
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-black text-sm">
                {isRoomInvite ? "¡Te invitan a una sala!" : "¡Te han retado!"}
              </p>
              <p className="text-white/60 text-xs truncate">
                <span style={{ color: accentColor }} className="font-bold">{challenge.fromName}</span>
                {isRoomInvite ? " te invita a su sala" : " quiere jugar contigo"}
              </p>
            </div>
            {/* Countdown ring */}
            <div className="flex-shrink-0 relative w-8 h-8">
              <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
                <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" />
                <circle
                  cx="16" cy="16" r="13"
                  fill="none"
                  stroke={accentColor}
                  strokeWidth="2.5"
                  strokeDasharray={`${2 * Math.PI * 13}`}
                  strokeDashoffset={`${2 * Math.PI * 13 * (1 - countdown / 30)}`}
                  strokeLinecap="round"
                  style={{ transition: "stroke-dashoffset 1s linear" }}
                />
              </svg>
              <span
                className="absolute inset-0 flex items-center justify-center text-[10px] font-black"
                style={{ color: accentColor }}
              >
                {countdown}
              </span>
            </div>
          </div>

          {/* Challenger avatar + room code */}
          <div className="flex items-center gap-2 mb-4 px-1">
            {challenge.fromPicture ? (
              <img
                src={challenge.fromPicture}
                alt={challenge.fromName}
                className="w-8 h-8 rounded-full object-cover border-2"
                style={{ borderColor: challenge.fromAvatarColor }}
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-black text-white text-sm flex-shrink-0"
                style={{ background: challenge.fromAvatarColor }}
              >
                {challenge.fromName[0]?.toUpperCase() || "?"}
              </div>
            )}
            <p className="text-white/50 text-xs">
              Sala: <span className="text-white font-bold font-mono">{challenge.roomCode}</span>
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleDecline}
              disabled={responding}
              className="flex-shrink-0 flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-sm font-bold transition-all"
              style={{
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "rgba(255,255,255,0.5)",
              }}
            >
              <X size={14} /> {isRoomInvite ? "Ignorar" : "Rechazar"}
            </button>
            <button
              onClick={handleAccept}
              disabled={responding}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-bold transition-all"
              style={{
                background: isRoomInvite
                  ? "linear-gradient(135deg, #34d399, #059669)"
                  : "linear-gradient(135deg, #f9a825, #f57f17)",
                color: "#000",
                boxShadow: `0 4px 15px ${accentColor}55`,
              }}
            >
              {isRoomInvite
                ? <><DoorOpen size={14} /> ¡Unirme!</>
                : <><Check size={14} /> ¡Aceptar!</>
              }
            </button>
          </div>
        </div>
      </motion.div>
      </div>
    </AnimatePresence>
  );
}
