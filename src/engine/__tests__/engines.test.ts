import { describe, expect, it } from 'vitest';
import {
  applyDirectAction,
  createArraysSession,
  createLinkedListSession,
  createPathfindingSession,
  createStacksQueuesSession,
} from '../worlds';
import { runPlayerCodeSync } from '../../sandbox/codeRunner';
import { ARRAYS_LEVELS } from '../../levels/arraysLevels';
import type {
  ArraysWorldState,
  GridCell,
  LinkedListWorldState,
  PathfindingWorldState,
  StacksQueuesWorldState,
} from '../types';

function makeArraysState(values: number[]): ArraysWorldState {
  return {
    world: 'arrays',
    slots: values.map((v, i) => ({ id: `slot-${i}`, value: v, state: 'idle' })),
    pointers: {},
  };
}

function makeLinkedListState(): LinkedListWorldState {
  return {
    world: 'linked-lists',
    headId: 'n1',
    cursors: { curr: 'n1' },
    nodes: {
      n1: { id: 'n1', value: 10, nextId: 'n2', pos: [-4, 0, 0] },
      n2: { id: 'n2', value: 20, nextId: 'n4', pos: [-1, 0, 0] },
      n3: { id: 'n3', value: 30, nextId: null, pos: [1, 0, -2] },
      n4: { id: 'n4', value: 40, nextId: null, pos: [4, 0, 0] },
    },
  };
}

function makeStacksQueuesState(capacity = 2): StacksQueuesWorldState {
  return {
    world: 'stacks-queues',
    inputStream: [
      { id: 'p1', value: 'A', color: '#00F0FF' },
      { id: 'p2', value: 'B', color: '#FFB800' },
      { id: 'p3', value: 'C', color: '#A855F7' },
    ],
    buffers: {
      stk: {
        id: 'stk',
        kind: 'stack',
        label: 'Stack A',
        capacity,
        items: [],
      },
      que: {
        id: 'que',
        kind: 'queue',
        label: 'Queue B',
        capacity,
        items: [],
      },
    },
    outputEmitted: [],
    targetManifest: ['A', 'B', 'C'],
  };
}

function makePathfindingGrid(opts: {
  width: number;
  height: number;
  start: [number, number];
  goal: [number, number];
  walls?: [number, number][];
  weights?: [number, number, number][];
  algorithm?: 'bfs' | 'dijkstra' | 'astar';
}): PathfindingWorldState {
  const wallSet = new Set((opts.walls ?? []).map(([x, y]) => `${x},${y}`));
  const weightMap = new Map(
    (opts.weights ?? []).map(([x, y, w]) => [`${x},${y}`, w])
  );
  const cells: GridCell[] = [];
  for (let y = 0; y < opts.height; y++) {
    for (let x = 0; x < opts.width; x++) {
      const key = `${x},${y}`;
      if (x === opts.start[0] && y === opts.start[1]) {
        cells.push({ x, y, type: 'start', weight: 1 });
      } else if (x === opts.goal[0] && y === opts.goal[1]) {
        cells.push({ x, y, type: 'goal', weight: 1 });
      } else if (wallSet.has(key)) {
        cells.push({ x, y, type: 'wall', weight: 1 });
      } else if (weightMap.has(key)) {
        cells.push({ x, y, type: 'weighted', weight: weightMap.get(key)! });
      } else {
        cells.push({ x, y, type: 'open', weight: 1 });
      }
    }
  }
  return {
    world: 'pathfinding',
    width: opts.width,
    height: opts.height,
    cells,
    algorithm: opts.algorithm ?? 'bfs',
    start: opts.start,
    goal: opts.goal,
    pathCost: 0,
    visitedCount: 0,
    peakFrontier: 0,
    pathFound: false,
  };
}

