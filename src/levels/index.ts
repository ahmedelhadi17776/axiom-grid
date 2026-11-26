import type { LevelDefinition, WorldId } from '../engine/types';
import { ARRAYS_LEVELS } from './arraysLevels';
import { DP_LEVELS } from './dpLevels';
import { HASH_TABLE_LEVELS } from './hashTableLevels';
import { HEAP_LEVELS } from './heapLevels';
import { LINKED_LIST_LEVELS } from './linkedListLevels';
import { PATHFINDING_LEVELS } from './pathfindingLevels';
import { STACKS_QUEUES_LEVELS } from './stacksQueuesLevels';
import { TREES_LEVELS } from './treesLevels';

export interface WorldMeta {
  id: WorldId;
  name: string;
  subtitle: string;
  tagline: string;
  accentColor: string;
  bigOTheme: string;
}

export const WORLD_META: WorldMeta[] = [
  {
    id: 'arrays',
    name: 'Arrays',
    subtitle: 'Memory Bus',
    tagline: 'Contiguous O(1) indexing, binary halving, sliding windows & 3-way partition.',
    accentColor: '#38BDF8',
    bigOTheme: 'O(1) Access · O(log n) Search',
  },
  {
    id: 'linked-lists',
    name: 'Linked Lists',
    subtitle: 'Tether Matrix',
    tagline: 'Zero-leak pointer splicing, pairwise flips, dual-chain merge & Floyd probes.',
    accentColor: '#A78BFA',
    bigOTheme: 'O(1) Rewires · O(1) Space',
  },
  {
    id: 'stacks-queues',
    name: 'Stacks & Queues',
    subtitle: 'Pipeline Core',
    tagline: 'LIFO chambers, Shunting Yard RPN, monotonic sorting & bounded conveyors.',
    accentColor: '#FBBF24',
    bigOTheme: 'O(1) Push / Pop · Bounded Cap',
  },
  {
    id: 'pathfinding',
    name: 'Pathfinding',
    subtitle: 'Signal Grid',
    tagline: 'BFS, DFS, Dijkstra tolls, Greedy traps, A* beacons & Bidirectional waves.',
    accentColor: '#34D399',
    bigOTheme: 'O(V + E) · A* · Bidirectional',
  },
  {
    id: 'trees',
    name: 'Binary Trees',
    subtitle: 'Canopy Nexus',
    tagline: 'O(log n) BST search, socket insertion, DFS/BFS sweeps & AVL rotations.',
    accentColor: '#2DD4BF',
    bigOTheme: 'O(log n) Search · AVL',
  },
  {
    id: 'dp',
    name: 'Dynamic Programming',
    subtitle: 'Memo Matrix',
    tagline: 'Overlapping subproblems, dependency beams, Knapsack & LCS tracebacks.',
    accentColor: '#818CF8',
    bigOTheme: 'O(n·W) Memo · Tabulation',
  },
  {
    id: 'hash-table',
    name: 'Hash Tables',
    subtitle: 'Collision Vault',
    tagline: 'Modulo prism routing, linear probing, tombstones, chaining & 2x rehashing.',
    accentColor: '#FB923C',
    bigOTheme: 'O(1) Avg · Load Factor α',
  },
  {
    id: 'heap',
    name: 'Heaps & Priority Queues',
    subtitle: 'Priority Spire',
    tagline: 'Array-backed binary pyramids, Floyd O(n) heapify, HeapSort & Twin Spires.',
    accentColor: '#F472B6',
    bigOTheme: 'O(log n) Sift · O(n) Heapify',
  },
];

export const LEVELS_BY_WORLD: Record<WorldId, LevelDefinition[]> = {
  arrays: ARRAYS_LEVELS as LevelDefinition[],
  'linked-lists': LINKED_LIST_LEVELS as LevelDefinition[],
  'stacks-queues': STACKS_QUEUES_LEVELS as LevelDefinition[],
  pathfinding: PATHFINDING_LEVELS as LevelDefinition[],
  trees: TREES_LEVELS as LevelDefinition[],
  dp: DP_LEVELS as LevelDefinition[],
  'hash-table': HASH_TABLE_LEVELS as LevelDefinition[],
  heap: HEAP_LEVELS as LevelDefinition[],
};

export const ALL_LEVELS: LevelDefinition[] = [
  ...ARRAYS_LEVELS,
  ...LINKED_LIST_LEVELS,
  ...STACKS_QUEUES_LEVELS,
  ...PATHFINDING_LEVELS,
  ...TREES_LEVELS,
  ...DP_LEVELS,
  ...HASH_TABLE_LEVELS,
  ...HEAP_LEVELS,
] as LevelDefinition[];

export function getLevelById(id: string): LevelDefinition | undefined {
  return ALL_LEVELS.find((lvl) => lvl.id === id);
}

export function getNextLevel(id: string): LevelDefinition | undefined {
  const idx = ALL_LEVELS.findIndex((lvl) => lvl.id === id);
  if (idx === -1 || idx + 1 >= ALL_LEVELS.length) {
    return undefined;
  }
  return ALL_LEVELS[idx + 1];
}

export { ARRAYS_LEVELS } from './arraysLevels';
export { LINKED_LIST_LEVELS } from './linkedListLevels';
export { STACKS_QUEUES_LEVELS } from './stacksQueuesLevels';
export { PATHFINDING_LEVELS } from './pathfindingLevels';
export { TREES_LEVELS } from './treesLevels';
export { DP_LEVELS } from './dpLevels';
export { HASH_TABLE_LEVELS } from './hashTableLevels';
export { HEAP_LEVELS } from './heapLevels';
export { SANDBOX_DEFAULTS, SANDBOX_PRESETS_BUILTIN } from './sandboxTemplates';
