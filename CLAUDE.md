# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Future Headlines Game - A multiplayer web-based game where players submit "headlines from the future" evaluated by AI for plausibility. Features a real-time lobby system, game loop with phase management, headline submission, and scoring infrastructure.

## Tech Stack

- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS, Socket.IO Client
- **Backend:** Node.js + Express + TypeScript, Socket.IO, PostgreSQL (node-postgres), Zod validation
- **Testing:** Jest with ts-jest

## Common Commands

### Backend (from `backend/` directory)

```bash
npm run dev          # Start dev server with hot reload on :3001
npm run build        # TypeScript compilation to dist/
npm test             # Run all Jest tests
npm run test:watch   # Watch mode for tests
npm run migrate      # Run pending database migrations
npm run lint         # ESLint check
npm run format       # Prettier format
```

### Frontend (from `frontend/` directory)

```bash
npm run dev          # Vite dev server on :5173 (proxies to backend)
npm run build        # TypeScript check + Vite bundle
npm run lint         # ESLint check
npm run format       # Prettier format
```

### Database Setup

```bash
./backend/setup-db.sh                    # Create PostgreSQL database
# Create backend/.env with DATABASE_URL=postgresql://postgres:password@localhost:5432/future_headlines
cd backend && npm run migrate            # Apply migrations
```

## Architecture

### Real-Time Communication (Socket.IO)

Room-per-session model using `session:${joinCode}`. Key events:
- `lobby:join` / `lobby:get_state` / `lobby:start_game` - Lobby management
- `lobby:player_joined` - Broadcast on player join
- `game:state` - Phase/timing updates broadcast to all clients (includes player scores)
- `headline:submit` / `headline:submitted` - Headline submission flow
- `leaderboard:update` - Real-time score updates after headline scoring

The `useSocket.ts` hook manages Socket.IO lifecycle on the frontend.

### Game Loop Manager

Singleton at `backend/src/game/gameLoop.ts` with per-session `GameLoopInstance`. State machine: WAITING → PLAYING → BREAK → PLAYING → ... → FINISHED. Timers are in-memory (not persisted across restarts). Syncs to DB on transitions and broadcasts `game:state`.

### Scoring Engine

Modular design in `backend/src/game/`:
- `scoring.ts` - Core scoring logic
- `scoringService.ts` - Database queries
- `planetWeighting.ts` - Planet tally system with priority selection

Multi-component scoring: Baseline, Plausibility (LLM-assessed), Story Connection, Planet Bonus.

### Priority Planet System

Each player has a "priority planet" displayed during gameplay. When the AI's headline evaluation includes the player's priority planet in the top-3, they receive a +3 bonus. The priority is:
- Initialized randomly when the game starts
- Updated after each headline submission based on frequency tally
- Displayed in the `GameStatus` component during PLAYING/BREAK phases
- Included in `game:state` broadcasts via `players[].priorityPlanet`

### Score Display System

Player scores are displayed in two places on the frontend:
- **PersonalScore component**: Shows current player's total score in top-right area next to GameStatus during PLAYING/BREAK phases
- **PlayerList component**: Shows score for each player (e.g., "42 pts") next to their name

Score updates flow through two channels:
- `game:state` - Provides scores on initial join and phase transitions
- `leaderboard:update` - Real-time updates after each headline is scored

### Database Migrations

SQL files in `backend/db/migrations/` tracked in `schema_migrations` table:
1. `001_init.sql` - Sessions and players
2. `002_game_timing.sql` - Phase management
3. `003_headlines.sql` - Headline submissions
4. `004_scoring.sql` - Scoring system

### Session Persistence

LocalStorage stores `futureHeadlines_session` with joinCode, playerId, isHost. Auto-rejoins on page refresh via `lobby:join` event.

## Key Flows

**Create Game:** POST `/api/sessions` → returns joinCode → Socket.IO `lobby:join`

**Join Game:** POST `/api/sessions/{joinCode}/join` → Socket.IO `lobby:join` → broadcasts `lobby:player_joined`

**Start Game:** Host emits `lobby:start_game` → GameLoopManager starts timers → broadcasts `game:state`

**Submit Headline:** Emit `headline:submit` → rate-limited (60s) → stored in DB → broadcasts `headline:submitted`

## Environment Variables

**Backend (.env):**
```
DATABASE_URL=postgresql://postgres:password@localhost:5432/future_headlines
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

## Testing

Backend tests are in `backend/tests/` with Jest. Tests mock pg pool and Socket.IO - no database required. Run with `npm test` from backend directory.