describe('Arrays engine', () => {
  it('supports get, compare, swap, pointers, window, and BOUNDS_FAULT', () => {
    const session = createArraysSession(makeArraysState([30, 10, 20, 40]));
    expect(session.length).toBe(4);
    expect(session.get(0)).toBe(30);

    expect(session.compare(0, 1)).toBe(1);
    expect(session.compare(1, 0)).toBe(-1);
    expect(session.compare(2, 2)).toBe(0);

    session.swap(0, 1);
    expect(session.getState().slots.map((s) => s.value)).toEqual([10, 30, 20, 40]);

    session.setPointer('left', 0);
    session.setPointer('right', 3);
    expect(session.getState().pointers).toEqual({ left: 0, right: 3 });

    session.markWindow(1, 2);
    const afterWindow = session.getState();
    expect(afterWindow.window).toEqual([1, 2]);
    expect(afterWindow.slots[1].state).toBe('window');
    expect(afterWindow.slots[2].state).toBe('window');

    // Out-of-bounds triggers BOUNDS_FAULT
    const nanVal = session.get(99);
    expect(Number.isNaN(nanVal)).toBe(true);
    session.swap(-1, 2);
    session.markWindow(3, 1);

    const faultEvents = session.getEvents().filter((e) => e.type === 'BOUNDS_FAULT');
    expect(faultEvents.length).toBe(3);
  });
});

describe('Linked List engine', () => {
  it('handles link/unlink cleanly without leaks when wired downstream-first', () => {
    const session = createLinkedListSession(makeLinkedListState());
    session.link('n3', 'n4');
    session.link('n2', 'n3');

    const state = session.getState();
    expect(state.nodes.n2.nextId).toBe('n3');
    expect(state.nodes.n3.nextId).toBe('n4');
    expect(session.getMetrics().leaks).toBe(0);

    session.link('n4', null);
    expect(session.getEvents().some((e) => e.type === 'UNLINK')).toBe(true);
  });

  it('automatically detects MEMORY_LEAK when stranding a previously reachable node', () => {
    const session = createLinkedListSession(makeLinkedListState());
    // Strands n4 by redirecting n2 -> n3 while n3.next is null
    session.link('n2', 'n3');

    expect(session.getMetrics().leaks).toBe(1);
    expect(session.getState().nodes.n4.leaked).toBe(true);
    expect(session.getEvents().some((e) => e.type === 'MEMORY_LEAK')).toBe(true);
  });

  it('emits NULL_DEREF when advancing a null cursor', () => {
    const session = createLinkedListSession(makeLinkedListState());
    session.setCursor('probe', null);
    const result = session.advance('probe');
    expect(result).toBeNull();
    expect(session.getEvents().some((e) => e.type === 'NULL_DEREF')).toBe(true);
  });

  it('detects cycles via detectCycle and Floyd stepProbe, and marks cycleSevered on break', () => {
    const cyclicState: LinkedListWorldState = {
      world: 'linked-lists',
      headId: 'n1',
      cursors: {},
      hasCycle: true,
      nodes: {
        n1: { id: 'n1', value: 1, nextId: 'n2', pos: [-4, 0, 0] },
        n2: { id: 'n2', value: 2, nextId: 'n3', pos: [-2, 0, 0] },
        n3: { id: 'n3', value: 3, nextId: 'n4', pos: [0, 0, 0] },
        n4: { id: 'n4', value: 4, nextId: 'n2', pos: [2, 0, 0] },
      },
    };
    const session = createLinkedListSession(cyclicState);
    expect(session.detectCycle().hasCycle).toBe(true);

    let met = false;
    for (let i = 0; i < 10 && !met; i++) {
      met = session.stepProbe('slow', 'fast');
    }
    expect(met).toBe(true);
    expect(session.getEvents().some((e) => e.type === 'CYCLE_DETECTED')).toBe(true);

    // Sever back-edge
    session.link('n4', null);
    expect(session.detectCycle().hasCycle).toBe(false);
    expect(session.getState().cycleSevered).toBe(true);
  });
});

