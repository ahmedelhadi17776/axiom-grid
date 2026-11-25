import { describe, expect, it } from 'vitest';
import { ALL_LEVELS, getLevelById } from '../../levels';
import { runPlayerCodeSync } from '../../sandbox/codeRunner';
import type { PathfindingWorldState } from '../types';

describe('Curriculum levels (ALL_LEVELS)', () => {
  it('contains all 16 handcrafted levels with unique IDs and codes', () => {
    expect(ALL_LEVELS).toHaveLength(16);
    const ids = new Set(ALL_LEVELS.map((l) => l.id));
    const codes = new Set(ALL_LEVELS.map((l) => l.code));
    expect(ids.size).toBe(16);
    expect(codes.size).toBe(16);
  });

  for (const level of ALL_LEVELS) {
    it(`Level ${level.code} (${level.title}) referenceSolution achieves 3-star S-Rank`, () => {
      const result = runPlayerCodeSync(level, level.referenceSolution);
      expect(result.error).toBeUndefined();
      expect(result.ok).toBe(true);
      expect(result.score).toBeDefined();
      expect(result.score?.passed).toBe(true);
      expect(result.score?.stars).toBe(3);
      expect(result.score?.rank).toBe('S');
    });
  }
});

describe('Curriculum negative / constraint tests', () => {
  it('Level 2.1: linking n2->n3 before n3->n4 causes a memory leak and fails strictNoLeaks', () => {
    const level21 = getLevelById('linked-lists-1')!;
    expect(level21).toBeDefined();

    const leakyCode = `
      api.link('n2', 'n3');
      api.link('n3', 'n4');
    `;
    const result = runPlayerCodeSync(level21, leakyCode);
    expect(result.ok).toBe(true);
    expect(result.metrics.leaks).toBeGreaterThan(0);
    expect(result.events.some((e) => e.type === 'MEMORY_LEAK')).toBe(true);
    expect(result.score?.passed).toBe(false);
    expect(result.score?.stars).toBe(0);
    expect(result.score?.rank).toBeNull();
  });

  it('Level 4.2: running BFS on the weighted grid fails cost par', () => {
    const level42 = getLevelById('pathfinding-2')!;
    expect(level42).toBeDefined();

    const bfsCode = `
      api.setAlgorithm('bfs');
      api.runSearch();
    `;
    const result = runPlayerCodeSync(level42, bfsCode);
    expect(result.ok).toBe(true);
    const finalState = result.finalState as PathfindingWorldState;
    expect(finalState.pathFound).toBe(true);
    expect(finalState.pathCost).toBeGreaterThan(9);
    expect(result.score?.passed).toBe(false);
    expect(result.score?.failureReason).toMatch(/cost/i);
  });

  it('Level 4.3: running Dijkstra on the 10x10 arena exceeds visited par', () => {
    const level43 = getLevelById('pathfinding-3')!;
    expect(level43).toBeDefined();

    const dijkstraCode = `
      api.setAlgorithm('dijkstra');
      api.runSearch();
    `;
    const result = runPlayerCodeSync(level43, dijkstraCode);
    expect(result.ok).toBe(true);
    const finalState = result.finalState as PathfindingWorldState;
    expect(finalState.pathFound).toBe(true);
    expect(finalState.visitedCount).toBeGreaterThan(45);
    expect(result.score?.passed).toBe(false);
    expect(result.score?.failureReason).toMatch(/explored/i);
  });
});
