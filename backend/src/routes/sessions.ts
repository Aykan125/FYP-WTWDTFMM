import { Router, Request, Response } from 'express';
import pool from '../db/pool.js';
import { generateUniqueJoinCode } from '../utils/joinCode.js';
import {
  createSessionSchema,
  joinSessionSchema,
  joinCodeSchema,
} from '../utils/validation.js';
import { ZodError } from 'zod';

const router = Router();

/**
 * POST /api/sessions
 * Create a new game session with a host player
 */
router.post('/sessions', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate request body
    const { hostNickname } = createSessionSchema.parse(req.body);

    // Generate unique join code
    const joinCode = await generateUniqueJoinCode();

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Create session with game configuration
      const sessionResult = await client.query(
        `INSERT INTO game_sessions (
          join_code, 
          status, 
          play_minutes, 
          break_minutes, 
          max_rounds, 
          timeline_speed_ratio
        )
         VALUES ($1, 'WAITING', $2, $3, $4, $5)
         RETURNING id, join_code, status, created_at, updated_at`,
        [joinCode, 15, 5, 3, 60.0]
      );
      const session = sessionResult.rows[0];

      // Create host player
      const playerResult = await client.query(
        `INSERT INTO session_players (session_id, nickname, is_host)
         VALUES ($1, $2, true)
         RETURNING id, nickname, is_host, joined_at`,
        [session.id, hostNickname]
      );
      const hostPlayer = playerResult.rows[0];

      // Update session with host_player_id
      await client.query(
        `UPDATE game_sessions SET host_player_id = $1 WHERE id = $2`,
        [hostPlayer.id, session.id]
      );

      await client.query('COMMIT');

      res.status(201).json({
        session: {
          id: session.id,
          joinCode: session.join_code,
          status: session.status,
          createdAt: session.created_at,
        },
        player: {
          id: hostPlayer.id,
          nickname: hostPlayer.nickname,
          isHost: hostPlayer.is_host,
          joinedAt: hostPlayer.joined_at,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * POST /api/sessions/:joinCode/join
 * Join an existing session as a player
 */
router.post('/sessions/:joinCode/join', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate join code from params
    const joinCode = joinCodeSchema.parse(req.params.joinCode.toUpperCase());
    
    // Validate request body
    const { nickname } = joinSessionSchema.parse(req.body);

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Check if session exists
      const sessionResult = await client.query(
        `SELECT id, join_code, status FROM game_sessions WHERE join_code = $1`,
        [joinCode]
      );

      if (sessionResult.rows.length === 0) {
        await client.query('ROLLBACK');
        res.status(404).json({ error: 'Session not found' });
        return;
      }

      const session = sessionResult.rows[0];

      // Check if session is in WAITING state
      if (session.status !== 'WAITING') {
        await client.query('ROLLBACK');
        res.status(400).json({
          error: 'Cannot join session',
          message: 'Session has already started or finished',
        });
        return;
      }

      // Check if nickname is already taken in this session
      const nicknameCheck = await client.query(
        `SELECT 1 FROM session_players 
         WHERE session_id = $1 AND nickname = $2`,
        [session.id, nickname]
      );

      if (nicknameCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        res.status(409).json({
          error: 'Nickname already taken',
          message: 'Please choose a different nickname',
        });
        return;
      }

      // Create player
      const playerResult = await client.query(
        `INSERT INTO session_players (session_id, nickname, is_host)
         VALUES ($1, $2, false)
         RETURNING id, nickname, is_host, joined_at`,
        [session.id, nickname]
      );
      const player = playerResult.rows[0];

      await client.query('COMMIT');

      res.status(201).json({
        session: {
          id: session.id,
          joinCode: session.join_code,
          status: session.status,
        },
        player: {
          id: player.id,
          nickname: player.nickname,
          isHost: player.is_host,
          joinedAt: player.joined_at,
        },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Validation failed',
        details: error.errors,
      });
      return;
    }
    console.error('Error joining session:', error);
    res.status(500).json({ error: 'Failed to join session' });
  }
});

/**
 * GET /api/sessions/:joinCode
 * Get session details including all players
 */
router.get('/sessions/:joinCode', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate and normalize join code
    const joinCode = joinCodeSchema.parse(req.params.joinCode.toUpperCase());

    // Get session with players
    const result = await pool.query(
      `SELECT 
        s.id,
        s.join_code,
        s.status,
        s.host_player_id,
        s.created_at,
        s.updated_at,
        json_agg(
          json_build_object(
            'id', p.id,
            'nickname', p.nickname,
            'isHost', p.is_host,
            'joinedAt', p.joined_at
          ) ORDER BY p.joined_at
        ) as players
      FROM game_sessions s
      LEFT JOIN session_players p ON s.id = p.session_id
      WHERE s.join_code = $1
      GROUP BY s.id`,
      [joinCode]
    );

    if (result.rows.length === 0) {
      res.status(404).json({ error: 'Session not found' });
      return;
    }

    const session = result.rows[0];

    res.json({
      id: session.id,
      joinCode: session.join_code,
      status: session.status,
      hostPlayerId: session.host_player_id,
      createdAt: session.created_at,
      updatedAt: session.updated_at,
      players: session.players.filter((p: any) => p.id !== null), // Filter out null players from LEFT JOIN
    });
  } catch (error) {
    if (error instanceof ZodError) {
      res.status(400).json({
        error: 'Invalid join code format',
        details: error.errors,
      });
      return;
    }
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

export default router;

