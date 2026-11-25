import type { LevelDefinition, WorldId } from '../engine/types';
import { ARRAYS_LEVELS } from './arraysLevels';
import { LINKED_LIST_LEVELS } from './linkedListLevels';
import { PATHFINDING_LEVELS } from './pathfindingLevels';
import { STACKS_QUEUES_LEVELS } from './stacksQueuesLevels';

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
    tagline: 'Contiguous O(1) indexing, two-pointer convergence & sliding windows.',
    accentColor: '#00F0FF',
    bigOTheme: 'O(1) Access · O(n) Scans',
  },
  {
    id: 'linked-lists',
    name: 'Linked Lists',
    subtitle: 'Tether Matrix',
    tagline: 'Zero-leak pointer splicing, in-place inversion & Floyd cycle probes.',
    accentColor: '#A855F7',
    bigOTheme: 'O(1) Rewires · O(1) Space',
  },
  {
    id: 'stacks-queues',
    name: 'Stacks & Queues',
    subtitle: 'Pipeline Core',
    tagline: 'Pressurized LIFO chambers, FIFO conveyors & bounded stream routing.',
    accentColor: '#FFB800',
    bigOTheme: 'O(1) Push / Pop · Bounded Cap',
  },
  {
    id: 'pathfinding',
    name: 'Pathfinding',
    subtitle: 'Signal Grid',
    tagline: 'BFS wavefronts, Dijkstra weighted elevation tolls & A* heuristic beams.',
    accentColor: '#00FF9D',
    bigOTheme: 'O(V + E) -> A* Guided',
  },
];

export const LEVELS_BY_WORLD: Record<WorldId, LevelDefinition[]> = {
  arrays: ARRAYS_LEVELS as LevelDefinition[],
  'linked-lists': LINKED_LIST_LEVELS as LevelDefinition[],
  'stacks-queues': STACKS_QUEUES_LEVELS as LevelDefinition[],
  pathfinding: PATHFINDING_LEVELS as LevelDefinition[],
};

export const ALL_LEVELS: LevelDefinition[] = [
  ...ARRAYS_LEVELS,
  ...LINKED_LIST_LEVELS,
  ...STACKS_QUEUES_LEVELS,
  ...PATHFINDING_LEVELS,
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
export { SANDBOX_DEFAULTS, SANDBOX_PRESETS_BUILTIN } from './sandboxTemplates';
