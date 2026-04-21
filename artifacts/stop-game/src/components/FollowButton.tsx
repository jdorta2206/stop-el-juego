import { UserPlus, UserCheck } from "lucide-react";
import { useState } from "react";

interface FollowButtonProps {
  meId: string | null | undefined;
  targetId: string;
  targetName: string;
  targetAvatarColor?: string;
  isFollowing: boolean;
  follow: (target: { playerId: string; playerName: string; avatarColor?: string }) => Promise<boolean>;
  unfollow: (targetId: string) => Promise<boolean>;
  size?: "xs" | "sm";
  className?: string;
}

export function FollowButton({
  meId,
  targetId,
  targetName,
  targetAvatarColor,
  isFollowing,
  follow,
  unfollow,
  size = "sm",
  className = "",
}: FollowButtonProps) {
  const [busy, setBusy] = useState(false);
  if (!meId || meId === targetId) return null;

  const sizeClass = size === "xs"
    ? "text-[10px] px-2 py-0.5 gap-1"
    : "text-xs px-2.5 py-1 gap-1.5";
  const iconSize = size === "xs" ? 10 : 12;

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async (e) => {
        e.stopPropagation();
        if (busy) return;
        setBusy(true);
        try {
          if (isFollowing) await unfollow(targetId);
          else await follow({ playerId: targetId, playerName: targetName, avatarColor: targetAvatarColor });
        } finally { setBusy(false); }
      }}
      title={isFollowing ? `Dejar de seguir a ${targetName}` : `Seguir a ${targetName}`}
      className={`inline-flex items-center font-bold rounded-full border transition-all ${sizeClass} ${
        isFollowing
          ? "bg-green-500/15 border-green-400/40 text-green-300 hover:bg-red-500/15 hover:border-red-400/40 hover:text-red-300"
          : "bg-fuchsia-500/15 border-fuchsia-400/40 text-fuchsia-200 hover:bg-fuchsia-500/30"
      } ${busy ? "opacity-50" : "active:scale-95"} ${className}`}
    >
      {isFollowing ? <UserCheck size={iconSize} /> : <UserPlus size={iconSize} />}
      {isFollowing ? "Siguiendo" : "Seguir"}
    </button>
  );
}
