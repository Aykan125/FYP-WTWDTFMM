/**
 * Unit tests for pure scoring functions.
 */

import {
  computeBaselineScore,
  computePlausibilityScore,
  computeStoryConnectionScore,
  computeConnectionScore,
  computeHeadlineScore,
  getPlausibilityLabel,
  getStoryConnectionLabel,
} from '../../src/game/scoring';
import {
  DEFAULT_SCORING_CONFIG,
  ScoringConfig,
  PlausibilityLevel,
  HeadlineScoringInput,
  ConnectionScoreType,
} from '../../src/game/scoringTypes';

describe('Scoring Functions', () => {
  describe('computeBaselineScore', () => {
    it('should return the baseline score from config', () => {
      expect(computeBaselineScore(DEFAULT_SCORING_CONFIG)).toBe(10);
    });

    it('should use custom baseline when provided', () => {
      const customConfig: ScoringConfig = {
        ...DEFAULT_SCORING_CONFIG,
        baselineB: 25,
      };
      expect(computeBaselineScore(customConfig)).toBe(25);
    });
  });

  describe('computePlausibilityScore', () => {
    it('should return exactTarget (A1) points for level 3', () => {
      const score = computePlausibilityScore(3, DEFAULT_SCORING_CONFIG);
      expect(score).toBe(DEFAULT_SCORING_CONFIG.plausibilityPoints.exactTarget);
      expect(score).toBe(2);
    });

    it('should return nearTarget (A2) points for level 2', () => {
      const score = computePlausibilityScore(2, DEFAULT_SCORING_CONFIG);
      expect(score).toBe(DEFAULT_SCORING_CONFIG.plausibilityPoints.nearTarget);
      expect(score).toBe(1);
    });

    it('should return nearTarget (A2) points for level 4', () => {
      const score = computePlausibilityScore(4, DEFAULT_SCORING_CONFIG);
      expect(score).toBe(DEFAULT_SCORING_CONFIG.plausibilityPoints.nearTarget);
      expect(score).toBe(1);
    });

    it('should return other points for level 1', () => {
      const score = computePlausibilityScore(1, DEFAULT_SCORING_CONFIG);
      expect(score).toBe(DEFAULT_SCORING_CONFIG.plausibilityPoints.other);
      expect(score).toBe(0);
    });

    it('should return other points for level 5', () => {
      const score = computePlausibilityScore(5, DEFAULT_SCORING_CONFIG);
      expect(score).toBe(DEFAULT_SCORING_CONFIG.plausibilityPoints.other);
      expect(score).toBe(0);
    });

    it('should work with all plausibility levels 1-5', () => {
      const levels: PlausibilityLevel[] = [1, 2, 3, 4, 5];
      const expectedScores = [0, 1, 2, 1, 0];

      levels.forEach((level, index) => {
        expect(computePlausibilityScore(level, DEFAULT_SCORING_CONFIG)).toBe(
          expectedScores[index]
        );
      });
    });

    it('should use custom config correctly', () => {
      const customConfig: ScoringConfig = {
        ...DEFAULT_SCORING_CONFIG,
        plausibilityPoints: {
          exactTarget: 50,
          nearTarget: 25,
          other: 5,
          targetLevel: 4,
          nearLevels: [3, 5],
        },
      };

      expect(computePlausibilityScore(4, customConfig)).toBe(50); // exactTarget
      expect(computePlausibilityScore(3, customConfig)).toBe(25); // nearTarget
      expect(computePlausibilityScore(5, customConfig)).toBe(25); // nearTarget
      expect(computePlausibilityScore(1, customConfig)).toBe(5); // other
      expect(computePlausibilityScore(2, customConfig)).toBe(5); // other
    });
  });

  describe('computeStoryConnectionScore', () => {
    it('should return correct points for LOW connection', () => {
      const score = computeStoryConnectionScore(
        'LOW',
        DEFAULT_SCORING_CONFIG.selfStoryPoints
      );
      expect(score).toBe(5);
    });

    it('should return correct points for MEDIUM connection', () => {
      const score = computeStoryConnectionScore(
        'MEDIUM',
        DEFAULT_SCORING_CONFIG.selfStoryPoints
      );
      expect(score).toBe(10);
    });

    it('should return correct points for HIGH connection', () => {
      const score = computeStoryConnectionScore(
        'HIGH',
        DEFAULT_SCORING_CONFIG.selfStoryPoints
      );
      expect(score).toBe(15);
    });

    it('should work with othersStoryPoints table', () => {
      expect(
        computeStoryConnectionScore('LOW', DEFAULT_SCORING_CONFIG.othersStoryPoints)
      ).toBe(3);
      expect(
        computeStoryConnectionScore('MEDIUM', DEFAULT_SCORING_CONFIG.othersStoryPoints)
      ).toBe(8);
      expect(
        computeStoryConnectionScore('HIGH', DEFAULT_SCORING_CONFIG.othersStoryPoints)
      ).toBe(12);
    });

    it('should work with custom points table', () => {
      const customTable = { LOW: 1, MEDIUM: 5, HIGH: 20 };
      expect(computeStoryConnectionScore('LOW', customTable)).toBe(1);
      expect(computeStoryConnectionScore('MEDIUM', customTable)).toBe(5);
      expect(computeStoryConnectionScore('HIGH', customTable)).toBe(20);
    });
  });

  describe('computeConnectionScore', () => {
    it('should return 3 points for OTHERS connection', () => {
      const score = computeConnectionScore('OTHERS', DEFAULT_SCORING_CONFIG);
      expect(score).toBe(3);
    });

    it('should return 1 point for SELF connection', () => {
      const score = computeConnectionScore('SELF', DEFAULT_SCORING_CONFIG);
      expect(score).toBe(1);
    });

    it('should return 0 points for NONE connection', () => {
      const score = computeConnectionScore('NONE', DEFAULT_SCORING_CONFIG);
      expect(score).toBe(0);
    });

    it('should work with custom config', () => {
      const customConfig: ScoringConfig = {
        ...DEFAULT_SCORING_CONFIG,
        connectionPoints: {
          others: 10,
          self: 5,
          none: 0,
        },
      };
      expect(computeConnectionScore('OTHERS', customConfig)).toBe(10);
      expect(computeConnectionScore('SELF', customConfig)).toBe(5);
      expect(computeConnectionScore('NONE', customConfig)).toBe(0);
    });

    it('should handle all ConnectionScoreType values', () => {
      const types: ConnectionScoreType[] = ['OTHERS', 'SELF', 'NONE'];
      const expectedScores = [3, 1, 0];

      types.forEach((type, index) => {
        expect(computeConnectionScore(type, DEFAULT_SCORING_CONFIG)).toBe(
          expectedScores[index]
        );
      });
    });
  });

  describe('computeHeadlineScore', () => {
    const baseInput: HeadlineScoringInput = {
      plausibilityLevel: 3,
      selectedBand: 3,
      connectionType: 'OTHERS',
      aiPlanetRankings: ['MARS', 'VENUS', 'EARTH'],
      roundNo: 1,
    };

    it('should compute correct total with OTHERS connection', () => {
      const planetBonus = 15; // P1
      const breakdown = computeHeadlineScore(
        baseInput,
        planetBonus,
        DEFAULT_SCORING_CONFIG
      );

      expect(breakdown.baseline).toBe(10); // B
      expect(breakdown.plausibility).toBe(2); // A1 (level 3)
      expect(breakdown.connectionScore).toBe(3); // OTHERS = 3 pts
      expect(breakdown.selfStory).toBe(0); // Deprecated
      expect(breakdown.othersStory).toBe(0); // Deprecated
      expect(breakdown.planetBonus).toBe(15); // P1
      expect(breakdown.total).toBe(10 + 2 + 3 + 15);
      expect(breakdown.total).toBe(30);
    });

    it('should compute correctly with SELF connection', () => {
      const selfInput: HeadlineScoringInput = {
        ...baseInput,
        connectionType: 'SELF',
      };
      const breakdown = computeHeadlineScore(
        selfInput,
        0,
        DEFAULT_SCORING_CONFIG
      );

      expect(breakdown.connectionScore).toBe(1); // SELF = 1 pt
      expect(breakdown.total).toBe(10 + 2 + 1 + 0);
      expect(breakdown.total).toBe(13);
    });

    it('should compute correctly with NONE connection', () => {
      const noneInput: HeadlineScoringInput = {
        ...baseInput,
        connectionType: 'NONE',
      };
      const breakdown = computeHeadlineScore(
        noneInput,
        0,
        DEFAULT_SCORING_CONFIG
      );

      expect(breakdown.connectionScore).toBe(0); // NONE = 0 pts
      expect(breakdown.total).toBe(10 + 2 + 0 + 0);
      expect(breakdown.total).toBe(12);
    });

    it('should compute correctly with zero planet bonus', () => {
      const breakdown = computeHeadlineScore(
        baseInput,
        0,
        DEFAULT_SCORING_CONFIG
      );

      expect(breakdown.planetBonus).toBe(0);
      expect(breakdown.total).toBe(10 + 2 + 3 + 0);
      expect(breakdown.total).toBe(15);
    });

    it('should compute correctly with different plausibility levels (AI assessment)', () => {
      // Scoring is based on plausibilityLevel (AI assessment), not selectedBand (dice roll)
      const inputLevel1: HeadlineScoringInput = {
        ...baseInput,
        plausibilityLevel: 1,
      };
      const breakdown1 = computeHeadlineScore(inputLevel1, 0, DEFAULT_SCORING_CONFIG);
      expect(breakdown1.plausibility).toBe(0); // Level 1 = 0 points

      const inputLevel2: HeadlineScoringInput = {
        ...baseInput,
        plausibilityLevel: 2,
      };
      const breakdown2 = computeHeadlineScore(inputLevel2, 0, DEFAULT_SCORING_CONFIG);
      expect(breakdown2.plausibility).toBe(1); // Level 2 = near target

      const inputLevel5: HeadlineScoringInput = {
        ...baseInput,
        plausibilityLevel: 5,
      };
      const breakdown5 = computeHeadlineScore(inputLevel5, 0, DEFAULT_SCORING_CONFIG);
      expect(breakdown5.plausibility).toBe(0); // Level 5 = 0 points
    });

    it('should react to config changes for connection points', () => {
      const customConfig: ScoringConfig = {
        ...DEFAULT_SCORING_CONFIG,
        baselineB: 5,
        connectionPoints: { others: 10, self: 5, none: 0 },
      };

      const breakdown = computeHeadlineScore(baseInput, 10, customConfig);

      expect(breakdown.baseline).toBe(5);
      expect(breakdown.connectionScore).toBe(10); // OTHERS with custom config
      expect(breakdown.total).toBe(5 + 2 + 10 + 10);
      expect(breakdown.total).toBe(27);
    });

    it('should have mutually exclusive connection scoring', () => {
      // Connection score can only be 0, 1, or 3 (never combined)
      const othersBreakdown = computeHeadlineScore(
        { ...baseInput, connectionType: 'OTHERS' },
        0,
        DEFAULT_SCORING_CONFIG
      );
      expect(othersBreakdown.connectionScore).toBe(3);

      const selfBreakdown = computeHeadlineScore(
        { ...baseInput, connectionType: 'SELF' },
        0,
        DEFAULT_SCORING_CONFIG
      );
      expect(selfBreakdown.connectionScore).toBe(1);

      const noneBreakdown = computeHeadlineScore(
        { ...baseInput, connectionType: 'NONE' },
        0,
        DEFAULT_SCORING_CONFIG
      );
      expect(noneBreakdown.connectionScore).toBe(0);
    });
  });

  describe('getPlausibilityLabel', () => {
    it('should return A1 for target level', () => {
      expect(getPlausibilityLabel(3, DEFAULT_SCORING_CONFIG)).toBe('A1');
    });

    it('should return A2 for near levels', () => {
      expect(getPlausibilityLabel(2, DEFAULT_SCORING_CONFIG)).toBe('A2');
      expect(getPlausibilityLabel(4, DEFAULT_SCORING_CONFIG)).toBe('A2');
    });

    it('should return other for remaining levels', () => {
      expect(getPlausibilityLabel(1, DEFAULT_SCORING_CONFIG)).toBe('other');
      expect(getPlausibilityLabel(5, DEFAULT_SCORING_CONFIG)).toBe('other');
    });
  });

  describe('getStoryConnectionLabel', () => {
    it('should format self story labels correctly', () => {
      expect(getStoryConnectionLabel('LOW', 'X')).toBe('X_L');
      expect(getStoryConnectionLabel('MEDIUM', 'X')).toBe('X_M');
      expect(getStoryConnectionLabel('HIGH', 'X')).toBe('X_H');
    });

    it('should format others story labels correctly', () => {
      expect(getStoryConnectionLabel('LOW', 'Y')).toBe('Y_L');
      expect(getStoryConnectionLabel('MEDIUM', 'Y')).toBe('Y_M');
      expect(getStoryConnectionLabel('HIGH', 'Y')).toBe('Y_H');
    });
  });
});

