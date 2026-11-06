import { describe, expect, it } from 'vitest';
import { computeScores, elementAward, formatTime } from './scoring';

describe('high bar scoring', () => {
  it('calculates D, E and final score', () => {
    const result = computeScores([
      { difficulty: 'D', group: 'I', recognized: true, deduction: 0.1, connection: 0 },
      { difficulty: 'E', group: 'II', recognized: true, deduction: 0.3, connection: 0.1 },
      { difficulty: 'C', group: 'III', recognized: true, deduction: 0, connection: 0 },
      { difficulty: 'D', group: 'IV', recognized: true, deduction: 0.1, connection: 0 },
    ], 0.1, true);
    expect(result.dScore).toBeCloseTo(3.5);
    expect(result.eScore).toBeCloseTo(9.5);
    expect(result.finalScore).toBeCloseTo(12.9);
  });

  it('formats timestamps', () => expect(formatTime(72)).toBe('01:12'));

  it('shows per-element maximum and teaching award', () => {
    expect(elementAward({ difficulty: 'E', recognized: true, deduction: 0.3 })).toEqual({ maximum: 0.5, difficultyAward: 0.5, teachingAward: 0.2 });
  });
});
