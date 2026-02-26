import { useState, useEffect, useRef } from 'react';

interface UseInGameNowOptions {
  /** Last inGameNow snapshot from the server (ISO string). */
  inGameNow: string | null;
  /** Server timestamp that accompanied the snapshot (ISO string). */
  serverNow: string;
  /** How many in-game seconds per real-world second. */
  timelineSpeedRatio: number;
  /** Only tick while true (e.g. during PLAYING/BREAK). */
  enabled?: boolean;
}

/**
 * Derives a ticking in-game timestamp from the last server snapshot,
 * updating every minute so the "Current Period" card stays fresh
 * without requiring extra socket emissions.
 */
export function useInGameNow({
  inGameNow,
  serverNow,
  timelineSpeedRatio,
  enabled = true,
}: UseInGameNowOptions): string | null {
  const [derived, setDerived] = useState<string | null>(inGameNow);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Snapshot when we received the server values
  const snapshotRef = useRef({
    clientTime: Date.now(),
    serverTime: new Date(serverNow).getTime(),
    inGameTime: inGameNow ? new Date(inGameNow).getTime() : 0,
  });

  // Re-snapshot whenever the server sends new values
  useEffect(() => {
    snapshotRef.current = {
      clientTime: Date.now(),
      serverTime: new Date(serverNow).getTime(),
      inGameTime: inGameNow ? new Date(inGameNow).getTime() : 0,
    };
    // Also immediately recompute
    if (inGameNow) {
      setDerived(inGameNow);
    } else {
      setDerived(null);
    }
  }, [inGameNow, serverNow]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!enabled || !inGameNow) {
      return;
    }

    const compute = () => {
      const snap = snapshotRef.current;
      if (snap.inGameTime === 0) return;

      // How much real time has elapsed since the snapshot
      const realElapsedMs = Date.now() - snap.clientTime;
      // Scale by timelineSpeedRatio to get in-game elapsed
      const inGameElapsedMs = realElapsedMs * timelineSpeedRatio;
      const newInGameTime = snap.inGameTime + inGameElapsedMs;

      setDerived(new Date(newInGameTime).toISOString());
    };

    // Compute immediately, then every 60 seconds
    compute();
    intervalRef.current = setInterval(compute, 60_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, inGameNow, timelineSpeedRatio]);

  return derived;
}
