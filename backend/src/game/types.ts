/**
 * Game phase types and interfaces for the Future Headlines game
 */

export type GamePhase = 'WAITING' | 'PLAYING' | 'BREAK' | 'FINISHED';

/**
 * Configuration for a game session (from DB)
 */
export interface GameSessionConfig {
  sessionId: string;
  joinCode: string;
  playMinutes: number;
  breakMinutes: number;
  maxRounds: number;
  timelineSpeedRatio: number;
}

/**
 * Current runtime state of a game session
 */
export interface GameSessionRuntimeState extends GameSessionConfig {
  phase: GamePhase;
  currentRound: number;
  phaseStartedAt: Date | null;
  phaseEndsAt: Date | null;
  inGameStartAt: Date | null;
}

/**
 * Phase transition event data
 */
export interface PhaseTransition {
  sessionId: string;
  fromPhase: GamePhase;
  toPhase: GamePhase;
  roundNo: number;
}

/**
 * Computed game state for broadcasting to clients
 */
export interface GameStateSnapshot {
  phase: GamePhase;
  currentRound: number;
  playMinutes: number;
  breakMinutes: number;
  maxRounds: number;
  phaseStartedAt: string | null;
  phaseEndsAt: string | null;
  serverNow: string;
  inGameNow: string | null;
  timelineSpeedRatio: number;
}

