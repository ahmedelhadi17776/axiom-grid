import type { ParThresholds, Rank, ScoreReport, SimMetrics } from './types';

export const EMPTY_METRICS: Readonly<SimMetrics> = Object.freeze({
  cycles: 0,
  auxMemory: 0,
  leaks: 0,
  overflows: 0,
});

export function createEmptyMetrics(): SimMetrics {
  return {
    cycles: 0,
    auxMemory: 0,
    leaks: 0,
    overflows: 0,
  };
}

/**
 * Combines a metrics delta into a running SimMetrics tally.
 * Note: cycles, leaks, and overflows accumulate additively; auxMemory tracks
 * the peak auxiliary memory observed (or additive if delta represents a new peak).
 */
export function accumulateMetrics(
  base: SimMetrics,
  delta: Partial<SimMetrics>
): SimMetrics {
  return {
    cycles: base.cycles + (delta.cycles ?? 0),
    auxMemory:
      delta.auxMemory !== undefined
        ? Math.max(base.auxMemory, delta.auxMemory)
        : base.auxMemory,
    leaks: base.leaks + (delta.leaks ?? 0),
    overflows: base.overflows + (delta.overflows ?? 0),
  };
}

const RANK_WEIGHT: Record<Rank, number> = {
  C: 1,
  B: 2,
  A: 3,
  S: 4,
};

/**
 * Compares two ranks; returns > 0 if `a` is better than `b`, < 0 if worse, 0 if equal.
 */
export function compareRanks(a: Rank | null, b: Rank | null): number {
  const wa = a ? RANK_WEIGHT[a] : 0;
  const wb = b ? RANK_WEIGHT[b] : 0;
  return wa - wb;
}

/**
 * Evaluates a simulation run against a level's Big-O Cycle & Memory Par thresholds.
 *
 * Rules:
 * - Failing the objective yields passed: false, 0 stars, rank: null, with a diagnostic failureReason.
 * - Passing yields 1-3 stars based on cycles vs. threeStarCycles / twoStarCycles.
 * - Upgrades to S-Rank when cycles <= sRankCycles AND auxMemory <= maxAuxMemory
 *   AND no leaks or overflows occurred.
 */
export function evaluateScore(
  passed: boolean,
  metrics: SimMetrics,
  par: ParThresholds,
  insight: string,
  failureReason?: string
): ScoreReport {
  const snapshotMetrics: SimMetrics = {
    cycles: Math.max(0, metrics.cycles),
    auxMemory: Math.max(0, metrics.auxMemory),
    leaks: Math.max(0, metrics.leaks),
    overflows: Math.max(0, metrics.overflows),
  };

  if (!passed) {
    return {
      passed: false,
      stars: 0,
      rank: null,
      metrics: snapshotMetrics,
      failureReason: failureReason ?? 'Objective criteria not satisfied.',
      insight,
    };
  }

  let stars: 1 | 2 | 3;
  if (snapshotMetrics.cycles <= par.threeStarCycles) {
    stars = 3;
  } else if (snapshotMetrics.cycles <= par.twoStarCycles) {
    stars = 2;
  } else {
    stars = 1;
  }

  const meetsSRank =
    snapshotMetrics.cycles <= par.sRankCycles &&
    snapshotMetrics.auxMemory <= par.maxAuxMemory &&
    snapshotMetrics.leaks === 0 &&
    snapshotMetrics.overflows === 0;

  let rank: Rank;
  if (meetsSRank) {
    rank = 'S';
    stars = 3;
  } else if (stars === 3) {
    rank = 'A';
  } else if (stars === 2) {
    rank = 'B';
  } else {
    rank = 'C';
  }

  return {
    passed: true,
    stars,
    rank,
    metrics: snapshotMetrics,
    insight,
  };
}
