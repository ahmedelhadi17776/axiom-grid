import type {
  AnyWorldState,
  ArraysWorldState,
  GridCell,
  LinkedListWorldState,
  PathfindingWorldState,
  SandboxPreset,
  StacksQueuesWorldState,
  WorldId,
} from '../engine/types';

function makeGrid(
  width: number,
  height: number,
  start: [number, number],
  goal: [number, number],
  walls: [number, number][],
  weights: [number, number, number][],
): PathfindingWorldState {
  const wallSet = new Set(walls.map(([x, y]) => `${x},${y}`));
  const weightMap = new Map(weights.map(([x, y, w]) => [`${x},${y}`, w]));
  const cells: GridCell[] = [];

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const key = `${x},${y}`;
      if (x === start[0] && y === start[1]) {
        cells.push({ x, y, type: 'start', weight: 1 });
      } else if (x === goal[0] && y === goal[1]) {
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
    width,
    height,
    cells,
    algorithm: 'astar',
    start,
    goal,
    editableBudget: 99,
    pathCost: 0,
    visitedCount: 0,
    peakFrontier: 0,
    pathFound: false,
  };
}

const DEFAULT_ARRAYS: ArraysWorldState = {
  world: 'arrays',
  slots: [64, 22, 85, 14, 48, 33, 71, 19].map((value, idx) => ({
    id: `sb-slot-${idx}`,
    value,
    state: 'idle',
  })),
  pointers: { left: 0, right: 7 },
};

const ALMOST_SORTED_ARRAYS: ArraysWorldState = {
  world: 'arrays',
  slots: [12, 24, 36, 60, 48, 72, 84, 96].map((value, idx) => ({
    id: `sb-as-${idx}`,
    value,
    state: 'idle',
  })),
  pointers: { i: 0 },
};

const DEFAULT_LINKED_LIST: LinkedListWorldState = {
  world: 'linked-lists',
  headId: 'n1',
  cursors: { curr: 'n1' },
  hasCycle: false,
  nodes: {
    n1: { id: 'n1', value: 12, nextId: 'n2', pos: [-5.5, 0, 0] },
    n2: { id: 'n2', value: 24, nextId: 'n3', pos: [-2.75, 0, 0] },
    n3: { id: 'n3', value: 36, nextId: 'n4', pos: [0, 0, 0] },
    n4: { id: 'n4', value: 48, nextId: 'n5', pos: [2.75, 0, 0] },
    n5: { id: 'n5', value: 60, nextId: null, pos: [5.5, 0, 0] },
  },
};

const CYCLIC_TETHER_MATRIX: LinkedListWorldState = {
  world: 'linked-lists',
  headId: 'n1',
  cursors: { slow: 'n1', fast: 'n1' },
  hasCycle: true,
  cycleSevered: false,
  nodes: {
    n1: { id: 'n1', value: 10, nextId: 'n2', pos: [-5.5, 0, 0] },
    n2: { id: 'n2', value: 20, nextId: 'n3', pos: [-2.2, 0, 0] },
    n3: { id: 'n3', value: 30, nextId: 'n4', pos: [1.2, 0, -2.4] },
    n4: { id: 'n4', value: 40, nextId: 'n5', pos: [4.6, 0, -1.0] },
    n5: { id: 'n5', value: 50, nextId: 'n6', pos: [4.6, 0, 1.8] },
    n6: { id: 'n6', value: 60, nextId: 'n2', pos: [1.2, 0, 2.4] },
  },
};

const DEFAULT_STACKS_QUEUES: StacksQueuesWorldState = {
  world: 'stacks-queues',
  inputStream: [
    { id: 'sb-p0', value: 'A', color: '#00F0FF' },
    { id: 'sb-p1', value: 'B', color: '#A855F7' },
    { id: 'sb-p2', value: 'C', color: '#FFB800' },
    { id: 'sb-p3', value: 'D', color: '#00FF9D' },
    { id: 'sb-p4', value: 'E', color: '#38BDF8' },
  ],
  buffers: {
    stackA: {
      id: 'stackA',
      kind: 'stack',
      label: 'STACK A',
      capacity: 4,
      items: [],
    },
    queueB: {
      id: 'queueB',
      kind: 'queue',
      label: 'QUEUE B',
      capacity: 4,
      items: [],
    },
  },
  outputEmitted: [],
  targetManifest: [],
};

