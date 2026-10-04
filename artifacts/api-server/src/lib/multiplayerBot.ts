/**
 * Multiplayer bots — fake AI players that join multiplayer rooms so the
 * game never feels empty. Cold-start killer: if you open the app and nobody
 * else is online, the host can add a bot and play a real-feeling match.
 *
 * Design:
 * - Bots are stored inside `room.playersJson` like normal players, with
 *   an extra `isBot: true` flag so the client can label them.
 * - All bot timing happens in this module via `setTimeout`. When the room
 *   transitions to "playing" we schedule the bot's STOP + submit; when the
 *   room goes "finished" or the bot is removed we cancel.
 * - Bot answers come from a curated Spanish noun bank, picked per category
 *   for the round's letter. The server-side scorer awards points purely on
 *   letter + uniqueness (it doesn't validate semantics) so common nouns
 *   score reliably.
 * - The bot never bluffs, never uses power cards, never votes — these are
 *   all opt-in interactions and skipping them keeps it predictable.
 */
import { db } from "@workspace/db";
import { roomsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import OpenAI from "openai";
import { isWordValidAsync } from "../routes/game";

// ── LLM-backed answer generation ──────────────────────────────────────────
// Bots used to pick random nouns from a hand-curated bank ignoring the round
// category. That worked but felt obviously stupid ("lápiz" submitted for the
// "Animal" category). With an LLM call per bot per round we get actually
// plausible category-specific Spanish answers, capped by a tight quota so
// the spend stays under a euro per month even at higher engagement.
const LLM_MODEL = "gpt-5-mini";
// Hard caps. 3 bots × ~3 rounds × ~30 games/day = 270 calls. 500 leaves
// headroom and matches the budget shape used by aiWordValidator.ts.
const LLM_GLOBAL_DAILY_LIMIT = 500;

// Keep bot timers strictly inside the server-authoritative round window.
const ROUND_TIME_DEFAULT_SECS = 60;
const RANDOM_MIN_SECS = 15;
const RANDOM_MAX_SECS = 55;
function randomRoundDurationSecs(roomCode: string, round: number, letter: string): number {
  const seed = `${roomCode}|${round}|${letter}`;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return RANDOM_MIN_SECS + (Math.abs(hash) % (RANDOM_MAX_SECS - RANDOM_MIN_SECS + 1));
}
function roundDurationSecsForRoom(room: any): number {
  if (room.gameMode === "blitz") return 30;
  if (room.gameMode === "random") return randomRoundDurationSecs(room.roomCode, room.currentRound ?? 1, room.currentLetter ?? "A");
  return ROUND_TIME_DEFAULT_SECS;
}

const llmQuotaReady = db.execute(sql`
  CREATE TABLE IF NOT EXISTS bot_llm_daily_quota (
    quota_date date PRIMARY KEY,
    used integer NOT NULL DEFAULT 0
  )
`).catch((err) => {
  console.error("[bot] failed to initialize persistent LLM quota:", err);
  throw err;
});

async function bumpAndCheckLlmQuota(): Promise<boolean> {
  await llmQuotaReady;
  const result = await db.execute(sql`
    INSERT INTO bot_llm_daily_quota (quota_date, used)
    VALUES (CURRENT_DATE, 1)
    ON CONFLICT (quota_date) DO UPDATE
      SET used = bot_llm_daily_quota.used + 1
      WHERE bot_llm_daily_quota.used < ${LLM_GLOBAL_DAILY_LIMIT}
    RETURNING used
  `);
  return result.rows.length > 0;
}
let _llmClient: OpenAI | null = null;
function getLlmClient(): OpenAI | null {
  if (_llmClient) return _llmClient;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) return null;
  _llmClient = new OpenAI({ baseURL, apiKey });
  return _llmClient;
}

