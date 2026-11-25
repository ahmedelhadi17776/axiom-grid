import { describe, expect, it } from 'vitest';
import {
  accumulateMetrics,
  compareRanks,
  createEmptyMetrics,
  evaluateScore,
} from '../scorer';
import {
  createTimeline,
  getActiveEvent,
  getCumulativeMetrics,
  getCurrentState,
  resetTimeline,
  seekTimeline,
  setTimelinePlaying,
  setTimelineSpeed,
  stepBack,
  stepForward,
} from '../timeline';
import type { ArraysWorldState, ParThresholds, SimEvent } from '../types';

const SAMPLE_PAR: ParThresholds = {
  sRankCycles: 10,
  threeStarCycles: 15,
  twoStarCycles: 25,
  maxAuxMemory: 2,
  targetBigO: 'O(n)',
};

const INSIGHT = 'Optimal linear pass.';

describe('scorer.ts', () => {
  it('awards S-Rank and 3 stars when cycles, auxMemory, leaks, and overflows all meet par', () => {
    const report = evaluateScore(
      true,
      { cycles: 10, auxMemory: 2, leaks: 0, overflows: 0 },
      SAMPLE_PAR,
      INSIGHT
    );
    expect(report.passed).toBe(true);
    expect(report.stars).toBe(3);
    expect(report.rank).toBe('S');
    expect(report.insight).toBe(INSIGHT);
    expect(report.failureReason).toBeUndefined();
  });

  it('awards A-Rank and 3 stars when cycles are within 3-star par but exceed sRankCycles', () => {
    const report = evaluateScore(
      true,
      { cycles: 14, auxMemory: 0, leaks: 0, overflows: 0 },
      SAMPLE_PAR,
      INSIGHT
    );
    expect(report.passed).toBe(true);
    expect(report.stars).toBe(3);
    expect(report.rank).toBe('A');
  });

  it('gates S-Rank on maxAuxMemory (downgrades to A-Rank if auxMemory exceeds maxAuxMemory)', () => {
    const report = evaluateScore(
      true,
      { cycles: 8, auxMemory: 3, leaks: 0, overflows: 0 },
      SAMPLE_PAR,
      INSIGHT
    );
    expect(report.passed).toBe(true);
    expect(report.stars).toBe(3);
    expect(report.rank).toBe('A');
  });

  it('gates S-Rank on zero leaks and zero overflows', () => {
    const leaked = evaluateScore(
      true,
      { cycles: 5, auxMemory: 0, leaks: 1, overflows: 0 },
      SAMPLE_PAR,
      INSIGHT
    );
    expect(leaked.rank).toBe('A');
    expect(leaked.stars).toBe(3);

    const overflowed = evaluateScore(
      true,
      { cycles: 5, auxMemory: 0, leaks: 0, overflows: 1 },
      SAMPLE_PAR,
      INSIGHT
    );
    expect(overflowed.rank).toBe('A');
    expect(overflowed.stars).toBe(3);
  });

  it('awards B-Rank and 2 stars when cycles are between threeStarCycles and twoStarCycles', () => {
    const report = evaluateScore(
      true,
      { cycles: 20, auxMemory: 0, leaks: 0, overflows: 0 },
      SAMPLE_PAR,
      INSIGHT
    );
    expect(report.passed).toBe(true);
    expect(report.stars).toBe(2);
    expect(report.rank).toBe('B');
  });

  it('awards C-Rank and 1 star when cycles exceed twoStarCycles', () => {
    const report = evaluateScore(
      true,
      { cycles: 40, auxMemory: 0, leaks: 0, overflows: 0 },
      SAMPLE_PAR,
      INSIGHT
    );
    expect(report.passed).toBe(true);
    expect(report.stars).toBe(1);
    expect(report.rank).toBe('C');
  });

  it('returns 0 stars and null rank on failed state with failureReason', () => {
    const customFail = evaluateScore(
      false,
      { cycles: 5, auxMemory: 0, leaks: 0, overflows: 0 },
      SAMPLE_PAR,
      INSIGHT,
      'Array not sorted.'
    );
    expect(customFail.passed).toBe(false);
    expect(customFail.stars).toBe(0);
    expect(customFail.rank).toBeNull();
    expect(customFail.failureReason).toBe('Array not sorted.');

    const defaultFail = evaluateScore(
      false,
      createEmptyMetrics(),
      SAMPLE_PAR,
      INSIGHT
    );
    expect(defaultFail.passed).toBe(false);
    expect(defaultFail.stars).toBe(0);
    expect(defaultFail.rank).toBeNull();
    expect(defaultFail.failureReason).toBeTruthy();
  });

  it('accumulates metrics additively for cycles/leaks/overflows and tracks peak auxMemory', () => {
    let m = createEmptyMetrics();
    m = accumulateMetrics(m, { cycles: 2, auxMemory: 4 });
    m = accumulateMetrics(m, { cycles: 3, auxMemory: 2, leaks: 1 });
    m = accumulateMetrics(m, { cycles: 1, auxMemory: 6, overflows: 2 });
    expect(m).toEqual({ cycles: 6, auxMemory: 6, leaks: 1, overflows: 2 });
  });

  it('compares ranks in strict order S > A > B > C > null', () => {
    expect(compareRanks('S', 'A')).toBeGreaterThan(0);
    expect(compareRanks('A', 'B')).toBeGreaterThan(0);
    expect(compareRanks('B', 'C')).toBeGreaterThan(0);
    expect(compareRanks('C', null)).toBeGreaterThan(0);
    expect(compareRanks('B', 'B')).toBe(0);
    expect(compareRanks('C', 'S')).toBeLessThan(0);
  });
});