const DUAL_BUFFER_STRESS: StacksQueuesWorldState = {
  world: 'stacks-queues',
  inputStream: [
    { id: 'db-p0', value: 'X1', color: '#FF2A5F' },
    { id: 'db-p1', value: 'X2', color: '#FFB800' },
    { id: 'db-p2', value: 'X3', color: '#00F0FF' },
    { id: 'db-p3', value: 'X4', color: '#A855F7' },
    { id: 'db-p4', value: 'X5', color: '#00FF9D' },
    { id: 'db-p5', value: 'X6', color: '#38BDF8' },
  ],
  buffers: {
    inStack: {
      id: 'inStack',
      kind: 'stack',
      label: 'IN-STACK',
      capacity: 3,
      items: [],
    },
    outStack: {
      id: 'outStack',
      kind: 'stack',
      label: 'OUT-STACK',
      capacity: 3,
      items: [],
    },
    bypassQ: {
      id: 'bypassQ',
      kind: 'queue',
      label: 'BYPASS QUEUE',
      capacity: 3,
      items: [],
    },
  },
  outputEmitted: [],
  targetManifest: [],
};

const WEIGHTED_CANYON_MAZE: PathfindingWorldState = makeGrid(
  10,
  10,
  [1, 4],
  [8, 5],
  [
    [3, 1],
    [3, 2],
    [3, 3],
    [3, 6],
    [3, 7],
    [3, 8],
    [6, 0],
    [6, 1],
    [6, 2],
    [6, 6],
    [6, 7],
    [6, 8],
  ],
  [
    [4, 3, 5],
    [4, 4, 5],
    [4, 5, 5],
    [5, 3, 5],
    [5, 4, 5],
    [5, 5, 5],
  ],
);

const SPIRAL_LABYRINTH: PathfindingWorldState = makeGrid(
  10,
  10,
  [0, 0],
  [5, 5],
  [
    [1, 0],
    [1, 1],
    [1, 2],
    [1, 3],
    [1, 4],
    [1, 5],
    [1, 6],
    [1, 7],
    [1, 8],
    [2, 8],
    [3, 8],
    [4, 8],
    [5, 8],
    [6, 8],
    [7, 8],
    [8, 8],
    [8, 7],
    [8, 6],
    [8, 5],
    [8, 4],
    [8, 3],
    [8, 2],
    [8, 1],
    [7, 1],
    [6, 1],
    [5, 1],
    [4, 1],
    [3, 1],
    [3, 2],
    [3, 3],
    [3, 4],
    [3, 5],
    [3, 6],
    [4, 6],
    [5, 6],
    [6, 6],
    [6, 5],
    [6, 4],
    [6, 3],
  ],
  [
    [0, 9, 3],
    [9, 0, 3],
    [4, 4, 4],
  ],
);

export const SANDBOX_DEFAULTS: Record<WorldId, AnyWorldState> = {
  arrays: DEFAULT_ARRAYS,
  'linked-lists': DEFAULT_LINKED_LIST,
  'stacks-queues': DEFAULT_STACKS_QUEUES,
  pathfinding: WEIGHTED_CANYON_MAZE,
};

export const SANDBOX_PRESETS_BUILTIN: SandboxPreset[] = [
  {
    id: 'builtin-arrays-unsorted',
    name: 'Random Unsorted Bus',
    worldId: 'arrays',
    createdAt: 1700000001000,
    state: DEFAULT_ARRAYS,
  },
  {
    id: 'builtin-arrays-almost-sorted',
    name: 'Almost Sorted Rail',
    worldId: 'arrays',
    createdAt: 1700000002000,
    state: ALMOST_SORTED_ARRAYS,
  },
  {
    id: 'builtin-ll-linear',
    name: 'Linear 5-Node Chain',
    worldId: 'linked-lists',
    createdAt: 1700000003000,
    state: DEFAULT_LINKED_LIST,
  },
  {
    id: 'builtin-ll-cyclic',
    name: 'Cyclic Tether Matrix',
    worldId: 'linked-lists',
    createdAt: 1700000004000,
    state: CYCLIC_TETHER_MATRIX,
  },
  {
    id: 'builtin-sq-standard',
    name: 'Stack + Queue Pipeline',
    worldId: 'stacks-queues',
    createdAt: 1700000005000,
    state: DEFAULT_STACKS_QUEUES,
  },
  {
    id: 'builtin-sq-stress',
    name: 'Dual-Buffer Stress Test',
    worldId: 'stacks-queues',
    createdAt: 1700000006000,
    state: DUAL_BUFFER_STRESS,
  },
  {
    id: 'builtin-pf-canyon',
    name: 'Weighted Canyon Maze',
    worldId: 'pathfinding',
    createdAt: 1700000007000,
    state: WEIGHTED_CANYON_MAZE,
  },
  {
    id: 'builtin-pf-spiral',
    name: 'Spiral Labyrinth',
    worldId: 'pathfinding',
    createdAt: 1700000008000,
    state: SPIRAL_LABYRINTH,
  },
];
