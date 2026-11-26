import { accumulateMetrics, createEmptyMetrics } from '../scorer';
import type {
  AnyWorldState,
  ArraysWorldState,
  DPWorldState,
  HashResolutionStrategy,
  HashTableWorldState,
  HeapWorldState,
  LevelDefinition,
  LinkedListWorldState,
  PathfindingAlgorithm,
  PathfindingWorldState,
  ScoreReport,
  SimEvent,
  SimMetrics,
  StacksQueuesWorldState,
  TreesWorldState,
  TreeTraversalOrder,
  WorldId,
} from '../types';
import {
  cloneArraysState,
  createArraysSession,
  evaluateArraysLevel,
} from './arraysEngine';
import {
  cloneDPState,
  createDPSession,
  evaluateDPLevel,
} from './dpEngine';
import {
  cloneHashTableState,
  createHashTableSession,
  evaluateHashTableLevel,
} from './hashTableEngine';
import {
  cloneHeapState,
  createHeapSession,
  evaluateHeapLevel,
} from './heapEngine';
import {
  cloneLinkedListState,
  createLinkedListSession,
  evaluateLinkedListLevel,
} from './linkedListEngine';
import {
  clonePathfindingState,
  createPathfindingSession,
  evaluatePathfindingLevel,
} from './pathfindingEngine';
import {
  cloneStacksQueuesState,
  createStacksQueuesSession,
  evaluateStacksQueuesLevel,
} from './stacksQueuesEngine';
import {
  cloneTreesState,
  createTreesSession,
  evaluateTreesLevel,
} from './treesEngine';

export * from './arraysEngine';
export * from './linkedListEngine';
export * from './stacksQueuesEngine';
export * from './pathfindingEngine';
export * from './treesEngine';
export * from './dpEngine';
export * from './hashTableEngine';
export * from './heapEngine';

const VALID_PATHFINDING_ALGORITHMS = new Set<PathfindingAlgorithm>([
  'bfs',
  'dfs',
  'dijkstra',
  'greedy',
  'astar',
  'bidirectional',
]);

const VALID_TRAVERSAL_ORDERS = new Set<TreeTraversalOrder>([
  'preorder',
  'inorder',
  'postorder',
  'levelorder',
]);

export function cloneWorldState<T extends AnyWorldState>(state: T): T {
  switch (state.world) {
    case 'arrays':
      return cloneArraysState(state) as T;
    case 'linked-lists':
      return cloneLinkedListState(state) as T;
    case 'stacks-queues':
      return cloneStacksQueuesState(state) as T;
    case 'pathfinding':
      return clonePathfindingState(state) as T;
    case 'trees':
      return cloneTreesState(state) as T;
    case 'dp':
      return cloneDPState(state) as T;
    case 'hash-table':
      return cloneHashTableState(state) as T;
    case 'heap':
      return cloneHeapState(state) as T;
  }
}

export function evaluateLevel(
  level: LevelDefinition,
  state: AnyWorldState,
  metrics: SimMetrics
): ScoreReport {
  switch (state.world) {
    case 'arrays':
      return evaluateArraysLevel(
        level as LevelDefinition<ArraysWorldState>,
        state,
        metrics
      );
    case 'linked-lists':
      return evaluateLinkedListLevel(
        level as LevelDefinition<LinkedListWorldState>,
        state,
        metrics
      );
    case 'stacks-queues':
      return evaluateStacksQueuesLevel(
        level as LevelDefinition<StacksQueuesWorldState>,
        state,
        metrics
      );
    case 'pathfinding':
      return evaluatePathfindingLevel(
        level as LevelDefinition<PathfindingWorldState>,
        state,
        metrics
      );
    case 'trees':
      return evaluateTreesLevel(
        level as LevelDefinition<TreesWorldState>,
        state,
        metrics
      );
    case 'dp':
      return evaluateDPLevel(
        level as LevelDefinition<DPWorldState>,
        state,
        metrics
      );
    case 'hash-table':
      return evaluateHashTableLevel(
        level as LevelDefinition<HashTableWorldState>,
        state,
        metrics
      );
    case 'heap':
      return evaluateHeapLevel(
        level as LevelDefinition<HeapWorldState>,
        state,
        metrics
      );
  }
}

