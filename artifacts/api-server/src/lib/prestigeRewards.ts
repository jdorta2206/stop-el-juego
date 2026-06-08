// ── Recompensas de prestigio (Leyenda) ─────────────────────────────────────
// Makes prestige ECONOMIC, not just visual: every Leyenda tier reached grants
// escalating coins, and key milestones grant exclusive frames. Prestige is
// derived from games_played (server-authoritative, incremented atomically), so
// these coin payouts are safe to be large — they can't be forged.

import { prestigeTier } from "./titleCatalog";

export { prestigeTier };

const BASE_COINS = 1500;
const STEP_COINS = 500;

// Exclusive milestone frames (unbuyable; see REWARD_FRAMES in inventoryCatalog).
const MILESTONE_FRAMES: Record<number, string> = {
  3: "frame_prestige_bronze",
  5: "frame_prestige_silver",
  10: "frame_prestige_gold",
  20: "frame_prestige_diamond",
};

export interface PrestigeReward {
  coins: number;
  frame: string | null;
}

/** Reward granted for reaching prestige `tier` (1 = Leyenda I, …). */
export function prestigeReward(tier: number): PrestigeReward {
  if (tier < 1) return { coins: 0, frame: null };
  return {
    coins: BASE_COINS + (tier - 1) * STEP_COINS,
    frame: MILESTONE_FRAMES[tier] ?? null,
  };
}

export interface PrestigeMilestoneView {
  tier: number;
  /** Roman-ish label, e.g. "Leyenda 3". */
  label: string;
  reward: PrestigeReward;
  reached: boolean;
  claimed: boolean;
  claimable: boolean;
}

/** List milestones from tier 1 up to one beyond the current prestige, each
 *  annotated with reach/claim state. */
export function evaluatePrestige(gamesPlayed: number, claimedTiers: number[]): {
  current: number;
  milestones: PrestigeMilestoneView[];
} {
  const current = prestigeTier(gamesPlayed);
  const claimed = new Set(claimedTiers);
  const top = Math.max(current + 1, 1);
  const milestones: PrestigeMilestoneView[] = [];
  for (let tier = 1; tier <= top; tier++) {
    const reached = tier <= current;
    const isClaimed = claimed.has(tier);
    milestones.push({
      tier,
      label: `Leyenda ${tier}`,
      reward: prestigeReward(tier),
      reached,
      claimed: isClaimed,
      claimable: reached && !isClaimed,
    });
  }
  return { current, milestones };
}
