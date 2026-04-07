import { Server, Socket } from 'socket.io';
import pool from '../db/pool.js';
import { gameLoopManager } from '../game/gameLoop.js';
import { submitHeadlineSchema } from '../utils/validation.js';
import { ZodError } from 'zod';
import { transformHeadline, LinkedHeadline } from '../game/headlineTransformationService.js';
import { getDefaultPlanets } from '../game/planets.js';
import { HeadlineEntry } from '../llm/jurorPrompt.js';
import { applyHeadlineEvaluation, getPlayerScoreBreakdowns } from '../game/scoringService.js';
import { PlausibilityLevel, DEFAULT_PLANETS } from '../game/scoringTypes.js';
import { migratePlanetState, initialPlanetTallyState, selectPriorityPlanet } from '../game/planetWeighting.js';
import { getRoundSummary, getSessionIdFromJoinCode } from '../game/summaryService.js';


// Rate limiting: track last submission time per player
// Key: `${sessionId}:${playerId}`, Value: timestamp in ms
const lastHeadlineSubmission: Map<string, number> = new Map();

// In test mode (GAME_TEST_MODE=true), the cooldown is scaled to ~6s
// to match the compressed game timing in gameLoop.ts.
const TEST_MODE = process.env.GAME_TEST_MODE === 'true';
const HEADLINE_COOLDOWN_MS = TEST_MODE ? Math.round(90_000 / 16) : 90_000; // ~6s test, 90s normal

/**
 * Count unique other authors from STRONG linked headlines using DB lookup.
 *
 * Looks at only STRONG connections, finds who wrote each linked headline,
 * and counts how many distinct other players (not the submitter) are represented.
 *
 * @param linkedHeadlines - Array of linked headlines from LLM
 * @param sessionId - Session ID to query DB for headline owners
 * @param currentPlayerId - The player who submitted the headline
 * @returns Number of unique other authors (0-3)
 */
async function deriveUniqueOtherAuthorCount(
  linkedHeadlines: LinkedHeadline[],
  sessionId: string,
  currentPlayerId: string
): Promise<number> {
  // Filter to STRONG connections only
  const strongConnections = linkedHeadlines.filter((h) => h.strength === 'STRONG');

  if (strongConnections.length === 0) {
    return 0;
  }

  // Extract headline texts to look up in DB
  const headlineTexts = strongConnections.map((h) => h.headline);

  try {
    // Query DB to find the player_id for each linked headline
    const result = await pool.query(
      `SELECT player_id, COALESCE(selected_headline, headline_text) as text
       FROM game_session_headlines
       WHERE session_id = $1
         AND COALESCE(selected_headline, headline_text) = ANY($2)`,
      [sessionId, headlineTexts]
    );

    // Collect unique other player IDs
    const otherAuthors = new Set<string>();
    for (const row of result.rows) {
      if (row.player_id !== currentPlayerId) {
        otherAuthors.add(row.player_id);
      }
    }

    return Math.min(otherAuthors.size, 3);
  } catch (error) {
    console.error('Error querying headline owners for connection scoring:', error);
    return 0;
  }
}

/**
 * Check if a player can submit a headline (rate limiting)
 */
function canSubmitHeadline(sessionId: string, playerId: string): { allowed: boolean; remainingMs: number } {
  const key = `${sessionId}:${playerId}`;
  const lastSubmission = lastHeadlineSubmission.get(key);
  const now = Date.now();
  
  if (!lastSubmission) {
    return { allowed: true, remainingMs: 0 };
  }
  
  const elapsed = now - lastSubmission;
  if (elapsed >= HEADLINE_COOLDOWN_MS) {
    return { allowed: true, remainingMs: 0 };
  }
  
  return { allowed: false, remainingMs: HEADLINE_COOLDOWN_MS - elapsed };
}

/**
 * Record a headline submission for rate limiting
 */
