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
import { eq, and } from "drizzle-orm";

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

function trackTimer(code: string, t: NodeJS.Timeout) {
  let set = roomBotTimers.get(code);
  if (!set) { set = new Set(); roomBotTimers.set(code, set); }
  set.add(t);
}

export function clearBotTimers(code: string) {
  const set = roomBotTimers.get(code);
  if (!set) return;
  for (const t of set) clearTimeout(t);
  roomBotTimers.delete(code);
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
  submitFinalScores: (players: any[], letter: string) => void | Promise<void>;
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

    // Compose bot answers — use real category names from the latest human
    // submission if available, otherwise generic cat_0..N keys (which the
    // client doesn't show but the server score is still correct).
    const letter = (room.currentLetter ?? "A").toUpperCase();
    const sampleCats = (() => {
      const human = players.find(p => !p.isBot && p.answers && typeof p.answers === "object");
      if (human?.answers) return Object.keys(human.answers);
      return ["cat_0","cat_1","cat_2","cat_3","cat_4","cat_5","cat_6"];
    })();
    const words = pickWordsForRound(letter, sampleCats.length);
    const answers: Record<string, string> = {};
    words.forEach((w, i) => { if (sampleCats[i]) answers[sampleCats[i]] = w; });
    // 🛡️ Mirror server scoring rules (unique per-letter only). Dedupes any
    // accidental duplicates in the bank so the bot can never out-score itself
    // by saying the same word twice.
    const normLetter = letter.toLowerCase();
    const seen = new Set<string>();
    let validBotWords = 0;
    for (const w of Object.values(answers)) {
      const norm = w.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (norm.length >= 2 && norm.startsWith(normLetter) && !seen.has(norm)) {
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
          performBotSubmit(code, botPlayerId, deps, { ...options, attempt: 1 });
        }, 200 + Math.random() * 300);
        trackTimer(code, retry);
      }
      return;
    }

    deps.broadcast(code, deps.formatRoom(updateResult[0]));

    // Persist final scores to the global leaderboard when the bot's submit
    // was the one that ended the match — otherwise humans get no XP/ranking
    // update from games the bot "finished".
    if (didFinishGame) {
      deps.submitFinalScores(updatedPlayers, room.currentLetter ?? "A");
    }

    if (nextStatus === "finished" || nextStatus === "waiting") {
      clearBotTimers(code);
    }
  } catch (err) {
    // Swallow: bot is best-effort, must never crash the server.
    console.error(`[bot ${botPlayerId}] submit error:`, err);
  }
}

// ── Public scheduler ──────────────────────────────────────────────────────
// Called by rooms.ts whenever the room transitions into "playing". For
// every bot in the room we schedule a randomized STOP + submit between
// 25-50s into the round. If a human calls STOP first, `rushBotSubmits`
// fires the bot's submission within 2-4s instead.
export function scheduleBotsForRound(opts: {
  roomCode: string;
  bots: { playerId: string }[];
  deps: BotActionDeps;
}) {
  clearBotTimers(opts.roomCode);
  for (const b of opts.bots) {
    const delay = 25_000 + Math.random() * 25_000; // 25-50s
    const t = setTimeout(() => {
      performBotSubmit(opts.roomCode, b.playerId, opts.deps, { triggerStop: true });
    }, delay);
    trackTimer(opts.roomCode, t);
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
      performBotSubmit(opts.roomCode, b.playerId, opts.deps, { triggerStop: false });
    }, delay);
    trackTimer(opts.roomCode, t);
  }
}
