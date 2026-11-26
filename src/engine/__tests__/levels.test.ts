import { describe, expect, it } from 'vitest';
import { ALL_LEVELS, getLevelById } from '../../levels';
import { runPlayerCodeSync } from '../../sandbox/codeRunner';
import type {
  HashTableWorldState,
  PathfindingWorldState,
  TreesWorldState,
} from '../types';

describe('Curriculum levels (ALL_LEVELS)', () => {
  it('contains all 48 handcrafted levels with unique IDs, codes, and progressive hints', () => {
    expect(ALL_LEVELS).toHaveLength(48);
    const ids = new Set(ALL_LEVELS.map((l) => l.id));
    const codes = new Set(ALL_LEVELS.map((l) => l.code));
    expect(ids.size).toBe(48);
    expect(codes.size).toBe(48);

    for (const level of ALL_LEVELS) {
      expect(Array.isArray(level.hints)).toBe(true);
      expect(level.hints!.length).toBeGreaterThanOrEqual(2);
    }
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
  it('Level 1.5: linear scan exceeds cycle budget and fails binary-search', () => {
    const level15 = getLevelById('arrays-5')!;
    expect(level15).toBeDefined();

    const linearCode = `
      for (let i = 0; i < api.length; i++) {
        if (api.probe(i) === 0) break;
      }
    `;
    const result = runPlayerCodeSync(level15, linearCode);
    expect(result.ok).toBe(true);
    expect(result.metrics.cycles).toBeGreaterThan(5);
    expect(result.score?.passed).toBe(false);
    expect(result.score?.failureReason).toMatch(/budget/i);
  });

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

  it('Level 4.5: Greedy Best-First falls into the concave weighted trap and fails cost par', () => {
    const level45 = getLevelById('pathfinding-5')!;
    expect(level45).toBeDefined();

    const greedyCode = `
      api.setAlgorithm('greedy');
      api.runSearch();
    `;
    const result = runPlayerCodeSync(level45, greedyCode);
    expect(result.ok).toBe(true);
    const finalState = result.finalState as PathfindingWorldState;
    expect(finalState.pathFound).toBe(true);
    expect(finalState.pathCost).toBeGreaterThan(13);
    expect(result.score?.passed).toBe(false);
    expect(result.score?.failureReason).toMatch(/greedy|cost/i);
  });

  it('Level 4.6: single-source BFS exceeds visited budget on the 12x12 arena', () => {
    const level46 = getLevelById('pathfinding-6')!;
    expect(level46).toBeDefined();

    const bfsCode = `
      api.setAlgorithm('bfs');
      api.runSearch();
    `;
    const result = runPlayerCodeSync(level46, bfsCode);
    expect(result.ok).toBe(true);
    const finalState = result.finalState as PathfindingWorldState;
    expect(finalState.pathFound).toBe(true);
    expect(finalState.visitedCount).toBeGreaterThan(56);
    expect(result.score?.passed).toBe(false);
    expect(result.score?.failureReason).toMatch(/explored/i);
  });

  it('Level 5.2: inserting an out-of-range key into the wrong socket emits INVARIANT_FAULT and fails', () => {
    const level52 = getLevelById('trees-2')!;
    expect(level52).toBeDefined();

    const invalidInsertCode = `
      api.insertAt('t2', 'left', 35);
      while (api.pendingQueue().length > 0) {
        api.insert(api.pendingQueue()[0]);
      }
    `;
    const result = runPlayerCodeSync(level52, invalidInsertCode);
    expect(result.ok).toBe(true);
    const finalState = result.finalState as TreesWorldState;
    expect(finalState.invariantViolations).toBeGreaterThan(0);
    expect(result.events.some((e) => e.type === 'INVARIANT_FAULT')).toBe(true);
    expect(result.score?.passed).toBe(false);
    expect(result.score?.failureReason).toMatch(/invariant/i);
  });

  it('Level 5.6: leaving the skewed BST unrotated fails AVL equilibrium check', () => {
    const level56 = getLevelById('trees-6')!;
    expect(level56).toBeDefined();

    const noOpCode = `// no rotations applied`;
    const result = runPlayerCodeSync(level56, noOpCode);
    expect(result.ok).toBe(true);
    expect(result.score?.passed).toBe(false);
    expect(result.score?.failureReason).toMatch(/imbalance|BF/i);
  });

  it('Level 6.1: leaving the DP memo table incomplete fails evaluation', () => {
    const level61 = getLevelById('dp-1')!;
    expect(level61).toBeDefined();

    const partialCode = `
      api.computeCell(0, 2);
      api.computeCell(0, 3);
    `;
    const result = runPlayerCodeSync(level61, partialCode);
    expect(result.ok).toBe(true);
    expect(result.score?.passed).toBe(false);
    expect(result.score?.failureReason).toMatch(/empty|subproblem/i);
  });

  it('Level 7.3: deleting 16 without a tombstone breaks lookup(23) and fails', () => {
    const level73 = getLevelById('hash-table-3')!;
    expect(level73).toBeDefined();

    const hardDeleteCode = `
      api.remove(16, false);
      api.lookup(23);
    `;
    const result = runPlayerCodeSync(level73, hardDeleteCode);
    expect(result.ok).toBe(true);
    const finalState = result.finalState as HashTableWorldState;
    expect(finalState.foundBucket).toBeNull();
    expect(result.score?.passed).toBe(false);
  });

  it('Level 7.5: inserting keys without rehashing exceeds loadFactorThreshold and fails', () => {
    const level75 = getLevelById('hash-table-5')!;
    expect(level75).toBeDefined();

    const noRehashCode = `
      while (api.pendingKeys().length > 0) {
        const next = api.pendingKeys()[0];
        api.insert(next.key, next.value);
      }
    `;
    const result = runPlayerCodeSync(level75, noRehashCode);
    expect(result.ok).toBe(true);
    const finalState = result.finalState as HashTableWorldState;
    expect(finalState.rehashCount).toBe(0);
    expect(result.score?.passed).toBe(false);
    expect(result.score?.failureReason).toMatch(/load|rehash/i);
  });

  it('Level 8.3: unheapified array fails while api.heapify() achieves 3-star S-Rank', () => {
    const level83 = getLevelById('heap-3')!;
    expect(level83).toBeDefined();

    const failRes = runPlayerCodeSync(level83, '// do nothing');
    expect(failRes.ok).toBe(true);
    expect(failRes.score?.passed).toBe(false);

    const passRes = runPlayerCodeSync(level83, 'api.heapify();');
    expect(passRes.ok).toBe(true);
    expect(passRes.score?.passed).toBe(true);
    expect(passRes.score?.stars).toBe(3);
    expect(passRes.score?.rank).toBe('S');
  });
});
