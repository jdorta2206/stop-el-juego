import { usePlayer } from "./use-player";
import { useStreak } from "./useStreak";
import { useGetStreakCalendar } from "@workspace/api-client-react";

// Authoritative streak for DISPLAY. When the player is identified, the server
// (player_scores) is the single source of truth, so the streak survives device
// changes and cache clears and always matches the calendar / profile / ranking.
// Guests and offline players fall back to the local (localStorage) streak.
//
// Shape is intentionally identical to useStreak() so it is a drop-in: callers
// read `streak.current` / `streak.longest`, `playedToday`, and may still call
// `recordPlay()` (the local fallback; the server records its own streak on score
// submit).
export function useDisplayStreak() {
  const { player, isLoaded } = usePlayer();
  const local = useStreak();
  const playerId = player?.id;
  const isGuest = !playerId || playerId === "guest";

  const { data } = useGetStreakCalendar(playerId ?? "", {
    query: {
      queryKey: ["/api/ranking/streak/calendar", playerId],
      // Do not fire private ranking requests until usePlayer has completed the
      // server-side session check. This prevents a stale localStorage profile
      // from producing a 403 while /api/auth/me is still being validated.
      enabled: isLoaded && !isGuest,
      staleTime: 30_000,
    },
  });

  if (!isGuest && data) {
    const playedToday = data.days?.find((d) => d.isToday)?.played ?? false;
    return {
      streak: {
        current: data.currentStreak ?? 0,
        longest: data.longestStreak ?? 0,
        lastPlayedDate: data.lastPlayedDate ?? null,
      },
      playedToday,
      recordPlay: local.recordPlay,
    };
  }

  // Guest, offline, or server data not loaded yet: use the local streak so the
  // counter never flickers to zero while the network request is in flight.
  return local;
}
