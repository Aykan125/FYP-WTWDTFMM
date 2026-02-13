import { useState, useEffect, useRef } from 'react';

const MAX_POINTS_PER_HEADLINE = 18; // 10 baseline + 2 plausibility + 3 connection + 3 planet
const COOLDOWN_SECONDS = 60;

interface UseTheoreticalMaxOptions {
  phase: string;
  currentRound: number;
  playMinutes: number;
  phaseStartedAt: string | null;
  serverNow: string;
}

/**
 * Calculates the theoretical maximum score a player could have at the current
 * point in time, based on elapsed PLAYING time and rate limits.
 *
 * This is used as the reference width for the top bar in the score chart.
 */
export function useTheoreticalMax({
  phase,
  currentRound,
  playMinutes,
  phaseStartedAt,
  serverNow,
}: UseTheoreticalMaxOptions): number {
  const [theoreticalMax, setTheoreticalMax] = useState(MAX_POINTS_PER_HEADLINE);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Snapshot the client-server time offset when we receive serverNow
  const offsetRef = useRef(0);

  useEffect(() => {
    offsetRef.current = new Date(serverNow).getTime() - Date.now();
  }, [serverNow]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const compute = () => {
      const playDurationMs = playMinutes * 60 * 1000;

      // Calculate completed play time from previous rounds
      let completedPlayMs: number;
      if (phase === 'PLAYING') {
        // Rounds before current one are complete
        completedPlayMs = (currentRound - 1) * playDurationMs;
      } else if (phase === 'BREAK' || phase === 'FINISHED') {
        // Current round's play phase is also complete
        completedPlayMs = currentRound * playDurationMs;
      } else {
        // WAITING
        setTheoreticalMax(MAX_POINTS_PER_HEADLINE);
        return;
      }

      // Add current phase elapsed time if currently PLAYING
      let currentPhasePlayMs = 0;
      if (phase === 'PLAYING' && phaseStartedAt) {
        const phaseStart = new Date(phaseStartedAt).getTime();
        const now = Date.now() + offsetRef.current;
        currentPhasePlayMs = Math.max(0, now - phaseStart);
        // Cap at play duration
        currentPhasePlayMs = Math.min(currentPhasePlayMs, playDurationMs);
      }

      const totalPlaySeconds = (completedPlayMs + currentPhasePlayMs) / 1000;
      const maxHeadlines = Math.floor(totalPlaySeconds / COOLDOWN_SECONDS) + 1;
      setTheoreticalMax(Math.max(MAX_POINTS_PER_HEADLINE, maxHeadlines * MAX_POINTS_PER_HEADLINE));
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
  }, [phase, currentRound, playMinutes, phaseStartedAt, serverNow]);

  return theoreticalMax;
}
