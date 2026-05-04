# STOP - El Juego

## Overview

Full-stack STOP game (Tutti Frutti / Scattergories) web app built with React + Vite frontend and Express backend.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/stop-game)
- **API framework**: Express 5 (artifacts/api-server)
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Animations**: Framer Motion
- **Icons**: Lucide React
- **Build**: esbuild (CJS bundle)

## Game Features

1. **Solo vs IA**: Play against AI with animated roulette wheel, 7 categories, 60s timer, word validation
2. **Multiplayer**: Create/join rooms with 6-char code, share via WhatsApp/Instagram/Facebook
3. **Ranking**: Global leaderboard with player scores, wins, games played
4. **Player Profile**: Nickname + avatar color stored in localStorage
5. **Premium Subscription**: Full Stripe integration — €1.99/month or €14.99/year; no-ads tier; checkout via Stripe hosted page; subscription management via Stripe Customer Portal; webhook syncs subscription state to PostgreSQL via `stripe-replit-sync`
6. **AI Personalities**: 4 unique AI characters (ARIA 🤖, CHIP 😄, NEO 🧠, ZEUS ⚡) with speech bubbles in 4 languages
7. **Achievements**: 8 unlockable achievements tracked via localStorage with animated toast notifications
8. **League System**: Bronze→Silver→Gold→Diamond→Master progression with XP
9. **Chaos Mode**: All crazy categories, 45s timer, guaranteed 2×XP
10. **Cartas de Poder**: 6 power cards (Oracle🔮, Sabotaje❌, Doble-o-Nada🎯, Tránsfuga🔄, Rayo⚡, Escudo🛡️) drawn per round with dramatic card flip reveal animation
11. **Mentir es Válido**: Social deception mechanic — players can bluff up to 2 answers per round; AI has 50% detection rate; AI also bluffs 1 answer per round; player judges AI's answer; bonus/penalty scoring system; full "EL JUICIO" reveal screen with animated sequence
12. **Compartir resultado Multiplayer** (T001): ShareResultsModal extended with multiplayer scoreboard view; Wordle-like share text with rank, score, and player table
13. **Emoji Reactions Multiplayer** (T002): POST /api/rooms/:code/react endpoint; floating animated reaction overlay during play; 8-emoji bar above STOP button; in-memory store (ephemeral)
14. **Category Pack Selection** (T003): Host picks Clásicas/Locas/Mixtas in lobby; seeded deterministic category selection per round; POST /api/rooms/:code/category-pack endpoint
15. **Cartas de Poder Multiplayer** (T004): Random power card assigned to each player at game start; cards: ⚡Rayo (+15s), 🛡️Escudo (bluff immunity), ❌Sabotaje/🔄Hurto (steal 10pts from leader), 🎯Doble-o-Nada (×2 score); POST /api/rooms/:code/use-card endpoint with server-side effect resolution
16. **Modo Torneo** (T005): New `tournamentsTable` in DB; bracket system for 4 or 8 players; POST/GET/join/start/start-match/match-result API routes; Tournament.tsx page with full bracket UI; room auto-created for each match; bracket advances automatically on match completion; champion crown revealed at the end

## Game Categories (Spanish)

Nombre, Lugar, Animal, Objeto, Color, Fruta, Marca

## Color Palette (Original STOP colors)

- Background: bright red (hsl 6 90% 55%)
- Primary buttons: dark navy blue (hsl 222 47% 11%)
- Secondary/accents: yellow (hsl 48 96% 57%)
- Text: white on backgrounds

## Structure

```text
artifacts/
├── stop-game/          # React + Vite frontend (port assigned automatically)
│   ├── src/
│   │   ├── pages/      # Home, SoloGame, Multiplayer, Room, Ranking
│   │   ├── components/ # Layout, Roulette, ui.tsx (custom components)
│   │   ├── hooks/      # use-player.ts (localStorage player profile)
│   │   └── lib/        # utils.ts (categories, alphabet, helpers)
│   └── public/         # Static assets
└── api-server/         # Express API server
    └── src/routes/     # health, game, ranking, rooms

lib/
├── api-spec/           # OpenAPI spec + Orval codegen config
├── api-client-react/   # Generated React Query hooks
├── api-zod/            # Generated Zod schemas
└── db/
    └── src/schema/     # players.ts (playerScoresTable, gameHistoryTable, roomsTable)
```

