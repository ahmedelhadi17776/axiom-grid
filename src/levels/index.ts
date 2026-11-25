import type { LevelDefinition, WorldId } from '../engine/types';
import { ARRAYS_LEVELS } from './arraysLevels';
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
];

export const LEVELS_BY_WORLD: Record<WorldId, LevelDefinition[]> = {
  arrays: ARRAYS_LEVELS as LevelDefinition[],
  'linked-lists': LINKED_LIST_LEVELS as LevelDefinition[],
  'stacks-queues': STACKS_QUEUES_LEVELS as LevelDefinition[],
  pathfinding: PATHFINDING_LEVELS as LevelDefinition[],
  trees: TREES_LEVELS as LevelDefinition[],
};

export const ALL_LEVELS: LevelDefinition[] = [
  ...ARRAYS_LEVELS,
  ...LINKED_LIST_LEVELS,
  ...STACKS_QUEUES_LEVELS,
  ...PATHFINDING_LEVELS,
  ...TREES_LEVELS,
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
export { SANDBOX_DEFAULTS, SANDBOX_PRESETS_BUILTIN } from './sandboxTemplates';
