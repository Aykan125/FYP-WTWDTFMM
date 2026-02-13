import { computeNextPhase } from '../../src/game/gameLoop';

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