describe('Stacks & Queues engine', () => {
  it('enforces LIFO on stacks and FIFO on queues and tracks peak auxMemory', () => {
    const session = createStacksQueuesSession(makeStacksQueuesState(3));
    expect(session.intake('stk')).toBe(true); // A
    expect(session.intake('stk')).toBe(true); // B
    expect(session.intake('que')).toBe(true); // C
    expect(session.getMetrics().auxMemory).toBe(3);

    // LIFO stack emits B then A
    expect(session.emit('stk')).toBe('B');
    expect(session.emit('stk')).toBe('A');
    // FIFO queue emits C
    expect(session.emit('que')).toBe('C');

    expect(session.getState().outputEmitted.map((p) => p.value)).toEqual([
      'B',
      'A',
      'C',
    ]);
    // Peak auxMemory remains 3 even after buffers are drained
    expect(session.getMetrics().auxMemory).toBe(3);
  });

  it('emits OVERFLOW on full buffer and UNDERFLOW on empty buffer', () => {
    const session = createStacksQueuesSession(makeStacksQueuesState(2));

    // Underflow on empty emit & transfer
    expect(session.emit('stk')).toBeNull();
    expect(session.transfer('stk', 'que')).toBe(false);

    // Fill stack to capacity 2, then trigger overflow on 3rd intake
    expect(session.intake('stk')).toBe(true);
    expect(session.intake('stk')).toBe(true);
    expect(session.intake('stk')).toBe(false);

    expect(session.getMetrics().overflows).toBe(1);
    expect(session.getState().buffers.stk.overflowed).toBe(true);
    expect(session.getEvents().some((e) => e.type === 'OVERFLOW')).toBe(true);
    expect(
      session.getEvents().filter((e) => e.type === 'UNDERFLOW').length
    ).toBe(2);
  });
});

describe('Pathfinding engine', () => {
  it('finds shortest hops with BFS on an unweighted grid', () => {
    const grid = makePathfindingGrid({
      width: 5,
      height: 5,
      start: [0, 0],
      goal: [4, 0],
      walls: [
        [2, 0],
        [2, 1],
      ],
      algorithm: 'bfs',
    });
    const session = createPathfindingSession(grid);
    const res = session.runSearch();
    expect(res.pathFound).toBe(true);
    // Detour around 2-high wall: down 2, right 4, up 2 = 8 hops
    expect(res.pathCost).toBe(8);
    expect(session.getEvents().some((e) => e.type === 'PATH_FOUND')).toBe(true);
  });

  it('proves Dijkstra beats BFS on a weighted grid', () => {
    const weightedGrid = makePathfindingGrid({
      width: 6,
      height: 4,
      start: [0, 2],
      goal: [5, 2],
      weights: [
        [2, 2, 10],
        [3, 2, 10],
      ],
    });
    const session = createPathfindingSession(weightedGrid);
    const comparison = session.compareAllAlgorithms();
    const bfs = comparison.find((r) => r.algorithm === 'bfs')!;
    const dijkstra = comparison.find((r) => r.algorithm === 'dijkstra')!;
    const astar = comparison.find((r) => r.algorithm === 'astar')!;

    expect(bfs.pathFound).toBe(true);
    expect(dijkstra.pathFound).toBe(true);
    expect(astar.pathFound).toBe(true);
    expect(dijkstra.pathCost).toBeLessThan(bfs.pathCost);
    expect(astar.pathCost).toBe(dijkstra.pathCost);
  });

  it('proves A* visits fewer nodes than Dijkstra on an open arena', () => {
    const openGrid = makePathfindingGrid({
      width: 10,
      height: 10,
      start: [1, 5],
      goal: [8, 5],
      walls: [
        [4, 4],
        [4, 5],
        [4, 6],
      ],
    });
    const session = createPathfindingSession(openGrid);
    const [bfs, dijkstra, astar] = session.compareAllAlgorithms();

    expect(bfs.algorithm).toBe('bfs');
    expect(dijkstra.algorithm).toBe('dijkstra');
    expect(astar.algorithm).toBe('astar');
    expect(astar.pathFound).toBe(true);
    expect(astar.pathCost).toBe(dijkstra.pathCost);
    expect(astar.visitedCount).toBeLessThan(dijkstra.visitedCount);
  });

  it('emits NO_PATH when the goal is completely walled off', () => {
    const blocked = makePathfindingGrid({
      width: 4,
      height: 4,
      start: [0, 0],
      goal: [3, 3],
      walls: [
        [2, 0],
        [2, 1],
        [2, 2],
        [2, 3],
      ],
      algorithm: 'astar',
    });
    const session = createPathfindingSession(blocked);
    const res = session.runSearch();
    expect(res.pathFound).toBe(false);
    expect(res.pathCost).toBe(0);
    expect(session.getEvents().some((e) => e.type === 'NO_PATH')).toBe(true);
  });
});