function recordHeadlineSubmission(sessionId: string, playerId: string): void {
  const key = `${sessionId}:${playerId}`;
  lastHeadlineSubmission.set(key, Date.now());
}

/**
 * Clear rate limit data for a session (call on session cleanup)
 */
export function clearSessionRateLimits(sessionId: string): void {
  for (const key of lastHeadlineSubmission.keys()) {
    if (key.startsWith(`${sessionId}:`)) {
      lastHeadlineSubmission.delete(key);
    }
  }
}

interface JoinLobbyData {
  joinCode: string;
  playerId: string;
}

interface SessionState {
  id: string;
  joinCode: string;
  status: string;
  hostPlayerId: string | null;
  phase: string;
  currentRound: number;
  playMinutes: number;
  breakMinutes: number;
  maxRounds: number;
  phaseStartedAt: string | null;
  phaseEndsAt: string | null;
  serverNow: string;
  inGameNow: string | null;
  timelineSpeedRatio: number;
  players: Array<{
    id: string;
    nickname: string;
    isHost: boolean;
    joinedAt: string;
    totalScore?: number;
    priorityPlanet?: string | null;
    scoreBreakdown?: {
      baseline: number;
      plausibility: number;
      connection: number;
      planetBonus: number;
    };
  }>;
}

/**
 * Fetch current session state from database including game timing
 */
