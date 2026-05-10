// ── Season Pass: shared mission + tier configuration ────────────────────────
// All values are deterministic so server and client agree on rewards.

export const SEASON_LENGTH_DAYS = 28; // 4 weeks
export const TOTAL_TIERS = 30;

// XP needed to *reach* tier N (cumulative). Tier 1 is unlocked at 100 XP, tier
// 30 at 3000 XP. Total achievable in 28 days at ~100 XP/day of missions.
export function xpForTier(tier: number): number {
  return Math.max(1, tier) * 100;
}

export function tierFromXp(xp: number): number {
  return Math.min(TOTAL_TIERS, Math.floor(xp / 100));
}

// ── Daily missions ──────────────────────────────────────────────────────────
// 4 fixed mission templates rotate by day index. Each player on a given day
// gets the same 4 missions (deterministic by date), so leaderboards are fair.
export type MissionTemplate = {
  id: string;            // stable ID for a template
  type: string;          // event type that drives progress
  target: number;        // value needed to complete
  xpReward: number;      // season XP awarded on completion
  i18nKey: string;       // UI string key
};

const MISSION_POOL: MissionTemplate[] = [
  { id: "win_1",      type: "win_game",   target: 1,  xpReward: 30, i18nKey: "winOne" },
  { id: "play_2",     type: "play_game",  target: 2,  xpReward: 20, i18nKey: "playTwo" },
  { id: "play_3",     type: "play_game",  target: 3,  xpReward: 30, i18nKey: "playThree" },
  { id: "score_30",   type: "round_score",target: 30, xpReward: 25, i18nKey: "score30" },
  { id: "score_50",   type: "round_score",target: 50, xpReward: 35, i18nKey: "score50" },
  { id: "streak_3",   type: "streak",     target: 3,  xpReward: 25, i18nKey: "streak3" },
  { id: "valid_15",   type: "valid_words",target: 15, xpReward: 25, i18nKey: "valid15" },
  { id: "daily_done", type: "daily_done", target: 1,  xpReward: 30, i18nKey: "dailyDone" },
];

function dayIndexFromDate(dateStr: string): number {
  // Days since 2020-01-01 — stable, monotonic.
  const d = new Date(dateStr + "T00:00:00Z").getTime();
  const base = new Date("2020-01-01T00:00:00Z").getTime();
  return Math.floor((d - base) / 86_400_000);
}

export type Mission = MissionTemplate & {
  progress: number;
  completed: boolean;
  claimed: boolean;
};

/** Pick 4 deterministic missions for a date, with zero progress. */
export function buildMissionsForDate(dateStr: string): Mission[] {
  const day = dayIndexFromDate(dateStr);
  // Rotate the pool by day so the 4 chosen vary day to day, but identically
  // for every player. Picks indices [day, day+1, day+2, day+3] mod pool size.
  const picks: Mission[] = [];
  for (let i = 0; i < 4; i++) {
    const tpl = MISSION_POOL[(day + i) % MISSION_POOL.length];
    picks.push({ ...tpl, progress: 0, completed: false, claimed: false });
  }
  return picks;
}

// ── Tier rewards ────────────────────────────────────────────────────────────
export type TierReward = {
  tier: number;
  free: { kind: "coins" | "avatar" | "frame"; value: string | number; label: string };
  premium: { kind: "coins" | "avatar" | "frame"; value: string | number; label: string };
};

const FRAME_NAMES = ["Bronce", "Plata", "Oro", "Diamante", "Maestro", "Leyenda"];
const AVATAR_NAMES = ["🎯", "🔥", "⚡", "🌟", "👑", "💎"];

export function tierReward(tier: number): TierReward {
  // Free track: mostly coins, an avatar/frame every 5 tiers.
  // Premium track: bigger coin payouts + premium frames/avatars.
  const isMilestone = tier % 5 === 0;
  const milestoneIdx = Math.floor(tier / 5) - 1;
  return {
    tier,
    free: isMilestone && milestoneIdx >= 0
      ? { kind: "frame", value: `frame_free_${tier}`, label: `Marco ${FRAME_NAMES[milestoneIdx % FRAME_NAMES.length]}` }
      : { kind: "coins", value: 50 + tier * 10, label: `${50 + tier * 10} monedas` },
    premium: isMilestone && milestoneIdx >= 0
      ? { kind: "avatar", value: `avatar_premium_${tier}`, label: `Avatar ${AVATAR_NAMES[milestoneIdx % AVATAR_NAMES.length]}` }
      : { kind: "coins", value: 100 + tier * 20, label: `${100 + tier * 20} monedas` },
  };
}

export function allTierRewards(): TierReward[] {
  const out: TierReward[] = [];
  for (let t = 1; t <= TOTAL_TIERS; t++) out.push(tierReward(t));
  return out;
}

// ── Season theme generator ──────────────────────────────────────────────────
const THEMES = [
  { name: "Fuego de Verano", color: "#f97316", emoji: "🔥", tagline: "Desafía el calor con palabras ardientes" },
  { name: "Tormenta de Letras",color: "#0ea5e9", emoji: "⚡", tagline: "Descarga toda tu velocidad mental" },
  { name: "Cosecha Dorada",   color: "#eab308", emoji: "🌾", tagline: "Recoge XP y recompensas cada día" },
  { name: "Escarcha Helada",  color: "#67e8f9", emoji: "❄️", tagline: "Congela a tus rivales con tus respuestas" },
  { name: "Renacer Floral",   color: "#ec4899", emoji: "🌸", tagline: "Una nueva temporada, una nueva oportunidad" },
];

export function themeForStartDate(startDate: string): { name: string; color: string; emoji: string; tagline: string } {
  const idx = dayIndexFromDate(startDate);
  return THEMES[Math.abs(idx) % THEMES.length];
}
