const LEVEL_THRESHOLDS = [
  0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200,
  4000, 5000, 6200, 7600, 9200, 11000, 13000, 15500, 18500, 22000,
];

export function calcLevel(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

/** Calculate the level from the XP balance after this award is applied. */
export function calcLevelAfterXp(currentXp: number, gainedXp: number): number {
  return calcLevel(Math.max(0, currentXp) + Math.max(0, gainedXp));
}