async function generateBotAnswersLLM(
  letter: string,
  categories: string[],
): Promise<Record<string, string> | null> {
  const client = getLlmClient();
  if (!client) return null;
  if (!(await bumpAndCheckLlmQuota())) return null;
  const L = letter.toUpperCase();
  // Variety knob: bots intentionally miss a few categories so they don't
  // always score 100%. Asking for 60-90% fillrate produces more human-feel.
  const fillRate = 0.6 + Math.random() * 0.3;
  const targetCount = Math.max(1, Math.round(categories.length * fillRate));
  const prompt = [
    `Eres un jugador de STOP (Scattergories) en español.`,
    `Letra de la ronda: "${L}".`,
    `Categorías: ${JSON.stringify(categories)}.`,
    `Devuelve ${targetCount} respuestas (NO más). Reglas:`,
    `- Cada respuesta DEBE empezar por la letra ${L} (mayúscula o minúscula da igual).`,
    `- Una sola palabra o nombre corto (máx 3 palabras).`,
    `- Palabras comunes que un hispanohablante reconozca, no inventos.`,
    `- Una respuesta por categoría como mucho; deja fuera las que no sepas.`,
    `- Responde SOLO con JSON válido: {"NombreCategoria": "palabra", ...}.`,
  ].join("\n");
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8_000);
    let completion;
    try {
      completion = await client.chat.completions.create({
        model: LLM_MODEL,
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
    const raw = (completion as any).choices?.[0]?.message?.content;
    if (typeof raw !== "string") return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const out: Record<string, string> = {};
    for (const cat of categories) {
      const val = (parsed as Record<string, unknown>)[cat];
      if (typeof val === "string" && val.trim().length > 0) {
        const word = val.trim().slice(0, 60);
        if (stripAccents(word).toUpperCase().startsWith(L)) out[cat] = word;
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch (err) {
    console.warn("[bot] LLM generation failed:", (err as Error).message ?? err);
    return null;
  }
}

// roomCode → botPlayerId → { round, letter, answers } ready for the round.
// Tagged with round+letter so a late-resolving LLM promise from a previous
// round can never bleed into the next one (race seen in code review).
type PendingEntry = { round: number; letter: string; answers: Record<string, string> };
const botPendingAnswers = new Map<string, Map<string, PendingEntry>>();
function setPendingAnswers(code: string, botId: string, entry: PendingEntry) {
  let m = botPendingAnswers.get(code);
  if (!m) { m = new Map(); botPendingAnswers.set(code, m); }
  m.set(botId, entry);
}
function getPendingAnswers(
  code: string, botId: string, round: number, letter: string,
): Record<string, string> | null {
  const e = botPendingAnswers.get(code)?.get(botId);
  if (!e) return null;
  if (e.round !== round) return null;
  if (e.letter.toUpperCase() !== letter.toUpperCase()) return null;
  return e.answers;
}
function clearPendingAnswers(code: string) {
  botPendingAnswers.delete(code);
}

// Strip Spanish accents so "Águila" passes the "starts with A" check, in
// line with how the scoring layer normalizes user submissions.
function stripAccents(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

// ── Bot identities ────────────────────────────────────────────────────────
// Short, memorable names. Colors picked to be visually distinct from the
// most common avatar palette so a bot's avatar stands out at a glance.
const BOT_POOL: { name: string; color: string }[] = [
  { name: "Pix",  color: "#a855f7" },
  { name: "Nova", color: "#06b6d4" },
  { name: "Luma", color: "#f59e0b" },
  { name: "Zeta", color: "#10b981" },
  { name: "Echo", color: "#ec4899" },
  { name: "Kio",  color: "#ef4444" },
];

export function pickBotIdentity(takenNames: string[]): { name: string; color: string } | null {
  const taken = new Set(takenNames.map(n => n.trim().toLowerCase()));
  const free = BOT_POOL.filter(b => !taken.has(b.name.toLowerCase()));
  if (free.length === 0) return null;
  return free[Math.floor(Math.random() * free.length)];
}

// ── Word bank ─────────────────────────────────────────────────────────────
// 8-12 common Spanish nouns per letter. Bot picks N for the round (one per
// category slot the human is filling). Server scoring is letter+uniqueness
// based, so any of these will score 10 points each.
const WORDS_ES: Record<string, string[]> = {
  A: ["arroz","abuelo","azul","argentina","avión","albahaca","amigo","alemania","alondra"],
  B: ["barco","bilbao","ballena","brasil","blanco","banana","bombero","bandera","botella"],
  C: ["coche","colombia","conejo","cuchara","celeste","cereza","camarero","colgate","ciudad"],
  D: ["dedo","dinamarca","delfín","destornillador","dorado","durazno","doctor","danone","desierto"],
  E: ["espejo","españa","elefante","escoba","escarlata","escarola","escritor","ericsson","estadio"],
  F: ["fresa","francia","foca","forquilla","fucsia","fresco","futbolista","ferrari","flores"],
  G: ["goma","grecia","gato","guitarra","gris","granada","guardia","gucci","gimnasio"],
  H: ["hilo","honduras","halcón","horno","huevo","hortaliza","herrero","heineken","hospital"],
  I: ["isla","italia","iguana","inodoro","índigo","indio","ingeniero","iberia","iglesia"],
  J: ["jarra","japón","jirafa","jeringa","jade","jamón","juez","jaguar","jardín"],
  K: ["kiwi","kenia","koala","kayak","caqui","kebab","karateka","kodak","kiosko"],
  L: ["lápiz","lima","león","lavadora","lila","limón","lechero","levis","lago"],
  M: ["mesa","madrid","mono","martillo","marrón","mango","médico","mercedes","montaña"],
  N: ["nido","noruega","nutria","nevera","negro","naranja","notario","nestlé","nube"],
  O: ["olla","omán","oso","ordenador","oro","oliva","obrero","omega","océano"],
  P: ["plato","perú","perro","peine","púrpura","piña","panadero","puma","puente"],
  R: ["rueda","rusia","rana","radio","rojo","remolacha","rector","ray-ban","río"],
  S: ["silla","sevilla","serpiente","sartén","salmón","sandía","sastre","samsung","selva"],
  T: ["taza","turquía","tigre","tijera","turquesa","tomate","taxista","toyota","torre"],
  U: ["uña","uruguay","urraca","ukelele","ultravioleta","uva","urbanista","umbro","universidad"],
  V: ["vaso","venezuela","vaca","ventilador","violeta","vainilla","veterinario","volkswagen","valle"],
  W: ["wifi","washington","wombat","walkman","whisky","wakame","webmaster","whirlpool","waterpolo"],
  Y: ["yema","yemen","yegua","yoyo","yema","yuca","yogui","yamaha","yacimiento"],
  Z: ["zapato","zaragoza","zorro","zumo","zafiro","zanahoria","zapatero","zara","zoológico"],
};

// ── Bot factory ───────────────────────────────────────────────────────────
export type BotPlayer = {
  playerId: string;
  playerName: string;
  avatarColor: string;
  loginMethod: null;
  isPremium: false;
  isBot: true;
  score: number;
  roundScore: number;
  isHost: false;
  isReady: false;
};

export function makeBotPlayer(identity: { name: string; color: string }): BotPlayer {
  const id = `bot_${identity.name.toLowerCase()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    playerId: id,
    playerName: identity.name,
    avatarColor: identity.color,
    loginMethod: null,
    isPremium: false,
    isBot: true,
    score: 0,
    roundScore: 0,
    isHost: false,
    isReady: false,
  };
}

// ── Timer management ──────────────────────────────────────────────────────
// roomCode → set of scheduled timeouts. Cleared on round advance / room end.
const roomBotTimers = new Map<string, Set<NodeJS.Timeout>>();
const roomBotTimerBots = new Map<string, Set<string>>();

function trackTimer(code: string, t: NodeJS.Timeout, botId?: string) {
  let set = roomBotTimers.get(code);
  if (!set) { set = new Set(); roomBotTimers.set(code, set); }
  set.add(t);
  if (botId) {
    let bots = roomBotTimerBots.get(code);
    if (!bots) { bots = new Set(); roomBotTimerBots.set(code, bots); }
    bots.add(botId);
  }
}

function untrackTimer(code: string, t: NodeJS.Timeout, botId?: string) {
  const set = roomBotTimers.get(code);
  if (!set) return;
  set.delete(t);
  if (botId) {
    const bots = roomBotTimerBots.get(code);
    if (bots) {
      bots.delete(botId);
      if (bots.size === 0) roomBotTimerBots.delete(code);
    }
  }
  if (set.size === 0) roomBotTimers.delete(code);
}

export function cleanupStaleBotRooms(liveRoomCodes: ReadonlySet<string>) {
  const stale = new Set<string>();
  for (const code of roomBotTimers.keys()) {
    if (!liveRoomCodes.has(code)) stale.add(code);
  }
  for (const code of roomBotTimerBots.keys()) {
    if (!liveRoomCodes.has(code)) stale.add(code);
  }
  for (const code of stale) cleanupBotRoom(code);
}

export function clearBotTimers(code: string) {
  const set = roomBotTimers.get(code);
  if (set) {
    for (const t of set) clearTimeout(t);
    roomBotTimers.delete(code);
  }
  roomBotTimerBots.delete(code);
  // NOTE: pending LLM answers are intentionally NOT cleared here.
  // rushBotSubmits() calls clearBotTimers to cancel the long 25-50s timers
  // when a human STOPs early — but bots still need to consume the
  // pregenerated LLM answers in that flow. Pending answers are cleared
  // explicitly at the start of every new round (scheduleBotsForRound) and
  // on full room cleanup (cleanupBotRoom).
}

// Full cleanup — call when a room is destroyed (last player /leave delete).
export function cleanupBotRoom(code: string) {
  clearBotTimers(code);
  clearPendingAnswers(code);
}

// ── Category resolution (server mirror of the client packs) ───────────────
// Kept in sync with artifacts/stop-game/src/pages/Room.tsx (CATEGORIES_ES +
// CRAZY_CATEGORIES_ES + computeCategories). Small acceptable duplication so
// the bot can ask the LLM with the SAME category names humans see.
const STANDARD_CATEGORIES_ES = [
  "Nombre", "Lugar", "Animal", "Objeto", "Color", "Fruta", "Marca",
];
const CRAZY_CATEGORIES_ES = [
  "Excusa para llegar tarde", "Película que finges haber visto", "Animal que querrías de mascota",
  "Cosa que no debes decir en una cita", "Superhéroe inventado", "Profesión del futuro",
  "Cosa que encuentras bajo el sofá", "Deporte que nunca se inventó",
];

export function resolveCategoriesForRound(
  pack: "standard" | "crazy" | "mix" | "custom" | undefined,
  letter: string,
  round: number,
  customCategories?: string[],
): string[] {
  if (pack === "custom" && customCategories && customCategories.length > 0) {
    // Cap at 12 — UI/scoring assume bounded category counts.
    return customCategories.slice(0, 12);
  }
  if (pack === "crazy") return CRAZY_CATEGORIES_ES;
  if (pack === "mix") {
    const seed = (letter || "A").charCodeAt(0) * 31 + (round || 1) * 7;
    const mixed = [...STANDARD_CATEGORIES_ES];
    const idx = seed % mixed.length;
    const crazyIdx = seed % CRAZY_CATEGORIES_ES.length;
    mixed[idx] = CRAZY_CATEGORIES_ES[crazyIdx];
    return mixed;
  }
  return STANDARD_CATEGORIES_ES;
}

// ── Word generation per round ─────────────────────────────────────────────
function pickWordsForRound(letter: string, categoryCount: number): string[] {
  const L = letter.toUpperCase();
  const bank = WORDS_ES[L] ?? [];
  if (bank.length === 0) return [];
  // Realistic bot fillrate: 55-90% of categories (varies per round).
  const fillRate = 0.55 + Math.random() * 0.35;
  const targetCount = Math.max(1, Math.round(categoryCount * fillRate));
  const shuffled = [...bank].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(targetCount, bank.length));
}

// ── Bot action: STOP + submit ─────────────────────────────────────────────
// Pure server-side: writes directly to the rooms row, mirroring the side
// effects of POST /:code/stop followed by POST /:code/results for the bot's
// own playerId. Skips bluff voting, power cards, spy logic. Does NOT enter
// bluffvoting state (bots never bluff).
type BotActionDeps = {
  broadcast: (code: string, payload: object) => void;
  formatRoom: (room: any) => any;
  submitFinalScores: (players: any[], letter: string, roomCode?: string, roomId?: number) => void | Promise<void>;
  getRoundCategories: (room: any) => string[];
};

async function performBotSubmit(
  roomCode: string,
  botPlayerId: string,
  deps: BotActionDeps,
  options: { triggerStop: boolean; attempt?: number },
): Promise<void> {
  const code = roomCode.toUpperCase();
  const attempt = options.attempt ?? 0;
  try {
    const rows = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, code)).limit(1);
    if (rows.length === 0) return;
    const room = rows[0];
    if (room.status !== "playing" && room.status !== "stopped") return;

    let players: any[];
    try { players = JSON.parse(room.playersJson); } catch { return; }

    const me = players.find(p => p.playerId === botPlayerId);
    if (!me || !me.isBot) return;
    if (me.isReady) return; // already submitted

    // Bot only triggers STOP if nobody has yet AND it's still "playing".
    let newStatus = room.status as string;
    let newStopperJson = room.stopperJson;
    if (options.triggerStop && room.status === "playing") {
      const stopTimestamp = Date.now();
      let prevMeta: any = {};
      try { prevMeta = room.stopperJson ? JSON.parse(room.stopperJson) : {}; } catch {}
      newStopperJson = JSON.stringify({
        ...prevMeta,
        stopper: { id: botPlayerId, name: me.playerName, stopTimestamp },
        stopTimestamp,
        roundStartedAt: prevMeta?.roundStartedAt ?? Date.now(),
      });
      newStatus = "stopped";
    }

    // Compose bot answers — prefer the LLM-pregenerated set from round
    // start (category-aware), fall back to the random word bank if the LLM
    // call failed or quota was exceeded.
    const letter = (room.currentLetter ?? "A").toUpperCase();
    const sampleCats = deps.getRoundCategories(room);
    let answers: Record<string, string> = {};
    const pregen = getPendingAnswers(code, botPlayerId, room.currentRound ?? 0, letter);
    if (pregen && Object.keys(pregen).length > 0) {
      answers = pregen;
    } else {
      const words = pickWordsForRound(letter, sampleCats.length);
      words.forEach((w, i) => { if (sampleCats[i]) answers[sampleCats[i]] = w; });
    }
    // 🔒 Use the exact same authoritative validator as human /results.
    // Bots must never score from a weaker "starts with letter" rule because
    // their score participates in the winner calculation.
    let validBotWords = 0;
    for (const category of sampleCats) {
      const w = answers[category];
      if (typeof w !== "string" || !w.trim()) continue;
      const valid = await isWordValidAsync(
        w, letter, category, room.language ?? "es", botPlayerId,
      );
      if (valid) {
        // Scoring is per category/cell, matching human /results: the same
        // valid word may legitimately satisfy multiple categories (e.g.
        // "naranja" as Fruit and Color), so do not deduplicate by word.
        validBotWords++;
      }
    }
    const roundScore = validBotWords * 10;

    const finishedAt = Date.now();

    // 🔒 Multi-instance safe commit: the earlier read is only used to prepare
    // the bot answers. The authoritative room mutation happens under a
    // PostgreSQL row lock, so another Railway instance cannot overwrite a
    // human submission with the stale playersJson snapshot.
    const committed = await db.transaction(async (tx) => {
      const lockedRows = await tx.execute(
        sql`SELECT * FROM rooms WHERE room_code = ${code} FOR UPDATE`,
      );
      const lockedList = (lockedRows as any).rows ?? lockedRows;
      if (!lockedList || lockedList.length === 0) return null;

      const raw = lockedList[0];
      const lockedStatus = raw.status;
      if (lockedStatus !== "playing" && lockedStatus !== "stopped") return null;

      let lockedPlayers: any[];
      try {
        lockedPlayers = JSON.parse(raw.players_json ?? raw.playersJson);
      } catch {
        return null;
      }

      const lockedMe = lockedPlayers.find((p: any) => p.playerId === botPlayerId);
      if (!lockedMe || !lockedMe.isBot || lockedMe.isReady) return null;

      // If another instance already advanced the round while this bot was
      // validating its answers, never apply those answers to the new round.
      const lockedLetter = String(raw.current_letter ?? raw.currentLetter ?? "A").toUpperCase();
      const lockedRound = Number(raw.current_round ?? raw.currentRound ?? 0);
      if (lockedLetter !== letter || lockedRound !== Number(room.currentRound ?? 0)) {
        return null;
      }

      const lockedRoundDurationMs = roundDurationSecsForRoom({
        roomCode: code,
        gameMode: raw.game_mode ?? raw.gameMode,
        currentRound: lockedRound,
        currentLetter: lockedLetter,
      }) * 1000;
      const lockedMeta = (() => {
        try { return raw.stopper_json ? JSON.parse(raw.stopper_json) : (raw.stopperJson ? JSON.parse(raw.stopperJson) : {}); }
        catch { return {}; }
      })();
      const roundStartedAt = Number(lockedMeta?.roundStartedAt);
      if (options.triggerStop && lockedStatus === "playing" && Number.isFinite(roundStartedAt) && Date.now() >= roundStartedAt + lockedRoundDurationMs) {
        return null;
      }

      let committedStatus = lockedStatus as string;
      let committedStopperJson = raw.stopper_json ?? raw.stopperJson;
      if (options.triggerStop && lockedStatus === "playing") {
        const stopTimestamp = Date.now();
        let prevMeta: any = {};
        try { prevMeta = committedStopperJson ? JSON.parse(committedStopperJson) : {}; } catch {}
        committedStopperJson = JSON.stringify({
          ...prevMeta,
          stopper: { id: botPlayerId, name: lockedMe.playerName, stopTimestamp },
          stopTimestamp,
          roundStartedAt: prevMeta?.roundStartedAt ?? Date.now(),
        });
        committedStatus = "stopped";
      }

      const committedPlayers = lockedPlayers.map((p: any) => {
        if (p.playerId !== botPlayerId) return p;
        return {
          ...p,
          score: (p.score || 0) + roundScore,
          roundScore,
          isReady: true,
          answers,
          finishedAt,
          wasStopper: options.triggerStop && committedStatus === "stopped",
        };
      });

      let finalStatus = committedStatus;
      let finalRound = lockedRound;
      const finalLetter = lockedLetter;
      let finalStopperJson: string | null = committedStopperJson;
      let didFinishGame = false;

      const allReady = committedPlayers.every((p: any) => p.isReady);
      if (allReady) {
        const bluffers = committedPlayers.filter((p: any) => p.bluffedCategories?.length > 0);
        if (bluffers.length === 0) {
          finalRound = lockedRound + 1;
          if (finalRound > Number(raw.max_rounds ?? raw.maxRounds ?? 3)) {
            finalStatus = "finished";
            finalRound = Number(raw.max_rounds ?? raw.maxRounds ?? 3);
            didFinishGame = true;
          } else {
            finalStatus = "waiting";
          }
          finalStopperJson = null;
        }
      }

      const [updated] = await tx.update(roomsTable)
        .set({
          playersJson: JSON.stringify(committedPlayers),
          status: finalStatus,
          currentRound: finalRound,
          currentLetter: finalLetter,
          stopperJson: finalStopperJson,
          updatedAt: new Date(),
        })
        .where(eq(roomsTable.roomCode, code))
        .returning();

      return {
        row: updated,
        players: committedPlayers,
        letter: finalLetter,
        status: finalStatus,
        didFinishGame,
      };
    });

    if (!committed) return;

    const updateResult = [committed.row];
    deps.broadcast(code, deps.formatRoom(updateResult[0]));

    // Persist final scores to the global leaderboard when the bot's submit
    // was the one that ended the match — otherwise humans get no XP/ranking
    // update from games the bot "finished".
    if (committed.didFinishGame) {
      deps.submitFinalScores(committed.players, committed.letter, code, committed.row?.id);
      deps.clearRoundLiveResponses?.(code);
    }

    if (committed.status === "finished" || committed.status === "waiting") {
      clearBotTimers(code);
    }
  } catch (err) {
    // Swallow: bot is best-effort, must never crash the server.
    console.error(`[bot ${botPlayerId}] submit error:`, err);
  }
}

// A restarted/multi-instance API process must be able to reconstruct bot timers
// from the persisted room state. Each instance may race to schedule the same bot;
// performBotSubmit uses optimistic concurrency, so only one successful write wins.
let recoveryDeps: BotActionDeps | null = null;
let recoveryStarted = false;

export function startBotTimerRecovery(deps: BotActionDeps) {
  recoveryDeps = deps;
  if (recoveryStarted) return;
  recoveryStarted = true;

  const recover = async () => {
    if (!recoveryDeps) return;
    try {
      const rows = await db.select().from(roomsTable).where(sql`status IN ('playing', 'stopped')`);
      for (const room of rows) {
        let players: any[];
        try { players = JSON.parse(room.playersJson); } catch { continue; }
        const bots = players.filter((p: any) => p?.isBot && !p.isReady);
        if (bots.length === 0) continue;

        let meta: any = {};
        try { meta = room.stopperJson ? JSON.parse(room.stopperJson) : {}; } catch {}
        const isStopped = room.status === "stopped";
        const anchor = isStopped
          ? Number(meta?.stopTimestamp) || Date.now()
          : Number(meta?.roundStartedAt) || Date.now();
        const elapsed = Math.max(0, Date.now() - anchor);

        const scheduledBots = roomBotTimerBots.get(room.roomCode) ?? new Set<string>();
        for (const bot of bots) {
          if (scheduledBots.has(bot.playerId)) continue;
          const roundDurationMs = roundDurationSecsForRoom(room) * 1000;
          const maxPlayingDelay = Math.max(1_000, roundDurationMs - 2_000);
          const minPlayingDelay = Math.min(maxPlayingDelay, Math.max(1_000, roundDurationMs * 0.55));
          const plannedPlayingDelay = minPlayingDelay + (bot.playerId.charCodeAt(bot.playerId.length - 1) % Math.max(1, Math.floor(maxPlayingDelay - minPlayingDelay + 1)));
          const delay = isStopped
            ? Math.max(0, 1_500 + (bot.playerId.charCodeAt(bot.playerId.length - 1) % 2_500) - elapsed)
            : Math.max(0, plannedPlayingDelay - elapsed);
          const timer = setTimeout(() => {
            untrackTimer(room.roomCode, timer, bot.playerId);
            performBotSubmit(room.roomCode, bot.playerId, recoveryDeps!, { triggerStop: !isStopped });
          }, delay);
          trackTimer(room.roomCode, timer, bot.playerId);
        }
      }
    } catch (err) {
      console.error("[bot] timer recovery failed:", err);
    }
  };

  void recover();
  setInterval(() => { void recover(); }, 5_000);
}

// ── Public scheduler ──────────────────────────────────────────────────────
// Called by rooms.ts whenever the room transitions into "playing". For
// every bot in the room we schedule a randomized STOP + submit between
// 25-50s into the round. If a human calls STOP first, `rushBotSubmits`
// fires the bot's submission within 2-4s instead.
export function scheduleBotsForRound(opts: {
  roomCode: string;
  bots: { playerId: string }[];
  letter: string;
  categories: string[];
  deps: BotActionDeps;
  round: number;
  roundDurationMs: number;
}) {
  clearBotTimers(opts.roomCode);
  // Wipe any leftover LLM answers from a previous round so a late-resolving
  // promise from round N-1 can't be served in round N. The round+letter
  // tag on each pending entry is a second line of defence inside
  // getPendingAnswers.
  clearPendingAnswers(opts.roomCode);
  // 🧠 Fire LLM generation in the background per bot at round start. Each
  // bot gets a DIFFERENT result because gpt-5-mini varies with temperature
  // (no caching), so the table doesn't see identical answers. If the LLM
  // call doesn't return by the time the bot acts, performBotSubmit falls
  // back to the static word bank.
  const round = opts.round;
  const letter = opts.letter;
  for (const b of opts.bots) {
    generateBotAnswersLLM(letter, opts.categories)
      .then(answers => {
        if (answers) setPendingAnswers(opts.roomCode, b.playerId, { round, letter, answers });
      })
      .catch(() => {});
  }
  const durationMs = opts.roundDurationMs;
  const maxDelayMs = Math.max(1_000, durationMs - 2_000);
  const minDelayMs = Math.min(maxDelayMs, Math.max(1_000, durationMs * 0.55));
  for (const b of opts.bots) {
    const delay = minDelayMs + Math.random() * Math.max(0, maxDelayMs - minDelayMs);
    const t = setTimeout(() => {
      untrackTimer(opts.roomCode, t, b.playerId);
      performBotSubmit(opts.roomCode, b.playerId, opts.deps, { triggerStop: true });
    }, delay);
    trackTimer(opts.roomCode, t, b.playerId);
  }
}

// Called when a human triggers STOP — bots that haven't submitted yet
// rush their submission so the round can advance.
export function rushBotSubmits(opts: {
  roomCode: string;
  bots: { playerId: string }[];
  deps: BotActionDeps;
}) {
  clearBotTimers(opts.roomCode);
  for (const b of opts.bots) {
    const delay = 1_500 + Math.random() * 2_500; // 1.5-4s, mimics real player freeze
    const t = setTimeout(() => {
      untrackTimer(opts.roomCode, t, b.playerId);
      performBotSubmit(opts.roomCode, b.playerId, opts.deps, { triggerStop: false });
    }, delay);
    trackTimer(opts.roomCode, t, b.playerId);
  }
}
