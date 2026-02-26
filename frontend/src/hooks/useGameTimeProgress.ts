import { useState, useEffect, useRef } from 'react';

interface UseGameTimeProgressOptions {
  phase: string;
  currentRound: number;
  maxRounds: number;
  playMinutes: number;
  phaseStartedAt: string | null;
  serverNow: string;
}

interface UseGameTimeProgressReturn {
  totalGameMins: number;
  currentGameMins: number;
}

/**
 * Calculates the total game minutes (t) and current elapsed play minutes (m)
 * for the score bar chart formula: bar width = w * (p/h) * (m/t)
 */
export function useGameTimeProgress({
  phase,
  currentRound,
  maxRounds,
  playMinutes,
  phaseStartedAt,
  serverNow,
}: UseGameTimeProgressOptions): UseGameTimeProgressReturn {
  const [currentGameMins, setCurrentGameMins] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Snapshot the client-server time offset when we receive serverNow
  const offsetRef = useRef(0);

  useEffect(() => {
    offsetRef.current = new Date(serverNow).getTime() - Date.now();
  }, [serverNow]);

  // Total game minutes is constant
  const totalGameMins = playMinutes * maxRounds;

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const compute = () => {
      if (phase === 'WAITING') {
        setCurrentGameMins(0);
        return;
      }

      // Calculate completed play time from previous rounds
      let completedPlayMins: number;
      if (phase === 'PLAYING') {
        // Rounds before current one are complete
        completedPlayMins = (currentRound - 1) * playMinutes;
      } else if (phase === 'BREAK') {
        // Current round's play phase is complete
        completedPlayMins = currentRound * playMinutes;
      } else if (phase === 'FINISHED') {
        // All rounds complete
        completedPlayMins = maxRounds * playMinutes;
      } else {
        completedPlayMins = 0;
      }

      // Add current phase elapsed time if currently PLAYING
      let currentPhasePlayMins = 0;
      if (phase === 'PLAYING' && phaseStartedAt) {
        const phaseStart = new Date(phaseStartedAt).getTime();
        const now = Date.now() + offsetRef.current;
        const elapsedMs = Math.max(0, now - phaseStart);
        const elapsedMins = elapsedMs / (60 * 1000);
        // Cap at play duration
        currentPhasePlayMins = Math.min(elapsedMins, playMinutes);
      }

      setCurrentGameMins(completedPlayMins + currentPhasePlayMins);
    };

    compute();

    // Update every second during PLAYING phase
    if (phase === 'PLAYING') {
      intervalRef.current = setInterval(compute, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [phase, currentRound, maxRounds, playMinutes, phaseStartedAt, serverNow]);

  return {
    totalGameMins,
    currentGameMins,
  };
}