## API Routes

- `POST /api/game/validate` — Validate player words vs AI (dictionary-based)
- `GET /api/ranking/scores` — Get global leaderboard (includes `currentStreak`, `longestStreak`, `title`)
- `POST /api/ranking/scores` — Submit score after game (calculates daily streak, 1.5x if mode=multiplayer)
- `GET /api/ranking/scores/:playerId` — Get player stats
- `GET /api/ranking/weekly` — Weekly leaderboard
- `GET /api/ranking/monthly` — Monthly leaderboard
- `GET /api/ranking/profile/:playerId` — Full player profile (streak, title, modeStats, globalRank, monthlyScore)
- `POST /api/rooms` — Create multiplayer room (accepts `gameMode`, `maxPlayers`)
- `GET /api/rooms/:roomCode` — Get room details (polling for multiplayer)
- `POST /api/rooms/:roomCode/join` — Join room
- `POST /api/rooms/:roomCode/results` — Submit round results
- `POST /api/rooms/:roomCode/start` — Host starts game

## Word Validation Logic

The server-side validator in `artifacts/api-server/src/routes/game.ts` uses a comprehensive Spanish dictionary with ~100+ words per category. Scoring: 10pts if unique answer, 5pts if same answer as AI, 0pts if wrong/invalid.

## Database Tables

- `player_scores` — Player rankings (playerId unique, totalScore, gamesPlayed, wins)
- `game_history` — Individual game results per player
- `rooms` — Multiplayer rooms with JSON-stored player list

## Root Scripts

- `pnpm run build` — runs typecheck, then builds all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`

## Codegen

- `pnpm --filter @workspace/api-spec run codegen` — regenerates hooks/schemas from openapi.yaml
- `pnpm --filter @workspace/db run push` — pushes schema changes to database

## Hardening for 100k Concurrent Players (May 2026)

Server hardening pass to support best-in-class multiplayer reliability:

- **Server-authoritative scoring**: `/results` ignores `roundScore` from the client and recomputes via `calcServerScore`. Caps valid answers at 8 (largest pack across ES/EN/PT/FR) to defend against category-key injection. Stopper +5 bonus only when `validCount >= 7` (real standard pack size).
- **Atomic leaderboard**: `submitAllScoresToLeaderboard` uses `sql\`col + N\`` increments and `INSERT … ON CONFLICT DO UPDATE` (no read-modify-write race).
- **Atomic /start**: update guarded by `status='waiting'`. Parallel calls from the same host return identical letter/deadline. `/start` rejects "playing"/"stopped" (echoes state) and `409`s on "finished".
- **Authorization**: `/start` requires matching `hostId`. `/stop` requires `playerId` ∈ room members. SSE `/events` 404s on unknown rooms, 403s on private rooms without member, and caps to 200 subscribers per room.
- **Deadline-based timer (client)**: `serverNow` + `roundEndsAt` returned in every room payload. `Room.tsx` startRoundTimer captures clock-skew once at setup, reads `roundEndsAt` from `roomRef` each tick → smooth 4Hz countdown that adapts to deadline updates without re-creating the interval.
- **Freeze race fix**: `handleStop` only calls `stopAllTimers + setPhase("freeze") + startFreezeCountdown` if `!isFreezingRef.current`, preventing the polling effect from clearing the freeze interval (was stalling at "3").
- **Other**: rate limits per route (general/write/score/presence/auth), Postgres pool max 50, idempotent `ensureIndexes()` on boot, distributed cron lock, body size caps, trust proxy, JSON error handler.

Known scaling caveat: per-room ephemeral state (SSE clients, typing presence, spy budget, reactions, phrases, fun votes, category packs, rematch links) lives in process memory. Multi-instance horizontal scaling will require Redis (or sticky-by-room routing) before exceeding a single Node process.