async function getSessionState(joinCode: string): Promise<SessionState | null> {
  try {
    const result = await pool.query(
      `SELECT
        s.id,
        s.join_code,
        s.status,
        s.host_player_id,
        s.phase,
        s.current_round,
        s.play_minutes,
        s.break_minutes,
        s.max_rounds,
        s.phase_started_at,
        s.phase_ends_at,
        s.in_game_start_at,
        s.timeline_speed_ratio,
        CURRENT_TIMESTAMP as server_now,
        json_agg(
          json_build_object(
            'id', p.id,
            'nickname', p.nickname,
            'isHost', p.is_host,
            'joinedAt', p.joined_at,
            'totalScore', p.total_score,
            'planetUsageState', p.planet_usage_state
          ) ORDER BY p.joined_at
        ) as players
      FROM game_sessions s
      LEFT JOIN session_players p ON s.id = p.session_id AND p.is_system = FALSE
      WHERE s.join_code = $1
      GROUP BY s.id`,
      [joinCode]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const session = result.rows[0];
    const serverNow = new Date(session.server_now);

    // Compute in-game time
    let inGameNow: Date | null = null;
    if (session.in_game_start_at && session.phase_started_at) {
      const inGameStart = new Date(session.in_game_start_at);
      const phaseStart = new Date(session.phase_started_at);
      const realElapsed = serverNow.getTime() - phaseStart.getTime();
      const inGameElapsed = realElapsed * session.timeline_speed_ratio;
      inGameNow = new Date(inGameStart.getTime() + inGameElapsed);
    }

    // Fetch score breakdowns for all players
    const breakdowns = await getPlayerScoreBreakdowns(session.id);

    // Process players to extract currentPriority from planet state
    const processedPlayers = session.players
      .filter((p: any) => p.id !== null)
      .map((p: any) => {
        const planetState = migratePlanetState(p.planetUsageState, DEFAULT_PLANETS);
        const bd = breakdowns.get(p.id);
        return {
          id: p.id,
          nickname: p.nickname,
          isHost: p.isHost,
          joinedAt: p.joinedAt,
          totalScore: p.totalScore ?? 0,
          priorityPlanet: planetState.currentPriority,
          scoreBreakdown: bd ?? { baseline: 0, plausibility: 0, connection: 0, planetBonus: 0 },
        };
      });

    return {
      id: session.id,
      joinCode: session.join_code,
      status: session.status,
      hostPlayerId: session.host_player_id,
      phase: session.phase,
      currentRound: session.current_round,
      playMinutes: session.play_minutes,
      breakMinutes: session.break_minutes,
      maxRounds: session.max_rounds,
      phaseStartedAt: session.phase_started_at
        ? new Date(session.phase_started_at).toISOString()
        : null,
      phaseEndsAt: session.phase_ends_at
        ? new Date(session.phase_ends_at).toISOString()
        : null,
      serverNow: serverNow.toISOString(),
      inGameNow: inGameNow ? inGameNow.toISOString() : null,
      timelineSpeedRatio: session.timeline_speed_ratio,
      players: processedPlayers,
    };
  } catch (error) {
    console.error('Error fetching session state:', error);
    return null;
  }
}

/**
 * Get room name for a session
 */
function getRoomName(joinCode: string): string {
  return `session:${joinCode}`;
}

/**
 * Setup Socket.IO event handlers for lobby functionality
 */
export function setupLobbyHandlers(io: Server): void {
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    /**
     * Join lobby room
     * Client should emit this after successfully creating or joining a session
     */
    socket.on('lobby:join', async (data: JoinLobbyData, callback) => {
      try {
        const { joinCode, playerId } = data;

        if (!joinCode || !playerId) {
          callback?.({
            success: false,
            error: 'Missing joinCode or playerId',
          });
          return;
        }

        // Verify session exists
        const sessionState = await getSessionState(joinCode);
        if (!sessionState) {
          callback?.({
            success: false,
            error: 'Session not found',
          });
          return;
        }

        // Verify player belongs to this session
        const playerInSession = sessionState.players.some(
          (p) => p.id === playerId
        );
        if (!playerInSession) {
          callback?.({
            success: false,
            error: 'Player not in this session',
          });
          return;
        }

        // Join the room
        const roomName = getRoomName(joinCode);
        await socket.join(roomName);

        // Store session info in socket data for later use
        socket.data.joinCode = joinCode;
        socket.data.playerId = playerId;

        console.log(
          `Player ${playerId} joined lobby ${joinCode} (socket: ${socket.id})`
        );

        // Send current state to the joining client
        callback?.({
          success: true,
          state: sessionState,
        });

        // Broadcast to others in the room that someone joined
        socket.to(roomName).emit('lobby:player_joined', {
          playerId,
          player: sessionState.players.find((p) => p.id === playerId),
        });
      } catch (error) {
        console.error('Error in lobby:join:', error);
        callback?.({
          success: false,
          error: 'Failed to join lobby',
        });
      }
    });

    /**
     * Request current session state
     */
    socket.on('lobby:get_state', async (data: { joinCode: string }, callback) => {
      try {
        const { joinCode } = data;

        if (!joinCode) {
          callback?.({
            success: false,
            error: 'Missing joinCode',
          });
          return;
        }

        const sessionState = await getSessionState(joinCode);
        if (!sessionState) {
          callback?.({
            success: false,
            error: 'Session not found',
          });
          return;
        }

        callback?.({
          success: true,
          state: sessionState,
        });
      } catch (error) {
        console.error('Error in lobby:get_state:', error);
        callback?.({
          success: false,
          error: 'Failed to get session state',
        });
      }
    });

    /**
     * Host starts the game
     */
    socket.on('lobby:start_game', async (data: { joinCode: string }, callback) => {
      try {
        const { joinCode } = data;
        const { playerId } = socket.data;

        if (!joinCode || !playerId) {
          callback?.({
            success: false,
            error: 'Missing required data',
          });
          return;
        }

        // Verify the player is the host
        const sessionState = await getSessionState(joinCode);
        if (!sessionState) {
          callback?.({
            success: false,
            error: 'Session not found',
          });
          return;
        }

        if (sessionState.hostPlayerId !== playerId) {
          callback?.({
            success: false,
            error: 'Only the host can start the game',
          });
          return;
        }

        if (sessionState.phase !== 'WAITING') {
          callback?.({
            success: false,
            error: `Game already started (phase: ${sessionState.phase})`,
          });
          return;
        }

        // Initialize planet state for all players before starting the game
        for (const player of sessionState.players) {
          // Create initial planet tally state
          const initialState = initialPlanetTallyState(DEFAULT_PLANETS);
          // Select a random initial priority planet
          const initialPriority = selectPriorityPlanet(initialState, DEFAULT_PLANETS);
          const stateWithPriority = {
            ...initialState,
            currentPriority: initialPriority,
          };

          // Update the player's planet_usage_state in the database
          await pool.query(
            `UPDATE session_players
             SET planet_usage_state = $1
             WHERE id = $2 AND (planet_usage_state = '{}' OR planet_usage_state IS NULL)`,
            [JSON.stringify(stateWithPriority), player.id]
          );
        }

        // Insert Archive system player
        const archiveResult = await pool.query(
          `INSERT INTO session_players (session_id, nickname, is_host, is_system, planet_usage_state)
           VALUES ($1, 'Archive', false, true, '{}')
           RETURNING id`,
          [sessionState.id]
        );
        const archivePlayerId = archiveResult.rows[0].id;

        // Start the game via GameLoopManager (seeds will drip-feed during TUTORIAL phase)
        await gameLoopManager.handleHostStartGame(sessionState.id, joinCode, archivePlayerId);

        // Get updated state
        const updatedState = await getSessionState(joinCode);

        callback?.({
          success: true,
          state: updatedState,
        });

        console.log(`Game started for session ${joinCode}`);
      } catch (error) {
        console.error('Error in lobby:start_game:', error);
        callback?.({
          success: false,
          error: 'Failed to start game',
        });
      }
    });

    /**
     * Handle disconnection
     */
    socket.on('disconnect', () => {
      const { joinCode, playerId } = socket.data;
      console.log(
        `Client disconnected: ${socket.id}${joinCode ? ` (session: ${joinCode}, player: ${playerId})` : ''}`
      );

      // Note: We don't remove players from the database on disconnect
      // They can reconnect and rejoin the same lobby
      // Could emit a "player offline" event here if needed
    });

    /**
     * Handle explicit leave
     */
    socket.on('lobby:leave', async () => {
      const { joinCode } = socket.data;
      if (joinCode) {
        const roomName = getRoomName(joinCode);
        await socket.leave(roomName);
        socket.data.joinCode = undefined;
        socket.data.playerId = undefined;
        console.log(`Socket ${socket.id} left lobby ${joinCode}`);
      }
    });

    /**
     * Submit a headline (story direction)
     * Flow: validate -> fetch context -> LLM evaluation -> dice roll -> store -> broadcast
     */
    socket.on('headline:submit', async (data: { joinCode: string; headline: string }, callback) => {
      try {
        const { playerId } = socket.data;

        if (!playerId) {
          callback?.({
            success: false,
            error: 'Not authenticated - please join a lobby first',
          });
          return;
        }

        // Validate input
        let validatedData;
        try {
          validatedData = submitHeadlineSchema.parse(data);
        } catch (err) {
          if (err instanceof ZodError) {
            callback?.({
              success: false,
              error: err.errors[0]?.message || 'Invalid input',
            });
            return;
          }
          throw err;
        }

        const { joinCode, headline: storyDirection } = validatedData;

        // Get session state
        const sessionState = await getSessionState(joinCode);
        if (!sessionState) {
          callback?.({
            success: false,
            error: 'Session not found',
          });
          return;
        }

        // Verify player belongs to this session
        const player = sessionState.players.find((p) => p.id === playerId);
        if (!player) {
          callback?.({
            success: false,
            error: 'Player not in this session',
          });
          return;
        }

        // Check phase - only allow during PLAYING
        if (sessionState.phase !== 'PLAYING') {
          callback?.({
            success: false,
            error: `Headlines can only be submitted during the playing phase (current: ${sessionState.phase})`,
          });
          return;
        }

        // Check rate limit
        const rateLimitCheck = canSubmitHeadline(sessionState.id, playerId);
        if (!rateLimitCheck.allowed) {
          const remainingSecs = Math.ceil(rateLimitCheck.remainingMs / 1000);
          callback?.({
            success: false,
            error: `Please wait ${remainingSecs} seconds before submitting another headline`,
            cooldownMs: rateLimitCheck.remainingMs,
          });
          return;
        }

        // Fetch existing headlines for context
        const existingHeadlinesResult = await pool.query(
          `SELECT id, COALESCE(selected_headline, headline_text) as text
           FROM game_session_headlines
           WHERE session_id = $1
           ORDER BY created_at ASC`,
          [sessionState.id]
        );
        const headlinesList: HeadlineEntry[] = existingHeadlinesResult.rows.map((row) => ({
          id: row.id,
          text: row.text,
        }));

        // Get planet list
        const planetList = getDefaultPlanets();

        // Call transformation service (LLM evaluation + dice roll)
        const transformResult = await transformHeadline({
          storyDirection,
          headlinesList,
          planetList,
        });

        // Insert headline with all transformation data
        const insertResult = await pool.query(
          `INSERT INTO game_session_headlines (
            session_id, player_id, round_no, headline_text,
            dice_roll, selected_band, selected_headline,
            band1_headline, band2_headline, band3_headline, band4_headline, band5_headline,
            plausibility_level, plausibility_rationale,
            planet_1, planet_2, planet_3,
            linked_headlines, planet_rationales,
            llm_model, llm_input_tokens, llm_output_tokens,
            llm_request, llm_response,
            llm_status, in_game_submitted_at
          ) VALUES (
            $1, $2, $3, $4,
            $5, $6, $7,
            $8, $9, $10, $11, $12,
            $13, $14,
            $15, $16, $17,
            $18, $19,
            $20, $21, $22,
            $23, $24,
            'evaluated', $25
          )
          RETURNING id, created_at, in_game_submitted_at`,
          [
            sessionState.id,
            playerId,
            sessionState.currentRound,
            storyDirection,
            transformResult.diceRoll,
            transformResult.selectedBand,
            transformResult.selectedHeadline,
            transformResult.allBands.band1,
            transformResult.allBands.band2,
            transformResult.allBands.band3,
            transformResult.allBands.band4,
            transformResult.allBands.band5,
            transformResult.plausibility.band,
            transformResult.plausibility.rationale,
            transformResult.planets.top3[0]?.id,
            transformResult.planets.top3[1]?.id,
            transformResult.planets.top3[2]?.id,
            JSON.stringify(transformResult.linked),
            JSON.stringify(transformResult.planets.top3),
            transformResult.model,
            transformResult.usage?.inputTokens,
            transformResult.usage?.outputTokens,
            JSON.stringify(transformResult.llmRequest),
            transformResult.llmResponse,
            sessionState.inGameNow,
          ]
        );

        const insertedRow = insertResult.rows[0];

        // Record submission for rate limiting
        recordHeadlineSubmission(sessionState.id, playerId);

        // Build headline event payload
        const headlineEvent = {
          id: insertedRow.id,
          sessionId: sessionState.id,
          playerId,
          playerNickname: player.nickname,
          roundNo: sessionState.currentRound,
          storyDirection,
          text: transformResult.selectedHeadline,
          diceRoll: transformResult.diceRoll,
          selectedBand: transformResult.selectedBand,
          plausibilityBand: transformResult.plausibility.band,
          plausibilityLabel: transformResult.plausibility.label,
          planets: transformResult.planets.top3.map((p) => p.id),
          allBands: transformResult.allBands,
          createdAt: new Date(insertedRow.created_at).toISOString(),
          inGameSubmittedAt: insertedRow.in_game_submitted_at
            ? new Date(insertedRow.in_game_submitted_at).toISOString()
            : null,
        };

        // Broadcast to all players in the session
        const roomName = getRoomName(joinCode);
        io.to(roomName).emit('headline:new', headlineEvent);

        // Respond to submitter
        callback?.({
          success: true,
          headline: headlineEvent,
          cooldownMs: HEADLINE_COOLDOWN_MS,
        });

        console.log(
          `Headline submitted by ${player.nickname} in session ${joinCode} ` +
          `(round ${sessionState.currentRound}, dice: ${transformResult.diceRoll}, selected band: ${transformResult.selectedBand}, ` +
          `plausibility: ${transformResult.plausibility.band} (${transformResult.plausibility.label}))\n` +
          `  Band 1 (inevitable): ${transformResult.allBands.band1}\n` +
          `  Band 2 (probable):   ${transformResult.allBands.band2}\n` +
          `  Band 3 (plausible):  ${transformResult.allBands.band3}\n` +
          `  Band 4 (possible):   ${transformResult.allBands.band4}\n` +
          `  Band 5 (prepost.):   ${transformResult.allBands.band5}\n` +
          `  >> Selected:         ${transformResult.selectedHeadline}`
        );

        // Apply scoring asynchronously (don't block the response)
        try {
          const uniqueOtherAuthors = await deriveUniqueOtherAuthorCount(
            transformResult.linked,
            sessionState.id,
            playerId
          );

          const scoringResult = await applyHeadlineEvaluation({
            sessionId: sessionState.id,
            playerId,
            headlineId: insertedRow.id,
            plausibilityLevel: transformResult.plausibility.band as PlausibilityLevel,
            selectedBand: transformResult.selectedBand as PlausibilityLevel,
            uniqueOtherAuthors,
            aiPlanetRankings: transformResult.planets.top3.map((p) => p.id),
            roundNo: sessionState.currentRound,
          });

          // Fetch updated score breakdowns for all players
          const updatedBreakdowns = await getPlayerScoreBreakdowns(sessionState.id);

          // Broadcast updated leaderboard with breakdowns
          io.to(roomName).emit('leaderboard:update', {
            leaderboard: scoringResult.leaderboard.map((entry) => ({
              ...entry,
              scoreBreakdown: updatedBreakdowns.get(entry.playerId) ?? {
                baseline: 0, plausibility: 0, connection: 0, planetBonus: 0,
              },
            })),
            lastScoredHeadline: {
              headlineId: insertedRow.id,
              playerId,
              breakdown: scoringResult.breakdown,
              newTotalScore: scoringResult.newTotalScore,
              updatedPriorityPlanet: scoringResult.updatedPriorityPlanet,
            },
          });

          console.log(
            `Scoring for ${player.nickname}: ` +
            `baseline=${scoringResult.breakdown.baseline} + ` +
            `plausibility=${scoringResult.breakdown.plausibility} (band ${transformResult.plausibility.band}) + ` +
            `connection=${scoringResult.breakdown.connectionScore} (${uniqueOtherAuthors} unique others) + ` +
            `planet=${scoringResult.breakdown.planetBonus} ` +
            `= +${scoringResult.breakdown.total} pts (total: ${scoringResult.newTotalScore})`
          );
        } catch (scoringError) {
          console.error('Error applying scoring:', scoringError);
          // Don't fail the headline submission if scoring fails
        }
      } catch (error) {
        console.error('Error in headline:submit:', error);
        callback?.({
          success: false,
          error: 'Failed to submit headline',
        });
      }
    });

    /**
     * Get headlines for a session (feed loading)
     */
    socket.on('headline:get_feed', async (data: { joinCode: string; roundNo?: number }, callback) => {
      try {
        const { joinCode, roundNo } = data;

        if (!joinCode) {
          callback?.({
            success: false,
            error: 'Missing joinCode',
          });
          return;
        }

        // Get session to verify it exists and get session ID
        const sessionState = await getSessionState(joinCode);
        if (!sessionState) {
          callback?.({
            success: false,
            error: 'Session not found',
          });
          return;
        }

        // Build query - optionally filter by round
        let query = `
          SELECT
            h.id,
            h.session_id,
            h.player_id,
            p.nickname as player_nickname,
            h.round_no,
            h.headline_text as story_direction,
            COALESCE(h.selected_headline, h.headline_text) as text,
            h.dice_roll,
            h.selected_band,
            h.plausibility_level,
            h.planet_1,
            h.planet_2,
            h.planet_3,
            h.band1_headline,
            h.band2_headline,
            h.band3_headline,
            h.band4_headline,
            h.band5_headline,
            h.baseline_score,
            h.plausibility_score,
            h.others_story_score,
            h.planet_bonus_score,
            h.total_headline_score,
            h.created_at,
            h.in_game_submitted_at
          FROM game_session_headlines h
          JOIN session_players p ON h.player_id = p.id
          WHERE h.session_id = $1
        `;
        const params: any[] = [sessionState.id];

        if (roundNo !== undefined) {
          query += ` AND h.round_no = $2`;
          params.push(roundNo);
        }

        query += ` ORDER BY h.created_at ASC`;

        const result = await pool.query(query, params);

        const headlines = result.rows.map((row) => ({
          id: row.id,
          sessionId: row.session_id,
          playerId: row.player_id,
          playerNickname: row.player_nickname,
          roundNo: row.round_no,
          storyDirection: row.story_direction,
          text: row.text,
          diceRoll: row.dice_roll,
          selectedBand: row.selected_band,
          plausibilityBand: row.plausibility_level,
          planets: [row.planet_1, row.planet_2, row.planet_3].filter(Boolean),
          allBands: row.band1_headline ? {
            band1: row.band1_headline,
            band2: row.band2_headline,
            band3: row.band3_headline,
            band4: row.band4_headline,
            band5: row.band5_headline,
          } : null,
          baselineScore: row.baseline_score ?? null,
          plausibilityScore: row.plausibility_score ?? null,
          connectionScore: row.others_story_score ?? null,
          planetBonusScore: row.planet_bonus_score ?? null,
          totalScore: row.total_headline_score ?? null,
          createdAt: new Date(row.created_at).toISOString(),
          inGameSubmittedAt: row.in_game_submitted_at
            ? new Date(row.in_game_submitted_at).toISOString()
            : null,
        }));

        callback?.({
          success: true,
          headlines,
        });
      } catch (error) {
        console.error('Error in headline:get_feed:', error);
        callback?.({
          success: false,
          error: 'Failed to get headlines',
        });
      }
    });

    /**
     * Get round summary (for reconnecting clients)
     */
    socket.on('round:get_summary', async (data: { joinCode: string; roundNo: number }, callback) => {
      try {
        const { joinCode, roundNo } = data;

        if (!joinCode || roundNo === undefined) {
          callback?.({
            success: false,
            error: 'Missing joinCode or roundNo',
          });
          return;
        }

        // Get session ID from join code
        const sessionId = await getSessionIdFromJoinCode(joinCode);
        if (!sessionId) {
          callback?.({
            success: false,
            error: 'Session not found',
          });
          return;
        }

        // Get the summary
        const summaryData = await getRoundSummary(sessionId, roundNo);

        if (!summaryData) {
          callback?.({
            success: true,
            status: 'pending',
            summary: null,
            error: null,
          });
          return;
        }

        callback?.({
          success: true,
          status: summaryData.status,
          summaryType: summaryData.summaryType,
          summary: summaryData.summary,
          error: summaryData.error,
        });
      } catch (error) {
        console.error('Error in round:get_summary:', error);
        callback?.({
          success: false,
          error: 'Failed to get round summary',
        });
      }
    });
  });

  console.log('✅ Lobby Socket.IO handlers initialized');
}