describe('Code Runner (runPlayerCodeSync)', () => {
  const sampleLevel = ARRAYS_LEVELS[0];

  it('returns errorType SYNTAX on syntax errors', () => {
    const res = runPlayerCodeSync(sampleLevel, 'function broken( {');
    expect(res.ok).toBe(false);
    expect(res.errorType).toBe('SYNTAX');
    expect(res.error).toBeTruthy();
  });

  it('returns errorType RUNTIME on uncaught runtime errors', () => {
    const res = runPlayerCodeSync(sampleLevel, 'throw new Error("boom");');
    expect(res.ok).toBe(false);
    expect(res.errorType).toBe('RUNTIME');
    expect(res.error).toContain('boom');
  });

  it('triggers errorType OP_LIMIT on excessive API call loops', () => {
    const res = runPlayerCodeSync(
      sampleLevel,
      'for (let i = 0; i < 5000; i++) api.get(0);'
    );
    expect(res.ok).toBe(false);
    expect(res.errorType).toBe('OP_LIMIT');
    expect(res.error).toMatch(/Thermal Overload/i);
  });
});

describe('applyDirectAction across all 4 worlds', () => {
  it('applies direct actions for arrays', () => {
    const initial = makeArraysState([9, 4, 7]);
    const swapped = applyDirectAction(initial, {
      world: 'arrays',
      type: 'SWAP',
      payload: { i: 0, j: 1 },
    });
    expect((swapped.state as ArraysWorldState).slots.map((s) => s.value)).toEqual([
      4, 9, 7,
    ]);
    expect(swapped.metrics.cycles).toBe(1);

    const windowed = applyDirectAction(
      swapped.state,
      {
        world: 'arrays',
        type: 'SET_WINDOW',
        payload: { left: 0, right: 1 },
      },
      swapped.metrics
    );
    expect((windowed.state as ArraysWorldState).window).toEqual([0, 1]);
    expect(windowed.metrics.cycles).toBe(2);
  });

  it('applies direct actions for linked-lists', () => {
    const initial = makeLinkedListState();
    const r1 = applyDirectAction(initial, {
      world: 'linked-lists',
      type: 'LINK',
      payload: { fromId: 'n3', toId: 'n4' },
    });
    const r2 = applyDirectAction(
      r1.state,
      {
        world: 'linked-lists',
        type: 'LINK',
        payload: { fromId: 'n2', toId: 'n3' },
      },
      r1.metrics
    );
    const llState = r2.state as LinkedListWorldState;
    expect(llState.nodes.n2.nextId).toBe('n3');
    expect(llState.nodes.n3.nextId).toBe('n4');
    expect(r2.metrics.leaks).toBe(0);
  });

  it('applies direct actions for stacks-queues', () => {
    const initial = makeStacksQueuesState(3);
    const r1 = applyDirectAction(initial, {
      world: 'stacks-queues',
      type: 'INTAKE',
      payload: { bufferId: 'stk' },
    });
    const r2 = applyDirectAction(
      r1.state,
      {
        world: 'stacks-queues',
        type: 'TRANSFER',
        payload: { fromId: 'stk', toId: 'que' },
      },
      r1.metrics
    );
    const r3 = applyDirectAction(
      r2.state,
      {
        world: 'stacks-queues',
        type: 'EMIT',
        payload: { bufferId: 'que' },
      },
      r2.metrics
    );
    const sqState = r3.state as StacksQueuesWorldState;
    expect(sqState.outputEmitted.map((p) => p.value)).toEqual(['A']);
    expect(r3.metrics.cycles).toBe(3);
  });

  it('applies direct actions for pathfinding', () => {
    const initial = makePathfindingGrid({
      width: 5,
      height: 5,
      start: [0, 0],
      goal: [4, 4],
    });
    const r1 = applyDirectAction(initial, {
      world: 'pathfinding',
      type: 'TOGGLE_CELL',
      payload: { x: 2, y: 2, tool: 'wall' },
    });
    const r2 = applyDirectAction(r1.state, {
      world: 'pathfinding',
      type: 'SET_ALGORITHM',
      payload: { algorithm: 'astar' },
    });
    const r3 = applyDirectAction(r2.state, {
      world: 'pathfinding',
      type: 'RUN_SEARCH',
    });
    const pfState = r3.state as PathfindingWorldState;
    expect(pfState.algorithm).toBe('astar');
    expect(pfState.pathFound).toBe(true);
    expect(pfState.pathCost).toBe(8);
  });
});
