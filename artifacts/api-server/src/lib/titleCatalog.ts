// ── Unlockable titles ──────────────────────────────────────────────────────
// Titles are EARNED BY PLAYING — never bought. Each title has an unlock
// predicate evaluated against the player's stats, so we don't need to persist
// an "unlocked list": availability is always derivable from current stats. The
// only thing stored per player is which title they chose to display
// (player_scores.equipped_title), validated against these criteria on equip.
//
// The frontend mirrors id → { label, icon, color } to render equipped titles
// on any profile. Keep that mirror (PlayerProfile.tsx) in sync with this list.

// Title unlock predicates only ever read SERVER-AUTHORITATIVE counters. These are
// the columns the server itself increments atomically in POST /ranking/scores
// (games/wins/score) or computes from game history (streaks). We deliberately do
// NOT base any title on client-merged fields (achievements_json /
// collected_words_json from POST /ranking/progress), since a crafted request
// could otherwise self-award an "earned by playing" title.
export interface TitleStats {
  gamesPlayed: number;
  wins: number;
  currentStreak: number;
  longestStreak: number;
  level: number;
  totalScore: number;
  /** 0 = not yet Leyenda; 1 = Leyenda I, 2 = Leyenda II, … (200 games + 100/tier). */
  prestige: number;
}

export interface TitleDef {
  id: string;
  label: string;
  /** Single emoji shown before the label. */
  icon: string;
  /** CSS color for the title text/pill. */
  color: string;
  /** Short Spanish hint shown while locked. */
  desc: string;
  /** True when the player's stats satisfy the unlock criteria. */
  req: (s: TitleStats) => boolean;
}

export const TITLES: TitleDef[] = [
  { id: "novato",        label: "Novato",        icon: "🌱", color: "#9ca3af", desc: "Juega tu primera partida.",            req: (s) => s.gamesPlayed >= 1 },
  { id: "jugador",       label: "Jugador",       icon: "🎮", color: "#3b82f6", desc: "Juega 25 partidas.",                   req: (s) => s.gamesPlayed >= 25 },
  { id: "veterano",      label: "Veterano",      icon: "🛡️", color: "#f59e0b", desc: "Juega 100 partidas.",                  req: (s) => s.gamesPlayed >= 100 },
  { id: "en_racha",      label: "En Racha",      icon: "🔥", color: "#f97316", desc: "Consigue una racha de 7 días.",        req: (s) => s.longestStreak >= 7 },
  { id: "imparable",     label: "El Imparable",  icon: "⚡", color: "#eab308", desc: "Consigue una racha de 30 días.",       req: (s) => s.longestStreak >= 30 },
  { id: "ganador",       label: "Ganador",       icon: "🏅", color: "#22c55e", desc: "Gana 50 partidas.",                    req: (s) => s.wins >= 50 },
  { id: "invencible",    label: "Invencible",    icon: "⚔️", color: "#ef4444", desc: "Gana 250 partidas.",                   req: (s) => s.wins >= 250 },
  { id: "erudito",       label: "Erudito",       icon: "📚", color: "#06b6d4", desc: "Acumula 10.000 puntos totales.",       req: (s) => s.totalScore >= 10000 },
  { id: "millonario",    label: "Millonario",    icon: "💰", color: "#fbbf24", desc: "Acumula 50.000 puntos totales.",       req: (s) => s.totalScore >= 50000 },
  { id: "sabio",         label: "Sabio",         icon: "🧠", color: "#a855f7", desc: "Acumula 150.000 puntos totales.",      req: (s) => s.totalScore >= 150000 },
  { id: "coleccionista", label: "Coleccionista", icon: "🏆", color: "#f472b6", desc: "Gana 100 partidas.",                   req: (s) => s.wins >= 100 },
  { id: "leyenda_viva",  label: "Leyenda Viva",  icon: "👑", color: "#fde047", desc: "Alcanza el rango Leyenda (200 partidas).", req: (s) => s.prestige >= 1 },
];

const TITLE_BY_ID = new Map(TITLES.map((t) => [t.id, t]));

export function titleDef(id: string): TitleDef | null {
  return TITLE_BY_ID.get(id) ?? null;
}

/** Prestige tier from games played: 0 below 200, then +1 every 100 games. */
export function prestigeTier(gamesPlayed: number): number {
  if (gamesPlayed < 200) return 0;
  return Math.floor((gamesPlayed - 200) / 100) + 1;
}

/** Build the stat bundle the title predicates need from a player_scores row.
 *  Reads only server-authoritative counters — see the note on TitleStats. */
export function computeTitleStats(row: {
  games_played?: number | null;
  wins?: number | null;
  current_streak?: number | null;
  longest_streak?: number | null;
  level?: number | null;
  total_score?: number | null;
}): TitleStats {
  const gamesPlayed = Number(row.games_played ?? 0);
  return {
    gamesPlayed,
    wins: Number(row.wins ?? 0),
    currentStreak: Number(row.current_streak ?? 0),
    longestStreak: Number(row.longest_streak ?? 0),
    level: Number(row.level ?? 1),
    totalScore: Number(row.total_score ?? 0),
    prestige: prestigeTier(gamesPlayed),
  };
}

export interface TitleView {
  id: string;
  label: string;
  icon: string;
  color: string;
  desc: string;
  unlocked: boolean;
}

/** Full catalog annotated with each title's unlocked state for the given stats. */
export function evaluateTitles(stats: TitleStats): TitleView[] {
  return TITLES.map((t) => ({
    id: t.id,
    label: t.label,
    icon: t.icon,
    color: t.color,
    desc: t.desc,
    unlocked: t.req(stats),
  }));
}

export function isTitleUnlocked(id: string, stats: TitleStats): boolean {
  const def = titleDef(id);
  return def ? def.req(stats) : false;
}
