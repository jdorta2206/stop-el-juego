import confetti from "canvas-confetti";

const REWARD_COLORS = ["#f9a825", "#fde047", "#a855f7", "#22d3ee", "#22c55e"];

/**
 * Celebratory confetti burst fired when a reward is successfully claimed
 * (prestige milestone or collection set). Non-critical: wrapped so a confetti
 * failure never blocks the claim flow.
 */
export function celebrateReward(): void {
  try {
    confetti({ particleCount: 90, spread: 72, startVelocity: 38, origin: { y: 0.7 }, colors: REWARD_COLORS });
    setTimeout(() => confetti({ particleCount: 50, angle: 60, spread: 55, origin: { x: 0, y: 0.7 }, colors: REWARD_COLORS }), 130);
    setTimeout(() => confetti({ particleCount: 50, angle: 120, spread: 55, origin: { x: 1, y: 0.7 }, colors: REWARD_COLORS }), 260);
  } catch {
    /* confetti is purely cosmetic — ignore any failure */
  }
}
