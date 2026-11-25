import { accumulateMetrics, createEmptyMetrics } from '../scorer';
import type {
  AnyWorldState,
  ArraysWorldState,
  LevelDefinition,
  LinkedListWorldState,
  PathfindingAlgorithm,
  PathfindingWorldState,
  ScoreReport,
  SimEvent,
  SimMetrics,
  StacksQueuesWorldState,
  WorldId,
} from '../types';
import {
  cloneArraysState,
  createArraysSession,
  evaluateArraysLevel,
} from './arraysEngine';
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

export * from './arraysEngine';
export * from './linkedListEngine';
export * from './stacksQueuesEngine';
export * from './pathfindingEngine';

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
        if (algo === 'bfs' || algo === 'dijkstra' || algo === 'astar') {
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

  return {
    state: cloneWorldState(state),
    events: [],
    metrics: baseMetrics,
  };
}
