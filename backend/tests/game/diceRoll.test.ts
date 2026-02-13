/**
 * Unit tests for dice roll functions.
 */

import {
  mapRollToBand,
  rollDice,
  selectHeadline,
  rollAndSelectHeadline,
} from '../../src/game/diceRoll';
import { HeadlineBands } from '../../src/llm/jurorPrompt';

describe('Dice Roll Functions', () => {
  describe('mapRollToBand', () => {
    // Weighted boundaries: 3:5:8:3:1 ratio
    // Band 1: 0-14 (15%), Band 2: 15-39 (25%), Band 3: 40-79 (40%), Band 4: 80-94 (15%), Band 5: 95-100 (5%)

    describe('Band 1 (inevitable): 0-14', () => {
      it('should map 0 to band 1', () => {
        expect(mapRollToBand(0)).toBe(1);
      });

      it('should map 7 to band 1', () => {
        expect(mapRollToBand(7)).toBe(1);
      });

      it('should map 14 to band 1', () => {
        expect(mapRollToBand(14)).toBe(1);
      });
    });

    describe('Band 2 (probable): 15-39', () => {
      it('should map 15 to band 2', () => {
        expect(mapRollToBand(15)).toBe(2);
      });

      it('should map 27 to band 2', () => {
        expect(mapRollToBand(27)).toBe(2);
      });

      it('should map 39 to band 2', () => {
        expect(mapRollToBand(39)).toBe(2);
      });
    });

    describe('Band 3 (plausible): 40-79', () => {
      it('should map 40 to band 3', () => {
        expect(mapRollToBand(40)).toBe(3);
      });

      it('should map 60 to band 3', () => {
        expect(mapRollToBand(60)).toBe(3);
      });

      it('should map 79 to band 3', () => {
        expect(mapRollToBand(79)).toBe(3);
      });
    });

    describe('Band 4 (possible): 80-94', () => {
      it('should map 80 to band 4', () => {
        expect(mapRollToBand(80)).toBe(4);
      });

      it('should map 87 to band 4', () => {
        expect(mapRollToBand(87)).toBe(4);
      });

      it('should map 94 to band 4', () => {
        expect(mapRollToBand(94)).toBe(4);
      });
    });

    describe('Band 5 (preposterous): 95-100', () => {
      it('should map 95 to band 5', () => {
        expect(mapRollToBand(95)).toBe(5);
      });

      it('should map 97 to band 5', () => {
        expect(mapRollToBand(97)).toBe(5);
      });

      it('should map 100 to band 5', () => {
        expect(mapRollToBand(100)).toBe(5);
      });
    });

    describe('Boundary conditions', () => {
      it('should correctly map all boundary values', () => {
        // Band boundaries: 0-14, 15-39, 40-79, 80-94, 95-100
        expect(mapRollToBand(0)).toBe(1);
        expect(mapRollToBand(14)).toBe(1);
        expect(mapRollToBand(15)).toBe(2);
        expect(mapRollToBand(39)).toBe(2);
        expect(mapRollToBand(40)).toBe(3);
        expect(mapRollToBand(79)).toBe(3);
        expect(mapRollToBand(80)).toBe(4);
        expect(mapRollToBand(94)).toBe(4);
        expect(mapRollToBand(95)).toBe(5);
        expect(mapRollToBand(100)).toBe(5);
      });
    });

    describe('Error handling', () => {
      it('should throw for negative values', () => {
        expect(() => mapRollToBand(-1)).toThrow('Roll must be between 0 and 100');
      });

      it('should throw for values over 100', () => {
        expect(() => mapRollToBand(101)).toThrow('Roll must be between 0 and 100');
      });

      it('should throw for large values', () => {
        expect(() => mapRollToBand(1000)).toThrow('Roll must be between 0 and 100');
      });
    });
  });

  describe('rollDice', () => {
    it('should return a roll between 0 and 100', () => {
      // Run multiple times to test randomness
      for (let i = 0; i < 100; i++) {
        const result = rollDice();
        expect(result.roll).toBeGreaterThanOrEqual(0);
        expect(result.roll).toBeLessThanOrEqual(100);
      }
    });

    it('should return an integer roll', () => {
      for (let i = 0; i < 50; i++) {
        const result = rollDice();
        expect(Number.isInteger(result.roll)).toBe(true);
      }
    });

    it('should return a band between 1 and 5', () => {
      for (let i = 0; i < 100; i++) {
        const result = rollDice();
        expect(result.band).toBeGreaterThanOrEqual(1);
        expect(result.band).toBeLessThanOrEqual(5);
      }
    });

    it('should return consistent roll-to-band mapping', () => {
      for (let i = 0; i < 50; i++) {
        const result = rollDice();
        // Verify the band matches what mapRollToBand would return
        expect(result.band).toBe(mapRollToBand(result.roll));
      }
    });
  });

  describe('selectHeadline', () => {
    const testBands: HeadlineBands = {
      band1: 'AI System Achieves Human-Level Performance',
      band2: 'AI System Shows Strong Progress Toward Human-Level Tasks',
      band3: 'Researchers Report AI Advances in Complex Problem Solving',
      band4: 'New AI Approach May Lead to Breakthroughs in Reasoning',
      band5: 'Revolutionary AI Claims to Surpass All Human Intelligence',
    };

    it('should select band1 headline for band 1', () => {
      expect(selectHeadline(testBands, 1)).toBe(testBands.band1);
    });

    it('should select band2 headline for band 2', () => {
      expect(selectHeadline(testBands, 2)).toBe(testBands.band2);
    });

    it('should select band3 headline for band 3', () => {
      expect(selectHeadline(testBands, 3)).toBe(testBands.band3);
    });

    it('should select band4 headline for band 4', () => {
      expect(selectHeadline(testBands, 4)).toBe(testBands.band4);
    });

    it('should select band5 headline for band 5', () => {
      expect(selectHeadline(testBands, 5)).toBe(testBands.band5);
    });

    it('should work with all bands in sequence', () => {
      const bands = [1, 2, 3, 4, 5] as const;
      const expectedHeadlines = [
        testBands.band1,
        testBands.band2,
        testBands.band3,
        testBands.band4,
        testBands.band5,
      ];

      bands.forEach((band, index) => {
        expect(selectHeadline(testBands, band)).toBe(expectedHeadlines[index]);
      });
    });
  });

  describe('rollAndSelectHeadline', () => {
    const testBands: HeadlineBands = {
      band1: 'Inevitable Headline',
      band2: 'Probable Headline',
      band3: 'Plausible Headline',
      band4: 'Possible Headline',
      band5: 'Preposterous Headline',
    };

    it('should return roll, band, and selectedHeadline', () => {
      const result = rollAndSelectHeadline(testBands);

      expect(result).toHaveProperty('roll');
      expect(result).toHaveProperty('band');
      expect(result).toHaveProperty('selectedHeadline');
    });

    it('should return valid roll range', () => {
      for (let i = 0; i < 50; i++) {
        const result = rollAndSelectHeadline(testBands);
        expect(result.roll).toBeGreaterThanOrEqual(0);
        expect(result.roll).toBeLessThanOrEqual(100);
      }
    });

    it('should return valid band', () => {
      for (let i = 0; i < 50; i++) {
        const result = rollAndSelectHeadline(testBands);
        expect(result.band).toBeGreaterThanOrEqual(1);
        expect(result.band).toBeLessThanOrEqual(5);
      }
    });

    it('should select headline matching the rolled band', () => {
      for (let i = 0; i < 50; i++) {
        const result = rollAndSelectHeadline(testBands);
        const expectedHeadline = selectHeadline(testBands, result.band);
        expect(result.selectedHeadline).toBe(expectedHeadline);
      }
    });

    it('should have consistent mapping between roll and band', () => {
      for (let i = 0; i < 50; i++) {
        const result = rollAndSelectHeadline(testBands);
        expect(result.band).toBe(mapRollToBand(result.roll));
      }
    });
  });

  describe('Statistical distribution (sanity check)', () => {
    it('should produce all bands over many rolls', () => {
      const bandCounts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

      // Roll 500 times
      for (let i = 0; i < 500; i++) {
        const result = rollDice();
        bandCounts[result.band]++;
      }

      // Each band should appear at least once (very likely with 500 rolls)
      expect(bandCounts[1]).toBeGreaterThan(0);
      expect(bandCounts[2]).toBeGreaterThan(0);
      expect(bandCounts[3]).toBeGreaterThan(0);
      expect(bandCounts[4]).toBeGreaterThan(0);
      expect(bandCounts[5]).toBeGreaterThan(0);
    });
  });
});
