import { useState, useEffect, useCallback } from "react";
import type { OnlinePlayer } from "./usePresence";
import { getApiUrl } from "./utils";

export interface FollowedFriend {
  id: number;
  followerId: string;
  followedId: string;
  followedName: string;
  followedPicture: string | null;
  followedAvatarColor: string;
  followedProvider: string | null;
  createdAt: string;
  // merged from presence
  isOnline?: boolean;
  onlineData?: OnlinePlayer;
}

const BASE = getApiUrl();

export function useFollows(playerId: string | null, onlinePlayers: OnlinePlayer[]) {
  const [friends, setFriends] = useState<FollowedFriend[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!playerId) return;
    try {
      const res = await fetch(`${BASE}/api/friends/list/${encodeURIComponent(playerId)}`);
      if (!res.ok) return;
      const data = await res.json() as { friends: FollowedFriend[] };
      setFriends(data.friends);
      setFollowing(new Set(data.friends.map((f) => f.followedId)));
    } catch {
      // ignore
    }
  }, [playerId]);

  useEffect(() => {
    load();
  }, [load]);

  const isFollowing = useCallback((targetId: string) => following.has(targetId), [following]);

  const follow = useCallback(
    async (player: OnlinePlayer) => {
      if (!playerId) return;
      setFollowing((prev) => new Set([...prev, player.playerId]));
      try {
        await fetch(`${BASE}/api/friends/follow`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            followerId: playerId,
            followedId: player.playerId,
            followedName: player.name,
            followedPicture: player.picture,
            followedAvatarColor: player.avatarColor,
            followedProvider: player.provider,
          }),
        });
        await load();
      } catch {
        setFollowing((prev) => {
          const s = new Set(prev);
          s.delete(player.playerId);
          return s;
        });
      }
    },
    [playerId, load]
  );

  const unfollow = useCallback(
    async (followedId: string) => {
      if (!playerId) return;
      setFollowing((prev) => {
        const s = new Set(prev);
        s.delete(followedId);
        return s;
      });
      try {
        await fetch(`${BASE}/api/friends/unfollow`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ followerId: playerId, followedId }),
        });
        await load();
      } catch {
        await load();
      }
    },
    [playerId, load]
  );

  // Merge presence data with followed friends
  const onlineMap = new Map(onlinePlayers.map((p) => [p.playerId, p]));
  const enrichedFriends: FollowedFriend[] = friends.map((f) => {
    const online = onlineMap.get(f.followedId);
    return {
      ...f,
      isOnline: !!online,
      onlineData: online,
    };
  });

  return { friends: enrichedFriends, isFollowing, follow, unfollow };
}
