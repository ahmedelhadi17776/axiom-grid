import type {
  AnyWorldState,
  ArraysWorldState,
  DPCell,
  DPItem,
  DPMode,
  DPWorldState,
  GridCell,
  HashBucket,
  HashResolutionStrategy,
  HashTableWorldState,
  HeapKind,
  HeapNodeSlot,
  HeapWorldState,
  LinkedListWorldState,
  PathfindingWorldState,
  SandboxPreset,
  StacksQueuesWorldState,
  TreeNode,
  TreesWorldState,
  WorldId,
} from '../engine/types';
import { computeReadyCells } from '../engine/worlds/dpEngine';
import { computeHeapViolations } from '../engine/worlds/heapEngine';
import { recomputeTreeLayoutAndMetrics } from '../engine/worlds/treesEngine';

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

function makeTreePreset(
  rootId: string,
  specs: Array<{
    id: string;
    value: number;
    leftId: string | null;
    rightId: string | null;
  }>,
): TreesWorldState {
  const nodes: Record<string, TreeNode> = {};
  for (const s of specs) {
    nodes[s.id] = {
      id: s.id,
      value: s.value,
      leftId: s.leftId,
      rightId: s.rightId,
      pos: [0, 0, 0],
    };
  }
  const state: TreesWorldState = {
    world: 'trees',
    mode: 'sandbox',
    nodes,
    rootId,
    selectedNodeId: rootId,
    pendingQueue: [],
    visitedSequence: [],
    showBalanceFactors: true,
    invariantViolations: 0,
  };
  recomputeTreeLayoutAndMetrics(state);
  return state;
}

function makeDPPreset(opts: {
  mode: DPMode;
  rows: number;
  cols: number;
  rowLabels: string[];
  colLabels: string[];
  baseCells: Array<[number, number, number]>;
  expectedTable: (number | null)[][];
  optimalPath: [number, number][];
  targetAnswer: number;
  naiveRecursionOps: number;
  items?: DPItem[];
  strA?: string;
  strB?: string;
}): DPWorldState {
  const baseMap = new Map(opts.baseCells.map(([r, c, v]) => [`${r},${c}`, v]));
  const cells: DPCell[] = [];
  for (let r = 0; r < opts.rows; r++) {
    for (let c = 0; c < opts.cols; c++) {
      const key = `${r},${c}`;
      if (baseMap.has(key)) {
        cells.push({ row: r, col: c, value: baseMap.get(key)!, state: 'computed' });
      } else {
        cells.push({ row: r, col: c, value: null, state: 'empty' });
      }
    }
  }
  const state: DPWorldState = {
    world: 'dp',
    mode: opts.mode,
    rows: opts.rows,
    cols: opts.cols,
    rowLabels: [...opts.rowLabels],
    colLabels: [...opts.colLabels],
    cells,
    activeCell: null,
    activeDeps: [],
    targetAnswer: opts.targetAnswer,
    expectedTable: opts.expectedTable.map((row) => [...row]),
    optimalPath: opts.optimalPath.map(([r, c]) => [r, c] as [number, number]),
    naiveRecursionOps: opts.naiveRecursionOps,
    items: opts.items ? opts.items.map((item) => ({ ...item })) : undefined,
    strA: opts.strA,
    strB: opts.strB,
    tracebackShown: false,
  };
  computeReadyCells(state);
  return state;
}

function makeHashPreset(opts: {
  strategy: HashResolutionStrategy;
  capacity: number;
  initialEntries: Array<{ bucket: number; key: number; value: string }>;
  pendingKeys: Array<{ key: number; value: string }>;
}): HashTableWorldState {
  const buckets: HashBucket[] = Array.from({ length: opts.capacity }, (_, index) => ({
    index,
    entry: null,
    tombstone: false,
    chain: [],
    state: 'idle',
  }));
  for (const item of opts.initialEntries) {
    const b = buckets[item.bucket];
    if (!b) continue;
    const entry = {
      key: item.key,
      value: item.value,
      originalBucket: ((item.key % opts.capacity) + opts.capacity) % opts.capacity,
      state: 'idle' as const,
    };
    if (opts.strategy === 'chaining') {
      b.chain.push(entry);
    } else {
      b.entry = entry;
    }
  }
  return {
    world: 'hash-table',
    mode: 'sandbox',
    strategy: opts.strategy,
    capacity: opts.capacity,
    buckets,
    pendingKeys: opts.pendingKeys.map((k) => ({ ...k })),
    lastHashBeam: null,
    foundBucket: null,
    loadFactorThreshold: 0.7,
    rehashCount: 0,
    collisions: 0,
  };
}

