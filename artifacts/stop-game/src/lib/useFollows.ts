import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getApiUrl, authHeaders } from "@/lib/utils";
import type { OnlinePlayer } from "@/lib/usePresence";

const API_BASE = getApiUrl();
const EMPTY_ONLINE: OnlinePlayer[] = [];

export interface FollowedFriendBase {
  id: number;
  followerId: string;
  followedId: string;
  followedName: string;
  followedPicture: string | null;
  followedAvatarColor: string;
  followedProvider: string | null;
  equippedAvatar?: string | null;
  equippedFrame?: string | null;
  equippedTitle?: string | null;
  equippedBackground?: string | null;
  createdAt: string;
}

export interface FollowedFriend extends FollowedFriendBase {
  isOnline: boolean;
  onlineData?: OnlinePlayer;
}

export interface OnlineFriend {
  playerId: string;
  name: string;
  picture: string | null;
  avatarColor: string;
  provider: string | null;
  roomCode: string | null;
  lastSeen: number;
}

export function useFollows(
  meId: string | null | undefined,
  onlinePlayers: OnlinePlayer[] = EMPTY_ONLINE,
) {
  const [rawFriends, setRawFriends] = useState<FollowedFriendBase[]>([]);
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const requestRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    requestRef.current?.abort();
    if (!meId) {
      setRawFriends([]);
      setFollowedIds(new Set());
      return;
    }
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true);
    try {
      const r = await fetch(`${API_BASE}/api/friends/list/${encodeURIComponent(meId)}`, { signal: controller.signal, headers: authHeaders() });
      const data = await r.json();
      const list: FollowedFriendBase[] = data.friends ?? [];
      setRawFriends(list);
      setFollowedIds(new Set(list.map((f) => f.followedId)));
    } catch {
      if (controller.signal.aborted) return;
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, [meId]);

  useEffect(() => { refresh(); }, [refresh]);

  // Enrich friends with live presence data so legacy callers keep working.
  const friends: FollowedFriend[] = useMemo(() => {
    const onlineMap = new Map(onlinePlayers.map((p) => [p.playerId, p]));
    return rawFriends.map((f) => {
      const od = onlineMap.get(f.followedId);
      return { ...f, isOnline: !!od, onlineData: od };
    });
  }, [rawFriends, onlinePlayers]);

  const isFollowing = useCallback(
    (targetId: string) => followedIds.has(targetId),
    [followedIds],
  );

  const follow = useCallback(async (target: {
    playerId: string;
    playerName?: string;
    name?: string;
    avatarColor?: string;
    picture?: string | null;
    provider?: string | null;
  }) => {
    if (!meId) return false;
    try {
      const r = await fetch(`${API_BASE}/api/friends/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          followerId: meId,
          followedId: target.playerId,
          followedName: target.playerName ?? target.name ?? "Jugador",
          followedAvatarColor: target.avatarColor,
          followedPicture: target.picture,
          followedProvider: target.provider,
        }),
      });
      if (!r.ok) return false;
      setFollowedIds((prev) => new Set(prev).add(target.playerId));
      refresh();
      return true;
    } catch { return false; }
  }, [meId, refresh]);

  const unfollow = useCallback(async (targetId: string) => {
    if (!meId) return false;
    try {
      const r = await fetch(`${API_BASE}/api/friends/unfollow`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followerId: meId, followedId: targetId }),
      });
      if (!r.ok) return false;
      setFollowedIds((prev) => {
        const n = new Set(prev);
        n.delete(targetId);
        return n;
      });
      refresh();
      return true;
    } catch { return false; }
  }, [meId, refresh]);

  return { friends, followedIds, loading, follow, unfollow, refresh, isFollowing };
}

// Cross-reference my friends with /presence/online to know who's playing right now.
export function useFriendsOnline(
  meId: string | null | undefined,
  friends: FollowedFriend[] | FollowedFriendBase[],
) {
  const [online, setOnline] = useState<OnlineFriend[]>([]);

  useEffect(() => {
    if (!meId || friends.length === 0) { setOnline([]); return; }
    let cancelled = false;
    const controller = new AbortController();

    const fetchOnline = async () => {
      try {
        const r = await fetch(`${API_BASE}/api/presence/online`, { signal: controller.signal });
        const data = await r.json();
        const all: OnlineFriend[] = data.online ?? [];
        const friendIds = new Set(friends.map((f) => f.followedId));
        const mine = all.filter((p) => friendIds.has(p.playerId) && p.playerId !== meId);
        if (!cancelled && !controller.signal.aborted) setOnline(mine);
      } catch { /* ignore */ }
    };

    void fetchOnline();
    const id = setInterval(fetchOnline, 20000);
    return () => { cancelled = true; controller.abort(); clearInterval(id); };
  }, [meId, friends]);

  return online;
}
