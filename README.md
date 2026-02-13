# Future Headlines Game

A multiplayer web-based game where players submit "headlines from the future" evaluated by AI for plausibility. Features real-time gameplay with phase management, scoring, and planet-based bonuses.

## Features

- **Lobby System**: Host creates sessions with unique join codes, players join with nicknames
- **Real-Time Updates**: Socket.IO broadcasts keep all players synchronized
- **Game Loop**: Configurable rounds with PLAYING and BREAK phases
- **Headline Submission**: Players submit story directions, transformed by AI into headlines
- **AI Evaluation**: LLM Juror assesses plausibility and thematic connections
- **Scoring System**: Points for plausibility, story connections, and planet bonuses
- **Priority Planets**: Each player has a priority planet displayed during gameplay for bonus scoring
- **Score Display**: Personal score shown next to game status, all player scores visible in player list
- **Leaderboard**: Real-time score tracking and rankings via `leaderboard:update` events

## Prerequisites

- Node.js (v18 or later)
- PostgreSQL (v14 or later)
- npm or yarn

## Setup Instructions

### 1. Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Database Setup

**Option A: Using the setup script (recommended)**

```bash
./backend/setup-db.sh
```

Then create `backend/.env` with your database credentials:

```
DATABASE_URL=postgresql://postgres:password@localhost:5432/future_headlines
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
```

Run migrations:

```bash
cd backend
npm run migrate
```

**Option B: Manual setup**

Create a PostgreSQL database:

```bash
createdb future_headlines
```

Create `backend/.env` (see above), then run migrations:

```bash
cd backend
npm run migrate
```

### 3. Run the Application

Start the backend server:

```bash
cd backend
npm run dev
```

In a separate terminal, start the frontend:

```bash
cd frontend
npm run dev
```

The frontend will be available at `http://localhost:5173`  
The backend API will be available at `http://localhost:3001`

## Project Structure

```
FYP/
├── backend/          # Node.js + Express + Socket.IO server
│   ├── src/
│   │   ├── server.ts
│   │   ├── routes/
│   │   ├── socket/
│   │   ├── db/
│   │   └── utils/
│   └── db/
│       └── migrations/
├── frontend/         # React + TypeScript + Vite app
│   └── src/
│       ├── App.tsx
│       ├── components/
│       └── hooks/
└── README.md
```

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Socket.IO Client, Tailwind CSS
- **Backend**: Node.js, TypeScript, Express, Socket.IO, node-postgres
- **Database**: PostgreSQL

## Development

- Backend runs on port 3001
- Frontend runs on port 5173 (Vite default)
- Hot reload enabled for both frontend and backend

## Testing

### End-to-End Testing

**Prerequisites:** Ensure PostgreSQL is running and migrations have been applied.

#### Test 1: Basic Session Creation and Join

1. Start the backend server:
   ```bash
   cd backend && npm run dev
   ```

2. In a new terminal, start the frontend:
   ```bash
   cd frontend && npm run dev
   ```

3. Open `http://localhost:5173` in your browser (Host)
4. Enter a nickname (e.g., "Alice") and click "Create New Session"
5. Note the 6-character join code displayed
6. Open `http://localhost:5173` in another browser window/tab (Player 1)
7. Enter a nickname (e.g., "Bob") and the join code, click "Join Session"
8. Verify both players appear in the player list on both screens
9. Open a third browser window/tab and join as another player (e.g., "Charlie")
10. Verify all three players appear in real-time on all screens

**Expected Results:**
- ✅ Host successfully creates a session
- ✅ Players can join using the code
- ✅ All players see live updates when someone joins
- ✅ Player list shows correct nicknames and host status

#### Test 2: Edge Cases

**Duplicate Nicknames:**
1. Try to join with a nickname that's already taken in the session
2. Expected: Error message "Nickname already taken"

**Invalid Join Code:**
1. Try to join with a non-existent code (e.g., "ZZZZZZ")
2. Expected: Error message "Session not found"

**Reconnection:**
1. Join a session as a player
2. Refresh the browser
3. Expected: Player automatically rejoins the same session (data persists in localStorage)

**Host Controls:**
1. As the host, click "Start Game" with only 1 player
2. Expected: Button is disabled (need 2+ players)
3. Join with a second player
4. Click "Start Game" as the host
5. Expected: Session status changes to "PLAYING"

#### Test 3: Real-Time Updates

1. Have host and 2+ players in a lobby
2. Have a new player join
3. Expected: All existing participants see the new player appear instantly
4. Test Socket.IO connection indicator shows "Connected" in green

#### Test 4: Data Persistence

1. Create a session and note the join code
2. Stop and restart the backend server
3. Try to fetch session data: `curl http://localhost:3001/api/sessions/JOINCODE`
4. Expected: Session and player data persists in PostgreSQL

### API Testing

You can also test the REST API directly:

```bash
# Create a session
curl -X POST http://localhost:3001/api/sessions \
  -H "Content-Type: application/json" \
  -d '{"hostNickname":"TestHost"}'

# Join a session (replace CODE with actual join code)
curl -X POST http://localhost:3001/api/sessions/CODE/join \
  -H "Content-Type: application/json" \
  -d '{"nickname":"TestPlayer"}'

# Get session details
curl http://localhost:3001/api/sessions/CODE

# Health check
curl http://localhost:3001/health
```

## Implemented Features

All core features are now complete:
- ✅ Game timing and rounds (WAITING → PLAYING → BREAK → FINISHED)
- ✅ Headline submission with rate limiting
- ✅ AI evaluation via LLM Juror
- ✅ Dice mechanics for plausibility band selection
- ✅ Scoring system (baseline, plausibility, connections, planet bonus)
- ✅ Planet tally system with priority display
- ✅ Real-time leaderboard updates
- ✅ Score display (PersonalScore component, PlayerList scores)

## Next Steps

- Break phase summaries
- Deployment configuration