export interface DirectActionInput {
  world: WorldId;
  type: string;
  payload?: Record<string, unknown>;
}

export interface DirectActionResult {
  state: AnyWorldState;
  events: SimEvent[];
  metrics: SimMetrics;
}

export function applyDirectAction(
  state: AnyWorldState,
  action: DirectActionInput,
  existingMetrics?: SimMetrics
): DirectActionResult {
  const baseMetrics = existingMetrics
    ? { ...existingMetrics }
    : createEmptyMetrics();
  const payload = action.payload ?? {};

  if (state.world === 'arrays' && action.world === 'arrays') {
    const session = createArraysSession(state);
    switch (action.type) {
      case 'SWAP': {
        const i = Number(payload.i);
        const j = Number(payload.j);
        session.swap(i, j);
        break;
      }
      case 'COMPARE': {
        const i = Number(payload.i);
        const j = Number(payload.j);
        session.compare(i, j);
        break;
      }
      case 'PROBE': {
        session.probe(Number(payload.index));
        break;
      }
      case 'SET_POINTER': {
        const name = String(payload.name ?? 'p');
        const index = Number(payload.index);
        session.setPointer(name, index);
        break;
      }
      case 'SET_WINDOW':
      case 'MARK_WINDOW': {
        const left = Number(payload.left);
        const right = Number(payload.right);
        session.markWindow(left, right);
        break;
      }
      case 'MARK_SORTED': {
        session.markSorted(Number(payload.index));
        break;
      }
      case 'SHIFT_SLICE': {
        session.shiftSlice(Number(payload.from), Number(payload.to));
        break;
      }
      default:
        break;
    }

    const delta = session.getMetrics();
    return {
      state: session.getState(),
      events: session.getEvents(),
      metrics: accumulateMetrics(baseMetrics, delta),
    };
  }

  if (state.world === 'linked-lists' && action.world === 'linked-lists') {
    const session = createLinkedListSession(state);
    switch (action.type) {
      case 'LINK': {
        const fromId = String(payload.fromId ?? '');
        const toId =
          payload.toId === null || payload.toId === undefined
            ? null
            : String(payload.toId);
        session.link(fromId, toId);
        break;
      }
      case 'UNLINK': {
        const fromId = String(payload.fromId ?? '');
        session.link(fromId, null);
        break;
      }
      case 'SET_HEAD': {
        const rawId = payload.id !== undefined ? payload.id : payload.nodeId;
        const id = rawId === null || rawId === undefined ? null : String(rawId);
        session.setHead(id);
        break;
      }
      case 'INSERT_NODE': {
        const id = String(payload.id ?? `n${Date.now()}`);
        const value = Number(payload.value ?? 0);
        const afterId =
          payload.afterId === null || payload.afterId === undefined
            ? null
            : String(payload.afterId);
        const pos = Array.isArray(payload.pos)
          ? (payload.pos as [number, number, number])
          : undefined;
        session.insertNode(id, value, afterId, pos);
        break;
      }
      case 'DELETE_NODE': {
        session.deleteNode(String(payload.id ?? ''));
        break;
      }
      case 'SET_CURSOR': {
        const name = String(payload.name ?? 'curr');
        const nodeId =
          payload.nodeId === null || payload.nodeId === undefined
            ? null
            : String(payload.nodeId);
        session.setCursor(name, nodeId);
        break;
      }
      case 'ADVANCE': {
        const cursorName = String(payload.cursorName ?? payload.name ?? 'curr');
        session.advance(cursorName);
        break;
      }
      case 'STEP_PROBE': {
        const slowName =
          typeof payload.slowName === 'string' ? payload.slowName : 'slow';
        const fastName =
          typeof payload.fastName === 'string' ? payload.fastName : 'fast';
        session.stepProbe(slowName, fastName);
        break;
      }
      default:
        break;
    }

    const delta = session.getMetrics();
    return {
      state: session.getState(),
      events: session.getEvents(),
      metrics: accumulateMetrics(baseMetrics, delta),
    };
  }

  if (state.world === 'stacks-queues' && action.world === 'stacks-queues') {
    const session = createStacksQueuesSession(state);
    switch (action.type) {
      case 'INTAKE': {
        session.intake(String(payload.bufferId ?? ''));
        break;
      }
      case 'TRANSFER': {
        session.transfer(
          String(payload.fromId ?? ''),
          String(payload.toId ?? '')
        );
        break;
      }
      case 'EMIT': {
        session.emit(String(payload.bufferId ?? ''));
        break;
      }
      default:
        break;
    }

    const delta = session.getMetrics();
    return {
      state: session.getState(),
      events: session.getEvents(),
      metrics: accumulateMetrics(baseMetrics, delta),
    };
  }

  if (state.world === 'pathfinding' && action.world === 'pathfinding') {
    const session = createPathfindingSession(state);
    switch (action.type) {
      case 'SET_ALGORITHM': {
        const algo = String(payload.algorithm ?? 'bfs') as PathfindingAlgorithm;
        if (VALID_PATHFINDING_ALGORITHMS.has(algo)) {
          session.setAlgorithm(algo);
        }
        break;
      }
      case 'SET_WALL': {
        session.setWall(
          Number(payload.x),
          Number(payload.y),
          Boolean(payload.isWall)
        );
        break;
      }
      case 'SET_WEIGHT': {
        session.setWeight(
          Number(payload.x),
          Number(payload.y),
          Number(payload.weight ?? 1)
        );
        break;
      }
      case 'SET_START': {
        session.setStart(Number(payload.x), Number(payload.y));
        break;
      }
      case 'SET_GOAL': {
        session.setGoal(Number(payload.x), Number(payload.y));
        break;
      }
      case 'TOGGLE_CELL': {
        const x = Number(payload.x);
        const y = Number(payload.y);
        const tool = String(payload.tool ?? 'wall');
        const cell = state.cells.find((c) => c.x === x && c.y === y);
        if (cell) {
          if (tool === 'start') {
            session.setStart(x, y);
          } else if (tool === 'goal') {
            session.setGoal(x, y);
          } else if (tool === 'open') {
            session.setWall(x, y, false);
            session.setWeight(x, y, 1);
          } else if (tool === 'weight') {
            const nextWeight =
              typeof payload.weight === 'number'
                ? payload.weight
                : cell.type === 'weighted'
                  ? 1
                  : 5;
            session.setWeight(x, y, nextWeight);
          } else {
            // Default: 'wall'
            session.setWall(x, y, cell.type !== 'wall');
          }
        }
        break;
      }
      case 'RUN_SEARCH': {
        session.runSearch();
        return {
          state: session.getState(),
          events: session.getEvents(),
          metrics: session.getMetrics(),
        };
      }
      default:
        break;
    }

    return {
      state: session.getState(),
      events: session.getEvents(),
      metrics: baseMetrics,
    };
  }

  if (state.world === 'trees' && action.world === 'trees') {
    const session = createTreesSession(state);
    switch (action.type) {
      case 'PROBE': {
        session.probe(String(payload.id ?? ''));
        break;
      }
      case 'INSERT': {
        session.insert(Number(payload.value));
        break;
      }
      case 'INSERT_AT': {
        const parentId =
          payload.parentId === null || payload.parentId === undefined
            ? null
            : String(payload.parentId);
        const side = payload.side === 'right' ? 'right' : 'left';
        const value =
          payload.value !== undefined ? Number(payload.value) : undefined;
        session.insertAt(parentId, side, value);
        break;
      }
      case 'DELETE_NODE': {
        session.deleteNode(String(payload.id ?? ''));
        break;
      }
      case 'ROTATE_LEFT': {
        session.rotateLeft(String(payload.id ?? ''));
        break;
      }
      case 'ROTATE_RIGHT': {
        session.rotateRight(String(payload.id ?? ''));
        break;
      }
      case 'RUN_TRAVERSAL': {
        const order = String(payload.order ?? 'inorder') as TreeTraversalOrder;
        if (VALID_TRAVERSAL_ORDERS.has(order)) {
          session.runTraversal(order);
        }
        break;
      }
      case 'VISIT_NODE': {
        session.visitNode(String(payload.id ?? ''));
        break;
      }
      case 'SELECT_NODE': {
        const id =
          payload.id === null || payload.id === undefined
            ? null
            : String(payload.id);
        session.selectNode(id);
        break;
      }
      case 'AUTO_BALANCE': {
        session.autoBalance();
        break;
      }
      default:
        break;
    }

    const delta = session.getMetrics();
    return {
      state: session.getState(),
      events: session.getEvents(),
      metrics: accumulateMetrics(baseMetrics, delta),
    };
  }

  if (state.world === 'dp' && action.world === 'dp') {
    const session = createDPSession(state);
    switch (action.type) {
      case 'COMPUTE_CELL': {
        session.computeCell(Number(payload.row), Number(payload.col));
        break;
      }
      case 'SET_CELL': {
        const deps = Array.isArray(payload.deps)
          ? (payload.deps as [number, number][])
          : undefined;
        session.set(
          Number(payload.row),
          Number(payload.col),
          Number(payload.value),
          deps
        );
        break;
      }
      case 'TRACE_OPTIMAL': {
        session.traceOptimal();
        break;
      }
      case 'RUN_TABULATION': {
        session.runTabulation();
        break;
      }
      default:
        break;
    }

    const delta = session.getMetrics();
    return {
      state: session.getState(),
      events: session.getEvents(),
      metrics: accumulateMetrics(baseMetrics, delta),
    };
  }

  if (state.world === 'hash-table' && action.world === 'hash-table') {
    const session = createHashTableSession(state);
    switch (action.type) {
      case 'INSERT_AT_BUCKET': {
        session.insertAtBucket(Number(payload.bucketIndex));
        break;
      }
      case 'INSERT': {
        const key = Number(payload.key);
        const value =
          payload.value !== undefined ? String(payload.value) : undefined;
        session.insert(key, value);
        break;
      }
      case 'LOOKUP': {
        session.lookup(Number(payload.key));
        break;
      }
      case 'REMOVE': {
        const key = Number(payload.key);
        const useTombstone =
          payload.useTombstone !== undefined
            ? Boolean(payload.useTombstone)
            : undefined;
        session.remove(key, useTombstone);
        break;
      }
      case 'REHASH': {
        const newCap =
          payload.newCapacity !== undefined
            ? Number(payload.newCapacity)
            : undefined;
        session.rehash(newCap);
        break;
      }
      case 'SET_STRATEGY': {
        const strategy = String(
          payload.strategy ?? 'linear'
        ) as HashResolutionStrategy;
        if (strategy === 'linear' || strategy === 'chaining') {
          session.setStrategy(strategy);
        }
        break;
      }
      case 'MARK_PAIR': {
        session.markPair(Number(payload.a), Number(payload.b));
        break;
      }
      default:
        break;
    }

    const delta = session.getMetrics();
    return {
      state: session.getState(),
      events: session.getEvents(),
      metrics: accumulateMetrics(baseMetrics, delta),
    };
  }

  if (state.world === 'heap' && action.world === 'heap') {
    const session = createHeapSession(state);
    switch (action.type) {
      case 'SWAP': {
        session.swap(Number(payload.i), Number(payload.j));
        break;
      }
      case 'SELECT': {
        const index =
          payload.index === null || payload.index === undefined
            ? null
            : Number(payload.index);
        session.select(index);
        break;
      }
      case 'INSERT': {
        const value =
          payload.value !== undefined ? Number(payload.value) : undefined;
        session.insert(value);
        break;
      }
      case 'PUSH_RAW': {
        const value =
          payload.value !== undefined ? Number(payload.value) : undefined;
        session.pushRaw(value);
        break;
      }
      case 'EXTRACT_ROOT': {
        session.extractRoot();
        break;
      }
      case 'SIFT_UP': {
        session.siftUp(Number(payload.index));
        break;
      }
      case 'SIFT_DOWN': {
        session.siftDown(Number(payload.index));
        break;
      }
      case 'HEAPIFY': {
        session.heapify();
        break;
      }
      case 'INSERT_DUAL': {
        const value =
          payload.value !== undefined ? Number(payload.value) : undefined;
        session.insertDual(value);
        break;
      }
      default:
        break;
    }

    const delta = session.getMetrics();
    return {
      state: session.getState(),
      events: session.getEvents(),
      metrics: accumulateMetrics(baseMetrics, delta),
    };
  }

  return {
    state: cloneWorldState(state),
    events: [],
    metrics: baseMetrics,
  };
}
