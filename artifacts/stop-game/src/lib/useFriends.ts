import { useState, useEffect } from "react";
import type { OnlinePlayer } from "./usePresence";

export interface FBFriend {
  id: string;         // Facebook user ID (raw, not prefixed)
  name: string;
  picture: string | null;
}

// Fetch Facebook app-friends via Graph API client-side
// NOTE: /me/friends only returns friends who have also authorized this app
export async function fetchFacebookFriends(accessToken: string): Promise<FBFriend[]> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/me/friends?fields=id,name,picture.type(normal)&access_token=${accessToken}&limit=50`
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (data.error) {
      console.warn("FB friends API:", data.error.message);
      return [];
    }
    return (data.data || []).map((f: any) => ({
      id: f.id,
      name: f.name,
      picture: f.picture?.data?.url || null,
    }));
  } catch {
    return [];
  }
}

export interface EnrichedFriend {
  fbId: string;
  name: string;
  picture: string | null;
  isOnline: boolean;
  onlineData: OnlinePlayer | null;
}

// Cross-reference Facebook friends with online players
export function enrichFriendsWithPresence(
  friends: FBFriend[],
  onlinePlayers: OnlinePlayer[]
): EnrichedFriend[] {
  return friends.map((f) => {
    // Online players with Facebook provider have playerId = `fb_${fbId}`
    const online = onlinePlayers.find((p) => p.playerId === `fb_${f.id}`);
    return {
      fbId: f.id,
      name: f.name,
      picture: f.picture,
      isOnline: !!online,
      onlineData: online || null,
    };
  });
}

export function useFacebookFriends(
  fbAccessToken: string | null | undefined,
  onlinePlayers: OnlinePlayer[]
) {
  const [friends, setFriends] = useState<FBFriend[]>([]);
  const [enriched, setEnriched] = useState<EnrichedFriend[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!fbAccessToken) return;
    setLoading(true);
    fetchFacebookFriends(fbAccessToken)
      .then((f) => setFriends(f))
      .finally(() => setLoading(false));
  }, [fbAccessToken]);

  useEffect(() => {
    setEnriched(enrichFriendsWithPresence(friends, onlinePlayers));
  }, [friends, onlinePlayers]);

  return { friends, enriched, loading };
}
