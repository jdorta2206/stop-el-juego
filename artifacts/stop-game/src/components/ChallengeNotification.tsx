import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, X, Check, DoorOpen } from "lucide-react";
import { respondToChallenge, type IncomingChallenge } from "@/lib/usePresence";
import { useLocation } from "wouter";
import { authHeaders } from "@/lib/utils";

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

    // Read player data once — needed for /join in both flows
    let playerData: { id: string; name: string; avatarColor: string; loginMethod?: string | null } | null = null;
    try {
      const stored = localStorage.getItem("stop_player_v2");
      if (stored) playerData = JSON.parse(stored);
    } catch { /* ignore */ }

    let roomCode = challenge.roomCode;
    if (!isRoomInvite) {
      const response = await respondToChallenge(challenge.challengeId, true);
      if (!response.roomCode) {
        setResponding(false);
        onDismiss();
        return;
      }
      roomCode = response.roomCode;
    }

    if (!playerData?.id) {
      setResponding(false);
      onDismiss();
      return;
    }

    try {
      const apiBase = (import.meta as any).env?.VITE_API_URL ?? window.location.origin;
      const joinRes = await fetch(apiBase + "/api/rooms/" + roomCode.toUpperCase() + "/join", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        credentials: "include",
        body: JSON.stringify({
          playerId: playerData.id,
          playerName: playerData.name,
          avatarColor: playerData.avatarColor,
          loginMethod: playerData.loginMethod ?? null,
        }),
      });
      if (!joinRes.ok) {
        setResponding(false);
        onDismiss();
        return;
      }
    } catch {
      setResponding(false);
      onDismiss();
      return;
    }

    onDismiss();
    setLocation("/room/" + roomCode);
