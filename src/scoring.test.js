import { describe, expect, it } from 'vitest';
import { classifyHighBarCandidate, computeScores, elementAward, estimateVideoDifficulty, formatTime, selectMotionPeaks } from './scoring';

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

  it('selects separated motion peaks in timeline order', () => {
    const peaks = selectMotionPeaks([{time:1,score:.9},{time:1.5,score:.8},{time:4,score:.7}], 2, 1);
    expect(peaks.map((item) => item.time)).toEqual([1, 4]);
  });

  it('creates a conservative two-pass video estimate', () => {
    expect(estimateVideoDifficulty(.8, 0, 1, .9)).toEqual({ difficulty: 'E', maximum: .5, suggestedDeduction: .1, suggestedAward: .4 });
  });

  it('labels high-bar families bilingually and reserves the last peak for dismount', () => {
    const item = classifyHighBarCandidate({ normalized: .8, position: .92, isLast: true, consistency: .9 });
    expect(item).toMatchObject({ nameEn: 'Double salto dismount candidate', nameZh: '後空翻下法候選', group: 'IV', difficulty: 'E' });
  });
});
