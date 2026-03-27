export const POWER_CARDS = {
  oracle: {
    id: "oracle" as const,
    emoji: "🔮",
    color: "#a855f7",
    timing: "auto_results" as const,
  },
  sabotage: {
    id: "sabotage" as const,
    emoji: "❌",
    color: "#ef4444",
    timing: "playing" as const,
  },
  double_or_nothing: {
    id: "double_or_nothing" as const,
    emoji: "🎯",
    color: "#f97316",
    timing: "auto" as const,
  },
  steal: {
    id: "steal" as const,
    emoji: "🔄",
    color: "#22d3ee",
    timing: "auto_results" as const,
  },
  lightning: {
    id: "lightning" as const,
    emoji: "⚡",
    color: "#facc15",
    timing: "playing" as const,
  },
  shield: {
    id: "shield" as const,
    emoji: "🛡️",
    color: "#4ade80",
    timing: "auto" as const,
  },
} as const;

export type PowerCardId = keyof typeof POWER_CARDS;
export type PowerCard = (typeof POWER_CARDS)[PowerCardId];

export function drawPowerCard(isQuickMode: boolean, isChaosMode: boolean): PowerCardId | null {
  const roll = Math.random();
  const threshold = isQuickMode ? 0.4 : isChaosMode ? 0.85 : 0.65;
  if (roll > threshold) return null;
  const cards = Object.keys(POWER_CARDS) as PowerCardId[];
  return cards[Math.floor(Math.random() * cards.length)];
}
