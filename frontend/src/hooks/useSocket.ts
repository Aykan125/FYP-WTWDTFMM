import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export interface ScoreBreakdown {
  baseline: number;
  plausibility: number;
  connection: number;
  planetBonus: number;
}

interface Player {
  id: string;
  nickname: string;
  isHost: boolean;
  joinedAt: string;
  totalScore?: number;
  priorityPlanet?: string | null;
  scoreBreakdown?: ScoreBreakdown;
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
  players: Player[];
}

export interface Headline {
  id: string;
  sessionId: string;
  playerId: string;
  playerNickname: string;
  roundNo: number;
  text: string;
  createdAt: string;
}

export interface HighlightedHeadline {
  headline: string;
  source: string;
  significance: string;
}

export interface RoundSummaryOutput {
  narrative: string;
  themes: string[];
  highlightedHeadlines: HighlightedHeadline[];
  dominantPlanets: string[];
  roundStats: {
    headlineCount: number;
    playerCount: number;
  };
}

export interface RoundSummary {
  roundNo: number;
  status: 'pending' | 'generating' | 'completed' | 'error';
  summary: RoundSummaryOutput | null;
  error: string | null;
}

interface SubmitHeadlineResult {
  success: boolean;
  headline?: Headline;
  error?: string;
  cooldownMs?: number;
}

interface UseSocketReturn {
  socket: Socket | null;
  connected: boolean;
  sessionState: SessionState | null;
  headlines: Headline[];
  roundSummary: RoundSummary | null;
  joinLobby: (joinCode: string, playerId: string) => Promise<boolean>;
  leaveLobby: () => void;
  startGame: (joinCode: string) => Promise<boolean>;
  submitHeadline: (joinCode: string, headline: string) => Promise<SubmitHeadlineResult>;
  loadHeadlines: (joinCode: string, roundNo?: number) => Promise<boolean>;
  requestSummary: (joinCode: string, roundNo: number) => Promise<boolean>;
}

export function useSocket(): UseSocketReturn {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [headlines, setHeadlines] = useState<Headline[]>([]);
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);

  useEffect(() => {
    // Initialize socket connection
    const socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      setConnected(true);
    });

    socket.on('disconnect', (reason) => {
      console.log('Socket disconnected:', reason);
      setConnected(false);
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      setConnected(false);
    });

    // Listen for lobby events
    socket.on('lobby:player_joined', (data: { playerId: string; player: Player }) => {
      console.log('Player joined:', data.player);
      setSessionState((prev) => {
        if (!prev) return prev;
        // Add player if not already in the list
        if (!prev.players.some((p) => p.id === data.playerId)) {
          return {
            ...prev,
            players: [...prev.players, data.player],
          };
        }
        return prev;
      });
    });

    socket.on('lobby:game_started', (data: { state: SessionState }) => {
      console.log('Game started:', data.state);
      setSessionState(data.state);
    });

    // Listen for game state updates (phase transitions, etc.)
    socket.on('game:state', (state: SessionState) => {
      console.log('Game state updated:', state);
      setSessionState(state);
      // Clear round summary when leaving BREAK phase
      if (state.phase !== 'BREAK') {
        setRoundSummary(null);
      }
    });

    // Listen for round summary updates
    socket.on('round:summary', (data: { roundNo: number; status: string; summary?: RoundSummaryOutput; error?: string }) => {
      console.log('Round summary update:', data);
      setRoundSummary({
        roundNo: data.roundNo,
        status: data.status as RoundSummary['status'],
        summary: data.summary ?? null,
        error: data.error ?? null,
      });
    });

    // Listen for new headlines
    socket.on('headline:new', (headline: Headline) => {
      console.log('New headline:', headline);
      setHeadlines((prev) => {
        // Avoid duplicates
        if (prev.some((h) => h.id === headline.id)) {
          return prev;
        }
        return [...prev, headline];
      });
    });

    // Listen for leaderboard updates (real-time score changes)
    socket.on('leaderboard:update', (data: { leaderboard: { playerId: string; totalScore: number; scoreBreakdown?: ScoreBreakdown }[] }) => {
      console.log('Leaderboard updated:', data);
      setSessionState((prev) => {
        if (!prev) return prev;
        const updatedPlayers = prev.players.map((p) => {
          const entry = data.leaderboard.find((e) => e.playerId === p.id);
          if (!entry) return p;
          return {
            ...p,
            totalScore: entry.totalScore,
            scoreBreakdown: entry.scoreBreakdown ?? p.scoreBreakdown,
          };
        });
        return { ...prev, players: updatedPlayers };
      });
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinLobby = async (joinCode: string, playerId: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve(false);
        return;
      }

      socketRef.current.emit(
        'lobby:join',
        { joinCode, playerId },
        (response: { success: boolean; state?: SessionState; error?: string }) => {
          if (response.success && response.state) {
            setSessionState(response.state);
            resolve(true);
          } else {
            console.error('Failed to join lobby:', response.error);
            resolve(false);
          }
        }
      );
    });
  };

  const leaveLobby = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.emit('lobby:leave');
      setSessionState(null);
      setHeadlines([]);
      setRoundSummary(null);
    }
  }, []);

  const startGame = useCallback(async (joinCode: string): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve(false);
        return;
      }

      socketRef.current.emit(
        'lobby:start_game',
        { joinCode },
        (response: { success: boolean; state?: SessionState; error?: string }) => {
          if (response.success) {
            console.log('Game started successfully');
            resolve(true);
          } else {
            console.error('Failed to start game:', response.error);
            alert(response.error || 'Failed to start game');
            resolve(false);
          }
        }
      );
    });
  }, []);

  const submitHeadline = useCallback(async (joinCode: string, headline: string): Promise<SubmitHeadlineResult> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve({ success: false, error: 'Not connected' });
        return;
      }

      socketRef.current.emit(
        'headline:submit',
        { joinCode, headline },
        (response: SubmitHeadlineResult) => {
          if (response.success) {
            console.log('Headline submitted:', response.headline);
          } else {
            console.error('Failed to submit headline:', response.error);
          }
          resolve(response);
        }
      );
    });
  }, []);

  const loadHeadlines = useCallback(async (joinCode: string, roundNo?: number): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve(false);
        return;
      }

      socketRef.current.emit(
        'headline:get_feed',
        { joinCode, roundNo },
        (response: { success: boolean; headlines?: Headline[]; error?: string }) => {
          if (response.success && response.headlines) {
            setHeadlines(response.headlines);
            resolve(true);
          } else {
            console.error('Failed to load headlines:', response.error);
            resolve(false);
          }
        }
      );
    });
  }, []);

  const requestSummary = useCallback(async (joinCode: string, roundNo: number): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!socketRef.current) {
        resolve(false);
        return;
      }

      socketRef.current.emit(
        'round:get_summary',
        { joinCode, roundNo },
        (response: { success: boolean; status?: string; summary?: RoundSummaryOutput; error?: string }) => {
          if (response.success) {
            setRoundSummary({
              roundNo,
              status: (response.status ?? 'pending') as RoundSummary['status'],
              summary: response.summary ?? null,
              error: response.error ?? null,
            });
            resolve(true);
          } else {
            console.error('Failed to get round summary:', response.error);
            resolve(false);
          }
        }
      );
    });
  }, []);

  return {
    socket: socketRef.current,
    connected,
    sessionState,
    headlines,
    roundSummary,
    joinLobby,
    leaveLobby,
    startGame,
    submitHeadline,
    loadHeadlines,
    requestSummary,
  };
}

