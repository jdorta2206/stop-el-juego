    if (responding || respondingRef.current) return;
    respondingRef.current = true;
    setResponding(true);
    const controller = new AbortController();
    actionAbortRef.current = controller;

    // Read player data once — needed for /join in both flows
    let playerData: { id: string; name: string; avatarColor: string; loginMethod?: string | null } | null = null;
    try {
      const stored = localStorage.getItem("stop_player_v2");
      if (stored) playerData = JSON.parse(stored);
    } catch { /* ignore */ }

    if (!isRoomInvite) {
      const response = await respondToChallenge(challenge.challengeId, true);
      if (!response.roomCode || response.roomCode.toUpperCase() !== challenge.roomCode.toUpperCase()) {
        onDismiss();
        return;
      }
    }

    // Always call /join so the player appears in the room lobby (both reto and room invite)
    if (playerData?.id) {
      try {
        const apiBase = (import.meta as any).env?.VITE_API_URL ?? window.location.origin;
        await fetch(`${apiBase}/api/rooms/${challenge.roomCode.toUpperCase()}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          credentials: "include",
          signal: controller.signal,
          body: JSON.stringify({
            playerId: playerData.id,
            playerName: playerData.name,
            avatarColor: playerData.avatarColor,
            loginMethod: playerData.loginMethod ?? null,
          }),
        });
      } catch { /* silently proceed even if join fails */ }
    }

    if (!controller.signal.aborted) {
      onDismiss();
      setLocation(`/room/${challenge.roomCode}`);
    }
  };

  const handleDecline = async () => {
    if (responding) return;
    actionAbortRef.current?.abort();
    setResponding(true);