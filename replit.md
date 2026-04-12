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