function makeHeapPreset(opts: {
  kind: HeapKind;
  values: number[];
  pendingQueue?: number[];
  prefix: string;
}): HeapWorldState {
  const items: HeapNodeSlot[] = opts.values.map((value, idx) => ({
    id: `${opts.prefix}-${idx}`,
    value,
    state: 'idle',
  }));
  computeHeapViolations(items, opts.kind);
  return {
    world: 'heap',
    kind: opts.kind,
    mode: 'sandbox',
    items,
    pendingQueue: opts.pendingQueue ? [...opts.pendingQueue] : [],
    extracted: [],
    selectedIndex: items.length > 0 ? 0 : null,
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
    { id: 'sb-p0', value: 'A', color: '#38BDF8' },
    { id: 'sb-p1', value: 'B', color: '#A78BFA' },
    { id: 'sb-p2', value: 'C', color: '#FBBF24' },
    { id: 'sb-p3', value: 'D', color: '#34D399' },
    { id: 'sb-p4', value: 'E', color: '#2DD4BF' },
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
    { id: 'db-p0', value: 'X1', color: '#FB7185' },
    { id: 'db-p1', value: 'X2', color: '#FBBF24' },
    { id: 'db-p2', value: 'X3', color: '#38BDF8' },
    { id: 'db-p3', value: 'X4', color: '#A78BFA' },
    { id: 'db-p4', value: 'X5', color: '#34D399' },
    { id: 'db-p5', value: 'X6', color: '#2DD4BF' },
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

const CONCAVE_TRAP_ARENA: PathfindingWorldState = makeGrid(
  10,
  10,
  [1, 4],
  [8, 4],
  [
    [3, 2],
    [4, 2],
    [5, 2],
    [5, 3],
    [5, 5],
    [5, 6],
    [3, 6],
    [4, 6],
  ],
  [
    [3, 3, 5],
    [3, 4, 5],
    [3, 5, 5],
    [4, 3, 5],
    [4, 4, 5],
    [4, 5, 5],
    [5, 4, 5],
    [6, 4, 5],
  ],
);

const BALANCED_BST_7: TreesWorldState = makeTreePreset('t1', [
  { id: 't1', value: 50, leftId: 't2', rightId: 't3' },
  { id: 't2', value: 25, leftId: 't4', rightId: 't5' },
  { id: 't3', value: 75, leftId: 't6', rightId: 't7' },
  { id: 't4', value: 12, leftId: null, rightId: null },
  { id: 't5', value: 37, leftId: null, rightId: null },
  { id: 't6', value: 62, leftId: null, rightId: null },
  { id: 't7', value: 88, leftId: null, rightId: null },
]);

const RIGHT_SKEWED_AVL: TreesWorldState = makeTreePreset('t1', [
  { id: 't1', value: 10, leftId: null, rightId: 't2' },
  { id: 't2', value: 20, leftId: null, rightId: 't3' },
  { id: 't3', value: 30, leftId: null, rightId: 't4' },
  { id: 't4', value: 40, leftId: null, rightId: 't5' },
  { id: 't5', value: 50, leftId: null, rightId: null },
]);

const ZIGZAG_LR_STRESS: TreesWorldState = makeTreePreset('t1', [
  { id: 't1', value: 50, leftId: 't2', rightId: 't6' },
  { id: 't2', value: 20, leftId: null, rightId: 't3' },
  { id: 't3', value: 35, leftId: 't4', rightId: 't5' },
  { id: 't4', value: 28, leftId: null, rightId: null },
  { id: 't5', value: 42, leftId: null, rightId: null },
  { id: 't6', value: 70, leftId: null, rightId: null },
]);

const DP_KNAPSACK_MATRIX: DPWorldState = makeDPPreset({
  mode: 'knapsack',
  rows: 4,
  cols: 6,
  rowLabels: ['0 items', 'A(w2,v12)', 'B(w3,v18)', 'C(w4,v22)'],
  colLabels: ['cap 0', 'cap 1', 'cap 2', 'cap 3', 'cap 4', 'cap 5'],
  items: [
    { label: 'Core A', weight: 2, value: 12 },
    { label: 'Core B', weight: 3, value: 18 },
    { label: 'Core C', weight: 4, value: 22 },
  ],
  baseCells: [
    [0, 0, 0],
    [0, 1, 0],
    [0, 2, 0],
    [0, 3, 0],
    [0, 4, 0],
    [0, 5, 0],
    [1, 0, 0],
    [2, 0, 0],
    [3, 0, 0],
  ],
  expectedTable: [
    [0, 0, 0, 0, 0, 0],
    [0, 0, 12, 12, 12, 12],
    [0, 0, 12, 18, 18, 30],
    [0, 0, 12, 18, 22, 30],
  ],
  optimalPath: [
    [0, 0],
    [1, 2],
    [2, 5],
    [3, 5],
  ],
  targetAnswer: 30,
  naiveRecursionOps: 32,
});

const DP_LCS_MATRIX: DPWorldState = makeDPPreset({
  mode: 'lcs',
  rows: 5,
  cols: 5,
  rowLabels: ['∅', 'A', 'X', 'I', 'M'],
  colLabels: ['∅', 'A', 'I', 'M', 'X'],
  strA: 'AXIM',
  strB: 'AIMX',
  baseCells: [
    [0, 0, 0],
    [0, 1, 0],
    [0, 2, 0],
    [0, 3, 0],
    [0, 4, 0],
    [1, 0, 0],
    [2, 0, 0],
    [3, 0, 0],
    [4, 0, 0],
  ],
  expectedTable: [
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1],
    [0, 1, 1, 1, 2],
    [0, 1, 2, 2, 2],
    [0, 1, 2, 3, 3],
  ],
  optimalPath: [
    [0, 0],
    [1, 1],
    [2, 1],
    [3, 2],
    [4, 3],
    [4, 4],
  ],
  targetAnswer: 3,
  naiveRecursionOps: 70,
});

const DEFAULT_HASH_TABLE: HashTableWorldState = makeHashPreset({
  strategy: 'linear',
  capacity: 7,
  initialEntries: [
    { bucket: 2, key: 9, value: 'K9' },
    { bucket: 4, key: 18, value: 'K18' },
  ],
  pendingKeys: [
    { key: 16, value: 'K16' },
    { key: 23, value: 'K23' },
    { key: 30, value: 'K30' },
    { key: 11, value: 'K11' },
  ],
});

const CHAINING_VAULT_PRESET: HashTableWorldState = makeHashPreset({
  strategy: 'chaining',
  capacity: 5,
  initialEntries: [
    { bucket: 1, key: 6, value: 'K6' },
    { bucket: 1, key: 11, value: 'K11' },
    { bucket: 2, key: 7, value: 'K7' },
  ],
  pendingKeys: [
    { key: 16, value: 'K16' },
    { key: 12, value: 'K12' },
    { key: 21, value: 'K21' },
  ],
});

const DEFAULT_HEAP: HeapWorldState = makeHeapPreset({
  kind: 'min',
  values: [14, 28, 22, 45, 36, 52],
  pendingQueue: [10, 19],
  prefix: 'sb-h',
});

const UNSORTED_HEAPIFY_PRESET: HeapWorldState = makeHeapPreset({
  kind: 'min',
  values: [64, 42, 55, 18, 30, 12, 25],
  pendingQueue: [],
  prefix: 'sb-uh',
});

const MAX_HEAP_SPIRE_PRESET: HeapWorldState = makeHeapPreset({
  kind: 'max',
  values: [88, 64, 72, 31, 45, 50, 29],
  pendingQueue: [95, 60],
  prefix: 'sb-mh',
});

export const SANDBOX_DEFAULTS: Record<WorldId, AnyWorldState> = {
  arrays: DEFAULT_ARRAYS,
  'linked-lists': DEFAULT_LINKED_LIST,
  'stacks-queues': DEFAULT_STACKS_QUEUES,
  pathfinding: WEIGHTED_CANYON_MAZE,
  trees: BALANCED_BST_7,
  dp: DP_KNAPSACK_MATRIX,
  'hash-table': DEFAULT_HASH_TABLE,
  heap: DEFAULT_HEAP,
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
  {
    id: 'builtin-pf-concave',
    name: 'Concave Trap Arena',
    worldId: 'pathfinding',
    createdAt: 1700000009000,
    state: CONCAVE_TRAP_ARENA,
  },
  {
    id: 'builtin-trees-balanced',
    name: 'Balanced 7-Node BST',
    worldId: 'trees',
    createdAt: 1700000010000,
    state: BALANCED_BST_7,
  },
  {
    id: 'builtin-trees-skewed',
    name: 'Right-Skewed Chain (AVL)',
    worldId: 'trees',
    createdAt: 1700000011000,
    state: RIGHT_SKEWED_AVL,
  },
  {
    id: 'builtin-trees-zigzag',
    name: 'Zig-Zag LR Stress Tree',
    worldId: 'trees',
    createdAt: 1700000012000,
    state: ZIGZAG_LR_STRESS,
  },
  {
    id: 'builtin-dp-knapsack',
    name: '0/1 Knapsack Matrix',
    worldId: 'dp',
    createdAt: 1700000013000,
    state: DP_KNAPSACK_MATRIX,
  },
  {
    id: 'builtin-dp-lcs',
    name: 'LCS Alignment Matrix',
    worldId: 'dp',
    createdAt: 1700000014000,
    state: DP_LCS_MATRIX,
  },
  {
    id: 'builtin-hash-linear',
    name: 'Linear Probing Cluster',
    worldId: 'hash-table',
    createdAt: 1700000015000,
    state: DEFAULT_HASH_TABLE,
  },
  {
    id: 'builtin-hash-chaining',
    name: 'Separate Chaining Vault',
    worldId: 'hash-table',
    createdAt: 1700000016000,
    state: CHAINING_VAULT_PRESET,
  },
  {
    id: 'builtin-heap-unsorted',
    name: 'Unsorted Array (Heapify)',
    worldId: 'heap',
    createdAt: 1700000017000,
    state: UNSORTED_HEAPIFY_PRESET,
  },
  {
    id: 'builtin-heap-max',
    name: 'Max-Heap Priority Spire',
    worldId: 'heap',
    createdAt: 1700000018000,
    state: MAX_HEAP_SPIRE_PRESET,
  },
];
