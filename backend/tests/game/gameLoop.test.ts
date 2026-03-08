import { computeNextPhase, computeRoundSpeedRatio } from '../../src/game/gameLoop';

describe('computeNextPhase', () => {
  describe('PLAYING phase transitions', () => {
    it('should transition from PLAYING to BREAK with same round (non-final rounds)', () => {
      const result = computeNextPhase('PLAYING', 1, 4);
      expect(result).toEqual({ phase: 'BREAK', round: 1 });
    });

    it('should work for any non-final round number', () => {
      expect(computeNextPhase('PLAYING', 3, 4)).toEqual({
        phase: 'BREAK',
        round: 3,
      });
    });

    it('should transition from PLAYING to FINISHED on the last round (no final break)', () => {
      const result = computeNextPhase('PLAYING', 4, 4);
      expect(result).toEqual({ phase: 'FINISHED', round: 4 });
    });

    it('should transition from PLAYING to FINISHED for 3-round games on round 3', () => {
      const result = computeNextPhase('PLAYING', 3, 3);
      expect(result).toEqual({ phase: 'FINISHED', round: 3 });
    });

    it('should transition from PLAYING to FINISHED when exceeding max rounds', () => {
      const result = computeNextPhase('PLAYING', 5, 4);
      expect(result).toEqual({ phase: 'FINISHED', round: 5 });
    });
  });

  describe('BREAK phase transitions', () => {
    it('should transition from BREAK to PLAYING with incremented round when not at max', () => {
      const result = computeNextPhase('BREAK', 1, 4);
      expect(result).toEqual({ phase: 'PLAYING', round: 2 });
    });

    it('should transition from BREAK to PLAYING for middle rounds', () => {
      expect(computeNextPhase('BREAK', 2, 4)).toEqual({
        phase: 'PLAYING',
        round: 3,
      });
    });

    it('should transition from BREAK to FINISHED when at max rounds', () => {
      const result = computeNextPhase('BREAK', 4, 4);
      expect(result).toEqual({ phase: 'FINISHED', round: 4 });
    });

    it('should transition from BREAK to FINISHED when exceeding max rounds', () => {
      const result = computeNextPhase('BREAK', 5, 4);
      expect(result).toEqual({ phase: 'FINISHED', round: 5 });
    });
  });

  describe('Edge cases', () => {
    it('should transition WAITING to FINISHED (unexpected but safe)', () => {
      const result = computeNextPhase('WAITING', 0, 4);
      expect(result).toEqual({ phase: 'FINISHED', round: 0 });
    });

    it('should transition FINISHED to FINISHED (idempotent)', () => {
      const result = computeNextPhase('FINISHED', 4, 4);
      expect(result).toEqual({ phase: 'FINISHED', round: 4 });
    });
  });

  describe('Different max rounds configurations', () => {
    it('should handle 3 round games', () => {
      expect(computeNextPhase('BREAK', 3, 3)).toEqual({
        phase: 'FINISHED',
        round: 3,
      });
      expect(computeNextPhase('BREAK', 2, 3)).toEqual({
        phase: 'PLAYING',
        round: 3,
      });
    });

    it('should handle single round games', () => {
      expect(computeNextPhase('BREAK', 1, 1)).toEqual({
        phase: 'FINISHED',
        round: 1,
      });
    });
  });
});

describe('computeRoundSpeedRatio', () => {
  const TOTAL_INGAME_MS = 20 * 365.25 * 24 * 60 * 60 * 1000;
  const PLAY_MINUTES = 2;
  const playMs = PLAY_MINUTES * 60_000;

  it('round 1 uses weight 3/15', () => {
    const expected = ((3 / 15) * TOTAL_INGAME_MS) / playMs;
    expect(computeRoundSpeedRatio(1, PLAY_MINUTES)).toBeCloseTo(expected, 10);
  });

  it('round 2 uses weight 5/15', () => {
    const expected = ((5 / 15) * TOTAL_INGAME_MS) / playMs;
    expect(computeRoundSpeedRatio(2, PLAY_MINUTES)).toBeCloseTo(expected, 10);
  });

  it('round 3 uses weight 7/15', () => {
    const expected = ((7 / 15) * TOTAL_INGAME_MS) / playMs;
    expect(computeRoundSpeedRatio(3, PLAY_MINUTES)).toBeCloseTo(expected, 10);
  });

  it('round 4+ clamps to weight 7 (last weight)', () => {
    expect(computeRoundSpeedRatio(4, PLAY_MINUTES)).toBeCloseTo(
      computeRoundSpeedRatio(3, PLAY_MINUTES),
      10
    );
    expect(computeRoundSpeedRatio(99, PLAY_MINUTES)).toBeCloseTo(
      computeRoundSpeedRatio(3, PLAY_MINUTES),
      10
    );
  });

  it('ratios across 3 rounds sum to cover exactly 20 in-game years per play minute', () => {
    const total =
      computeRoundSpeedRatio(1, PLAY_MINUTES) +
      computeRoundSpeedRatio(2, PLAY_MINUTES) +
      computeRoundSpeedRatio(3, PLAY_MINUTES);
    const expected = TOTAL_INGAME_MS / playMs;
    expect(total).toBeCloseTo(expected, 10);
  });

  it('ratio scales inversely with play duration', () => {
    const ratio2min = computeRoundSpeedRatio(1, 2);
    const ratio4min = computeRoundSpeedRatio(1, 4);
    expect(ratio2min).toBeCloseTo(ratio4min * 2, 10);
  });

  it('rounds accelerate: round 1 < round 2 < round 3', () => {
    const r1 = computeRoundSpeedRatio(1, PLAY_MINUTES);
    const r2 = computeRoundSpeedRatio(2, PLAY_MINUTES);
    const r3 = computeRoundSpeedRatio(3, PLAY_MINUTES);
    expect(r1).toBeLessThan(r2);
    expect(r2).toBeLessThan(r3);
  });
});

