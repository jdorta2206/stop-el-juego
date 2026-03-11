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
5. **Premium Modal**: PRO subscription flow (UI only, "Próximamente")

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
- `GET /api/ranking/scores` — Get global leaderboard
- `POST /api/ranking/scores` — Submit score after game
- `GET /api/ranking/scores/:playerId` — Get player stats
- `POST /api/rooms` — Create multiplayer room
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
