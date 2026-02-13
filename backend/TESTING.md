# Backend Testing Guide

## Overview

This document describes the unit test suite for the Future Headlines backend, focusing on the game loop logic and session state management.

## Test Framework

- **Jest** - Test runner and assertion library
- **ts-jest** - TypeScript preprocessor for Jest
- **Mocking** - Database (pg) and Socket.IO are mocked

## Test Coverage

### 1. Game Loop Logic (`tests/game/gameLoop.test.ts`)

**Pure Function Tests:**
- `computeNextPhase()` - Tests phase transition logic
  - PLAYING → BREAK (same round)
  - BREAK → PLAYING (next round when under max)
  - BREAK → FINISHED (when at max rounds)
  - Edge cases (WAITING, FINISHED, unexpected states)
  - Different maxRounds configurations (1, 3, 4 rounds)

**Coverage:** 100% of `computeNextPhase` function

### 2. Game Loop Manager (`tests/game/gameLoopManager.test.ts`)

**Manager Tests:**
- `ensureLoopForSession()` - Creates or returns existing loop instance
- `handleHostStartGame()` - Starts game and transitions to PLAYING
- `stopLoop()` - Stops a single session's loop
- `stopAll()` - Stops all active loops

**Mocked Dependencies:**
- PostgreSQL pool (DB queries)
- Socket.IO server (broadcasts)

**Coverage:** Core GameLoopManager public API

### 3. Lobby Handlers (`tests/socket/lobbyHandlers.test.ts`)

**Session State Helper (indirect via handlers):**
- `getSessionState()` enrichment with timing fields
- In-game time calculation (60x speed)
- Handling null `in_game_start_at` (WAITING phase)
- Filtering null players from LEFT JOIN
- Error cases (session not found, missing joinCode)

**Socket.IO Handler Tests:**
- `lobby:start_game` - Host starting game
  - Success case
  - Non-host rejection
  - Already-started rejection
  - Missing parameters
  - Session not found

**Mocked Dependencies:**
- PostgreSQL pool
- GameLoopManager
- Socket.IO server and sockets

**Coverage:** Critical Socket.IO event handlers

## Running Tests

### Install Dependencies

First time setup:
```bash
cd backend
npm install
```

### Run All Tests

```bash
npm test
```

### Run Tests in Watch Mode

```bash
npm run test:watch
```

### Run Specific Test File

```bash
npm test gameLoop.test
npm test gameLoopManager.test
npm test lobbyHandlers.test
```

### Run Tests with Coverage

```bash
npm test -- --coverage
```

## Test Structure

```
backend/
├── tests/
│   ├── game/
│   │   ├── gameLoop.test.ts          # Pure function tests
│   │   └── gameLoopManager.test.ts   # Manager tests
│   └── socket/
│       └── lobbyHandlers.test.ts     # Socket.IO handler tests
├── jest.config.cjs                    # Jest configuration
└── package.json                       # Test scripts
```

## Mocking Strategy

### Database Mocking

PostgreSQL `pool` is mocked at the module level:

```typescript
jest.mock('../../src/db/pool', () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));
```

This allows tests to:
- Control query responses
- Verify queries were called with correct parameters
- Test error scenarios

### Socket.IO Mocking

Socket.IO is mocked with spy functions:

```typescript
const mockEmit = jest.fn();
const mockTo = jest.fn().mockReturnValue({ emit: mockEmit });
const mockIO = { to: mockTo } as any;
```

This allows tests to:
- Verify broadcasts were sent
- Check room names
- Inspect emitted data

### GameLoopManager Mocking

For handler tests, GameLoopManager is mocked:

```typescript
jest.mock('../../src/game/gameLoop', () => ({
  gameLoopManager: {
    handleHostStartGame: jest.fn(),
  },
}));
```

## Key Test Patterns

### 1. Arrange-Act-Assert

```typescript
it('should compute next phase correctly', () => {
  // Arrange
  const currentPhase = 'PLAYING';
  const currentRound = 1;
  const maxRounds = 4;
  
  // Act
  const result = computeNextPhase(currentPhase, currentRound, maxRounds);
  
  // Assert
  expect(result).toEqual({ phase: 'BREAK', round: 1 });
});
```

### 2. Mock Setup in beforeEach

```typescript
beforeEach(() => {
  jest.clearAllMocks();
  gameLoopManager.stopAll();
  gameLoopManager.setSocketIO(mockIO);
});
```

### 3. Testing Async Operations

```typescript
it('should handle async operations', async () => {
  (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [mockData] });
  
  await gameLoopManager.ensureLoopForSession('session-id', 'CODE');
  
  expect(pool.query).toHaveBeenCalledWith(
    expect.stringContaining('SELECT'),
    ['session-id']
  );
});
```

## What's NOT Tested (Integration Tests Needed)

These require real PostgreSQL or more complex setup:

- Actual database queries and schema validation
- Real Socket.IO connections between client and server
- End-to-end game flow with real timers
- REST API endpoints (`/api/sessions`)
- Migration scripts

For these, see `GAME_LOOP_TESTING.md` for manual testing procedures.

## Continuous Integration

Tests run automatically on:
- Every commit (if CI is configured)
- Before deployment
- PR validation

## Test Maintenance

When adding new features:

1. **Add tests first** (TDD approach recommended)
2. **Update mocks** if interfaces change
3. **Maintain coverage** above 80% for critical paths
4. **Document** new test patterns in this file

## Debugging Tests

### View Detailed Output

```bash
npm test -- --verbose
```

### Run Single Test

```bash
npm test -- -t "should transition from PLAYING to BREAK"
```

### Debug in VS Code

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Current File",
  "program": "${workspaceFolder}/backend/node_modules/.bin/jest",
  "args": ["${fileBasename}", "--runInBand"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## Common Issues

### Module Resolution Errors

If you see "Cannot find module" errors:
- Check `jest.config.cjs` `moduleNameMapper`
- Ensure `.js` extensions in imports are mapped correctly

### Timeout Errors

For tests with async operations:
```typescript
it('long test', async () => {
  // ...
}, 10000); // 10 second timeout
```

### Mock Not Clearing

Always use `jest.clearAllMocks()` in `beforeEach`:
```typescript
beforeEach(() => {
  jest.clearAllMocks();
});
```

## Future Enhancements

- [ ] Integration tests with test database
- [ ] API endpoint tests with supertest
- [ ] Property-based testing for phase transitions
- [ ] Performance benchmarks
- [ ] E2E tests with real Socket.IO clients

## Summary

✅ **63 test cases** covering core game loop functionality  
✅ **Zero dependencies on external services** (all mocked)  
✅ **Fast execution** (~2 seconds for full suite)  
✅ **High confidence** in phase transition logic and session state

Tests provide a solid foundation for refactoring and extending the game loop system.