function makeArrayState(values: number[]): ArraysWorldState {
  return {
    world: 'arrays',
    slots: values.map((v, idx) => ({ id: `s${idx}`, value: v, state: 'idle' })),
    pointers: {},
  };
}

describe('timeline.ts', () => {
  const initialState = makeArrayState([3, 1, 2]);
  const events: SimEvent<ArraysWorldState>[] = [
    {
      id: 1,
      type: 'COMPARE',
      label: 'Compare 0 and 1',
      pseudocodeLine: 1,
      targets: ['s0', 's1'],
      metricsDelta: { cycles: 1, auxMemory: 1 },
      snapshot: makeArrayState([3, 1, 2]),
    },
    {
      id: 2,
      type: 'SWAP',
      label: 'Swap 0 and 1',
      pseudocodeLine: 2,
      targets: ['s0', 's1'],
      metricsDelta: { cycles: 2, auxMemory: 3 },
      snapshot: makeArrayState([1, 3, 2]),
    },
    {
      id: 3,
      type: 'SWAP',
      label: 'Swap 1 and 2',
      pseudocodeLine: 2,
      targets: ['s1', 's2'],
      metricsDelta: { cycles: 2, auxMemory: 2 },
      snapshot: makeArrayState([1, 2, 3]),
    },
  ];

  it('initializes at cursor -1 with initialState and null active event', () => {
    const tl = createTimeline(initialState, events);
    expect(tl.cursor).toBe(-1);
    expect(tl.isPlaying).toBe(false);
    expect(tl.speed).toBe(1);
    expect(getActiveEvent(tl)).toBeNull();
    expect(getCurrentState(tl)).toEqual(initialState);
    expect(getCumulativeMetrics(tl)).toEqual(createEmptyMetrics());
  });

  it('steps forward through events, updates currentState & cumulative metrics, and auto-pauses at end', () => {
    let tl = createTimeline(initialState, events, { isPlaying: true });

    tl = stepForward(tl);
    expect(tl.cursor).toBe(0);
    expect(tl.isPlaying).toBe(true);
    expect(getActiveEvent(tl)?.id).toBe(1);
    expect(getCumulativeMetrics(tl)).toEqual({
      cycles: 1,
      auxMemory: 1,
      leaks: 0,
      overflows: 0,
    });

    tl = stepForward(tl);
    expect(tl.cursor).toBe(1);
    expect(getCurrentState(tl).slots.map((s) => s.value)).toEqual([1, 3, 2]);
    expect(getCumulativeMetrics(tl)).toEqual({
      cycles: 3,
      auxMemory: 3,
      leaks: 0,
      overflows: 0,
    });

    tl = stepForward(tl);
    expect(tl.cursor).toBe(2);
    expect(tl.isPlaying).toBe(false);
    expect(getCurrentState(tl).slots.map((s) => s.value)).toEqual([1, 2, 3]);
    expect(getCumulativeMetrics(tl)).toEqual({
      cycles: 5,
      auxMemory: 3,
      leaks: 0,
      overflows: 0,
    });

    // Stepping past the end stays clamped at last index
    const afterEnd = stepForward(tl);
    expect(afterEnd.cursor).toBe(2);
  });

  it('steps backward, clamps at -1, and pauses playback', () => {
    let tl = createTimeline(initialState, events, {
      startCursor: 2,
      isPlaying: true,
    });

    tl = stepBack(tl);
    expect(tl.cursor).toBe(1);
    expect(tl.isPlaying).toBe(false);

    tl = stepBack(tl);
    expect(tl.cursor).toBe(0);

    tl = stepBack(tl);
    expect(tl.cursor).toBe(-1);
    expect(getCurrentState(tl)).toEqual(initialState);

    tl = stepBack(tl);
    expect(tl.cursor).toBe(-1);
  });

  it('supports seekTimeline with clamping and resetTimeline', () => {
    let tl = createTimeline(initialState, events, { isPlaying: true });

    tl = seekTimeline(tl, 1);
    expect(tl.cursor).toBe(1);
    expect(getCurrentState(tl).slots.map((s) => s.value)).toEqual([1, 3, 2]);

    // Clamp above max
    tl = seekTimeline(tl, 99);
    expect(tl.cursor).toBe(2);
    expect(tl.isPlaying).toBe(false);

    // Clamp below -1
    tl = seekTimeline(tl, -50);
    expect(tl.cursor).toBe(-1);

    tl = seekTimeline(tl, 2);
    tl = resetTimeline(tl);
    expect(tl.cursor).toBe(-1);
    expect(tl.isPlaying).toBe(false);
    expect(getCurrentState(tl)).toEqual(initialState);
  });

  it('supports setTimelinePlaying (restarting from -1 when at end) and setTimelineSpeed', () => {
    let tl = createTimeline(initialState, events, { startCursor: 2 });
    tl = setTimelinePlaying(tl, true);
    expect(tl.isPlaying).toBe(true);
    expect(tl.cursor).toBe(-1);

    tl = setTimelineSpeed(tl, 4);
    expect(tl.speed).toBe(4);

    // Empty timeline cannot play
    const empty = setTimelinePlaying(createTimeline(initialState, []), true);
    expect(empty.isPlaying).toBe(false);
  });
});
