import { useState, useEffect, useRef } from 'react';

interface UsePhaseTimerOptions {
  phaseEndsAt: string | null;
  serverNow: string;
}

interface UsePhaseTimerReturn {
  remainingMs: number;
  remainingFormatted: string;
}

/**
 * Hook to manage a countdown timer for game phases
 * Syncs with server time and counts down locally
 */
export function usePhaseTimer({
  phaseEndsAt,
  serverNow,
}: UsePhaseTimerOptions): UsePhaseTimerReturn {
  const [remainingMs, setRemainingMs] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!phaseEndsAt) {
      setRemainingMs(0);
      return;
    }

    // Calculate initial remaining time from server timestamps
    const endsAt = new Date(phaseEndsAt).getTime();
    const now = new Date(serverNow).getTime();
    const initialRemaining = Math.max(0, endsAt - now);

    setRemainingMs(initialRemaining);

    // Store when we started the timer
    const startTime = Date.now();
    const startRemaining = initialRemaining;

    // Update every second
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const newRemaining = Math.max(0, startRemaining - elapsed);
      setRemainingMs(newRemaining);

      // Stop when we hit zero
      if (newRemaining <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, 100); // Update every 100ms for smooth countdown

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [phaseEndsAt, serverNow]);

  // Format remaining time as MM:SS
  const remainingFormatted = formatTime(remainingMs);

  return { remainingMs, remainingFormatted };
}

function formatTime(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

