export type AiDifficulty = "free" | "premium";

type AiCategoryPlan = {
  readyAtMs: number;
  succeeds: boolean;
};

export type AiRoundPlan = Map<string, AiCategoryPlan>;

const CONFIG = {
  free: {
    reactionMinMs: 1500,
    reactionMaxMs: 4000,
    minAccuracy: 0.40,
    maxAccuracy: 0.60,
  },
  premium: {
    reactionMinMs: 500,
    reactionMaxMs: 1500,
    minAccuracy: 0.80,
    maxAccuracy: 0.95,
  },
} as const;

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function createAiRoundPlan(
  categories: string[],
  isPremium: boolean,
  elapsedMs: number,
): AiRoundPlan {
  const difficulty: AiDifficulty = isPremium ? "premium" : "free";
  const cfg = CONFIG[difficulty];
  const uniqueCategories = [...new Set(categories)];

  // Bounded accuracy keeps the AI human-like instead of occasionally producing
  // absurd all-right or all-wrong rounds from independent random rolls.
  const minSuccesses = Math.ceil(uniqueCategories.length * cfg.minAccuracy);
  const maxSuccesses = Math.max(minSuccesses, Math.floor(uniqueCategories.length * cfg.maxAccuracy));
  const targetSuccesses = randomInt(minSuccesses, maxSuccesses);

  const ranked = uniqueCategories.map((category) => ({
    category,
    readyAtMs: randomInt(cfg.reactionMinMs, cfg.reactionMaxMs),
  })).sort((a, b) => a.readyAtMs - b.readyAtMs);

  const plan: AiRoundPlan = new Map();
  ranked.forEach((item, index) => {
    plan.set(item.category, {
      readyAtMs: item.readyAtMs,
      succeeds: index < targetSuccesses && item.readyAtMs <= Math.max(0, elapsedMs),
    });
  });

  return plan;
}

export function shouldAiAnswer(plan: AiRoundPlan, category: string): boolean {
  return !!plan.get(category)?.succeeds;
}
