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
// Tagged with round+letter AND a per-room generation token. Round numbers reset
// on rematch, so round+letter alone cannot prevent a late LLM promise from an
// old match from populating the new match's pending answers.
type PendingEntry = { round: number; letter: string; generation: number; answers: Record<string, string> };
const botAnswerGeneration = new Map<string, number>();
function nextAnswerGeneration(code: string): number {
  const generation = (botAnswerGeneration.get(code) ?? 0) + 1;
  botAnswerGeneration.set(code, generation);
  return generation;
}
function isCurrentAnswerGeneration(code: string, generation: number): boolean {
  return botAnswerGeneration.get(code) === generation;
}
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
  if (!isCurrentAnswerGeneration(code, e.generation)) return null;
  return e.answers;
}
function clearPendingAnswers(code: string) {
  botPendingAnswers.delete(code);
  botAnswerGeneration.delete(code);
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
  onRoundAdvanced: (room: any, players: any[], newStatus: string) => void;
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
    const seen = new Set<string>();
    let validBotWords = 0;
    for (const category of sampleCats) {
      const w = answers[category];
      if (typeof w !== "string" || !w.trim()) continue;
      const norm = w.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (seen.has(norm)) continue;
      const valid = await isWordValidAsync(
        w, letter, category, room.language ?? "es", botPlayerId,
      );
      if (valid) {
        seen.add(norm);
        validBotWords++;
      }
    }
    const roundScore = validBotWords * 10;

    const finishedAt = Date.now();
    const updatedPlayers = players.map(p => {
      if (p.playerId !== botPlayerId) return p;
      return {
        ...p,
        score: (p.score || 0) + roundScore,
        roundScore,
        isReady: true,
        answers,
        finishedAt,
        wasStopper: options.triggerStop && newStatus === "stopped",
      };
    });

    // Bot never bluffs, so if its submission completes the round and there
    // are no human bluffers we can advance directly; otherwise just save and
    // let the human /results handler decide the next status.
    let nextStatus = newStatus;
    let nextRound = room.currentRound;
    let nextLetter = room.currentLetter;
    let nextStopperJson: string | null = newStopperJson;

    let didFinishGame = false;
    const allReady = updatedPlayers.every(p => p.isReady);
    if (allReady) {
      const bluffers = updatedPlayers.filter(p => p.bluffedCategories?.length > 0);
      if (bluffers.length === 0) {
        // Advance — mirror the rooms.ts /results advancement.
        nextRound = (room.currentRound ?? 0) + 1;
        if (nextRound > (room.maxRounds ?? 3)) {
          nextStatus = "finished";
          nextRound = room.maxRounds ?? 3;
          didFinishGame = true;
        } else {
          nextStatus = "waiting";
          // Letter will be re-rolled when host starts next round; clear meta.
        }
        nextStopperJson = null;
      }
    }

    const updateResult = await db.update(roomsTable)
      .set({
        playersJson: JSON.stringify(updatedPlayers),
        status: nextStatus,
        currentRound: nextRound,
        currentLetter: nextLetter,
        stopperJson: nextStopperJson,
        updatedAt: new Date(),
      })
      .where(and(eq(roomsTable.roomCode, code), eq(roomsTable.updatedAt, room.updatedAt)))
      .returning();

    if (updateResult.length === 0) {
      // Lost optimistic-concurrency race against a human submit. Retry once
      // so the bot's points aren't silently dropped just because a human
      // submitted at the same instant. Bail after 1 retry — repeated races
      // mean the round is being driven by humans and they'll zero the bot
      // via the stuck-sweep, which is fine.
      if (attempt === 0) {
        // Track the retry timer so clearBotTimers() can cancel it if the
        // room dies or the round advances before the retry fires.
        const retry = setTimeout(() => {
          untrackTimer(code, retry, botPlayerId);
          performBotSubmit(code, botPlayerId, deps, { ...options, attempt: 1 });
        }, 200 + Math.random() * 300);
        trackTimer(code, retry, botPlayerId);
      }
      return;
    }

    deps.broadcast(code, deps.formatRoom(updateResult[0]));

    // Persist final scores to the global leaderboard when the bot's submit
    // was the one that ended the match — otherwise humans get no XP/ranking
    // update from games the bot "finished".
    if (nextStatus === "finished" || nextStatus === "waiting") {
      deps.onRoundAdvanced(room, updatedPlayers, nextStatus);
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
          const delay = isStopped
            ? Math.max(0, 1_500 + (bot.playerId.charCodeAt(bot.playerId.length - 1) % 2_500) - elapsed)
            : Math.max(0, 25_000 + (bot.playerId.charCodeAt(bot.playerId.length - 1) % 26_000) - elapsed);
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
}) {
  clearBotTimers(opts.roomCode);
  // Wipe any leftover LLM answers from a previous round so a late-resolving
  // promise from round N-1 can't be served in round N. The round+letter
  // tag on each pending entry is a second line of defence inside
  // getPendingAnswers.
  clearPendingAnswers(opts.roomCode);
  const answerGeneration = nextAnswerGeneration(opts.roomCode);
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
        if (answers && isCurrentAnswerGeneration(opts.roomCode, answerGeneration)) {
          setPendingAnswers(opts.roomCode, b.playerId, { round, letter, generation: answerGeneration, answers });
        }
      })
      .catch(() => {});
  }
  for (const b of opts.bots) {
    const delay = 25_000 + Math.random() * 25_000; // 25-50s
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
