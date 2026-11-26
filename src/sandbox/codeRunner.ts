import { createEmptyMetrics } from '../engine/scorer';
import type {
  AnyWorldState,
  ArraysWorldState,
  CodeExecutionResult,
  DPWorldState,
  HashResolutionStrategy,
  HashTableWorldState,
  HeapWorldState,
  LevelDefinition,
  LinkedListWorldState,
  PathfindingAlgorithm,
  PathfindingWorldState,
  SimEvent,
  SimMetrics,
  StacksQueuesWorldState,
  TreesWorldState,
  TreeTraversalOrder,
} from '../engine/types';
import {
  cloneWorldState,
  createArraysSession,
  createDPSession,
  createHashTableSession,
  createHeapSession,
  createLinkedListSession,
  createPathfindingSession,
  createStacksQueuesSession,
  createTreesSession,
  evaluateLevel,
} from '../engine/worlds';

export const OP_LIMIT = 2000;
export const EXECUTION_TIMEOUT_MS = 1500;
const MAX_LOGS = 100;

export class ThermalOverloadError extends Error {
  constructor(limit: number) {
    super(
      `Thermal Overload: exceeded ${limit} API operations. Check for infinite loops or redundant passes.`
    );
    this.name = 'ThermalOverloadError';
  }
}

function formatLogArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  if (
    typeof arg === 'number' ||
    typeof arg === 'boolean' ||
    arg === null ||
    arg === undefined
  ) {
    return String(arg);
  }
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

interface BuiltSession<TState extends AnyWorldState> {
  api: Record<string, unknown>;
  getState: () => TState;
  getEvents: () => SimEvent<TState>[];
  getMetrics: () => SimMetrics;
}

function buildGuardedSession<TState extends AnyWorldState>(
  initialState: TState
): BuiltSession<TState> {
  let opCount = 0;
  const guard = <TArgs extends unknown[], TReturn>(
    fn: (...args: TArgs) => TReturn
  ): ((...args: TArgs) => TReturn) => {
    return (...args: TArgs): TReturn => {
      opCount += 1;
      if (opCount > OP_LIMIT) {
        throw new ThermalOverloadError(OP_LIMIT);
      }
      return fn(...args);
    };
  };

  switch (initialState.world) {
    case 'arrays': {
      const session = createArraysSession(initialState as ArraysWorldState);
      const api: Record<string, unknown> = {
        get length() {
          return session.length;
        },
        get: guard((i: number) => session.get(i)),
        probe: guard((i: number) => session.probe(i)),
        compare: guard((i: number, j: number) => session.compare(i, j)),
        swap: guard((i: number, j: number) => session.swap(i, j)),
        setPointer: guard((name: string, idx: number) =>
          session.setPointer(name, idx)
        ),
        markWindow: guard((l: number, r: number) => session.markWindow(l, r)),
        markSorted: guard((idx: number) => session.markSorted(idx)),
        shiftSlice: guard((from: number, to: number) =>
          session.shiftSlice(from, to)
        ),
      };
      return {
        api,
        getState: () => session.getState() as TState,
        getEvents: () => session.getEvents() as SimEvent<TState>[],
        getMetrics: () => session.getMetrics(),
      };
    }

    case 'linked-lists': {
      const session = createLinkedListSession(
        initialState as LinkedListWorldState
      );
      const api: Record<string, unknown> = {
        head: guard(() => session.head()),
        getNode: guard((id: string) => session.getNode(id)),
        link: guard((fromId: string, toId: string | null) =>
          session.link(fromId, toId)
        ),
        setHead: guard((id: string | null) => session.setHead(id)),
        insertNode: guard(
          (
            id: string,
            value: number,
            afterId: string | null,
            pos?: [number, number, number]
          ) => session.insertNode(id, value, afterId, pos)
        ),
        deleteNode: guard((id: string) => session.deleteNode(id)),
        setCursor: guard((name: string, nodeId: string | null) =>
          session.setCursor(name, nodeId)
        ),
        advance: guard((cursorName: string) => session.advance(cursorName)),
        stepProbe: guard((slowName?: string, fastName?: string) =>
          session.stepProbe(slowName, fastName)
        ),
        detectCycle: guard(() => session.detectCycle()),
      };
      return {
        api,
        getState: () => session.getState() as TState,
        getEvents: () => session.getEvents() as SimEvent<TState>[],
        getMetrics: () => session.getMetrics(),
      };
    }

    case 'stacks-queues': {
      const session = createStacksQueuesSession(
        initialState as StacksQueuesWorldState
      );
      const api: Record<string, unknown> = {
        hasInput: guard(() => session.hasInput()),
        peekInput: guard(() => session.peekInput()),
        intake: guard((bufferId: string) => session.intake(bufferId)),
        transfer: guard((fromId: string, toId: string) =>
          session.transfer(fromId, toId)
        ),
        emit: guard((bufferId: string) => session.emit(bufferId)),
        peek: guard((bufferId: string) => session.peek(bufferId)),
        size: guard((bufferId: string) => session.size(bufferId)),
      };
      return {
        api,
        getState: () => session.getState() as TState,
        getEvents: () => session.getEvents() as SimEvent<TState>[],
        getMetrics: () => session.getMetrics(),
      };
    }

    case 'pathfinding': {
      const session = createPathfindingSession(
        initialState as PathfindingWorldState
      );
      const api: Record<string, unknown> = {
        setAlgorithm: guard((algo: PathfindingAlgorithm) =>
          session.setAlgorithm(algo)
        ),
        setWall: guard((x: number, y: number, isWall: boolean) =>
          session.setWall(x, y, isWall)
        ),
        setWeight: guard((x: number, y: number, weight: number) =>
          session.setWeight(x, y, weight)
        ),
        setStart: guard((x: number, y: number) => session.setStart(x, y)),
        setGoal: guard((x: number, y: number) => session.setGoal(x, y)),
        runSearch: guard(() => session.runSearch()),
        compareAllAlgorithms: guard(() => session.compareAllAlgorithms()),
      };
      return {
        api,
        getState: () => session.getState() as TState,
        getEvents: () => session.getEvents() as SimEvent<TState>[],
        getMetrics: () => session.getMetrics(),
      };
    }

    case 'trees': {
      const session = createTreesSession(initialState as TreesWorldState);
      const api: Record<string, unknown> = {
        root: guard(() => session.root()),
        getNode: guard((id: string) => session.getNode(id)),
        getBalanceFactor: guard((id: string) => session.getBalanceFactor(id)),
        pendingQueue: guard(() => session.pendingQueue()),
        selectNode: guard((id: string | null) => session.selectNode(id)),
        probe: guard((id: string) => session.probe(id)),
        insert: guard((value: number) => session.insert(value)),
        insertAt: guard(
          (
            parentId: string | null,
            side: 'left' | 'right',
            value?: number
          ) => session.insertAt(parentId, side, value)
        ),
        deleteNode: guard((id: string) => session.deleteNode(id)),
        rotateLeft: guard((id: string) => session.rotateLeft(id)),
        rotateRight: guard((id: string) => session.rotateRight(id)),
        runTraversal: guard((order: TreeTraversalOrder) =>
          session.runTraversal(order)
        ),
        visitNode: guard((id: string) => session.visitNode(id)),
        autoBalance: guard(() => session.autoBalance()),
      };
      return {
        api,
        getState: () => session.getState() as TState,
        getEvents: () => session.getEvents() as SimEvent<TState>[],
        getMetrics: () => session.getMetrics(),
      };
    }

    case 'dp': {
      const session = createDPSession(initialState as DPWorldState);
      const api: Record<string, unknown> = {
        get rows() {
          return session.rows;
        },
        get cols() {
          return session.cols;
        },
        get: guard((row: number, col: number) => session.get(row, col)),
        set: guard(
          (
            row: number,
            col: number,
            value: number,
            deps?: [number, number][]
          ) => session.set(row, col, value, deps)
        ),
        computeCell: guard((row: number, col: number) =>
          session.computeCell(row, col)
        ),
        traceOptimal: guard(() => session.traceOptimal()),
        runTabulation: guard(() => session.runTabulation()),
      };
      return {
        api,
        getState: () => session.getState() as TState,
        getEvents: () => session.getEvents() as SimEvent<TState>[],
        getMetrics: () => session.getMetrics(),
      };
    }

    case 'hash-table': {
      const session = createHashTableSession(
        initialState as HashTableWorldState
      );
      const api: Record<string, unknown> = {
        get capacity() {
          return session.capacity;
        },
        get strategy() {
          return session.strategy;
        },
        hash: guard((key: number) => session.hash(key)),
        loadFactor: guard(() => session.loadFactor()),
        pendingKeys: guard(() => session.pendingKeys()),
        setStrategy: guard((strategy: HashResolutionStrategy) =>
          session.setStrategy(strategy)
        ),
        insert: guard((key: number, value?: string) =>
          session.insert(key, value)
        ),
        insertAtBucket: guard((bucketIndex: number) =>
          session.insertAtBucket(bucketIndex)
        ),
        lookup: guard((key: number) => session.lookup(key)),
        remove: guard((key: number, useTombstone?: boolean) =>
          session.remove(key, useTombstone)
        ),
        rehash: guard((newCapacity?: number) => session.rehash(newCapacity)),
        markPair: guard((a: number, b: number) => session.markPair(a, b)),
      };
      return {
        api,
        getState: () => session.getState() as TState,
        getEvents: () => session.getEvents() as SimEvent<TState>[],
        getMetrics: () => session.getMetrics(),
      };
    }

    case 'heap': {
      const session = createHeapSession(initialState as HeapWorldState);
      const api: Record<string, unknown> = {
        size: guard(() => session.size()),
        peek: guard(() => session.peek()),
        get: guard((i: number) => session.get(i)),
        parent: guard((i: number) => session.parent(i)),
        left: guard((i: number) => session.left(i)),
        right: guard((i: number) => session.right(i)),
        pendingQueue: guard(() => session.pendingQueue()),
        extracted: guard(() => session.extracted()),
        select: guard((index: number | null) => session.select(index)),
        compare: guard((i: number, j: number) => session.compare(i, j)),
        swap: guard((i: number, j: number) => session.swap(i, j)),
        pushRaw: guard((value?: number) => session.pushRaw(value)),
        siftUp: guard((index: number) => session.siftUp(index)),
        siftDown: guard((index: number) => session.siftDown(index)),
        insert: guard((value?: number) => session.insert(value)),
        extractRoot: guard(() => session.extractRoot()),
        heapify: guard(() => session.heapify()),
        insertDual: guard((value?: number) => session.insertDual(value)),
      };
      return {
        api,
        getState: () => session.getState() as TState,
        getEvents: () => session.getEvents() as SimEvent<TState>[],
        getMetrics: () => session.getMetrics(),
      };
    }
  }
}

export function runPlayerCodeSync<T extends AnyWorldState>(
  level: LevelDefinition<T>,
  code: string
): CodeExecutionResult<T> {
  const startedAt =
    typeof performance !== 'undefined' ? performance.now() : Date.now();
  const elapsed = (): number =>
    Math.max(
      0,
      Math.round(
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
          startedAt
      )
    );

  const logs: string[] = [];
  const pushLog = (...args: unknown[]): void => {
    if (logs.length < MAX_LOGS) {
      logs.push(args.map(formatLogArg).join(' '));
    }
  };
  const sandboxConsole = {
    log: pushLog,
    info: pushLog,
    warn: (...args: unknown[]) => pushLog('[warn]', ...args),
    error: (...args: unknown[]) => pushLog('[error]', ...args),
  };

  const session = buildGuardedSession(cloneWorldState(level.initialState));

  let compiledFn: (
    api: Record<string, unknown>,
    console: typeof sandboxConsole
  ) => void;
  try {
    compiledFn = new Function(
      'api',
      'console',
      `"use strict";\n${code}`
    ) as typeof compiledFn;
  } catch (err) {
    return {
      ok: false,
      events: [],
      finalState: session.getState(),
      metrics: createEmptyMetrics(),
      logs,
      error: err instanceof Error ? err.message : String(err),
      errorType: 'SYNTAX',
      durationMs: elapsed(),
    };
  }

  try {
    compiledFn(session.api, sandboxConsole);
    const finalState = session.getState();
    const metrics = session.getMetrics();
    const score = evaluateLevel(level, finalState, metrics);

    return {
      ok: true,
      events: session.getEvents(),
      finalState,
      metrics,
      score,
      logs,
      durationMs: elapsed(),
    };
  } catch (err) {
    const isOpLimit = err instanceof ThermalOverloadError;
    return {
      ok: false,
      events: session.getEvents(),
      finalState: session.getState(),
      metrics: session.getMetrics(),
      logs,
      error: err instanceof Error ? err.message : String(err),
      errorType: isOpLimit ? 'OP_LIMIT' : 'RUNTIME',
      durationMs: elapsed(),
    };
  }
}

export function runPlayerCode<T extends AnyWorldState>(
  level: LevelDefinition<T>,
  code: string
): Promise<CodeExecutionResult<T>> {
  if (typeof Worker === 'undefined') {
    return Promise.resolve(runPlayerCodeSync(level, code));
  }

  const startedAt =
    typeof performance !== 'undefined' ? performance.now() : Date.now();

  return new Promise<CodeExecutionResult<T>>((resolve) => {
    let settled = false;
    let worker: Worker | null = null;

    try {
      worker = new Worker(new URL('./codeWorker.ts', import.meta.url), {
        type: 'module',
      });
    } catch {
      resolve(runPlayerCodeSync(level, code));
      return;
    }

    const finish = (result: CodeExecutionResult<T>): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (worker) {
        worker.terminate();
        worker = null;
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      const durationMs = Math.max(
        EXECUTION_TIMEOUT_MS,
        Math.round(
          (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
            startedAt
        )
      );
      finish({
        ok: false,
        events: [],
        finalState: cloneWorldState(level.initialState),
        metrics: createEmptyMetrics(),
        logs: [],
        error: `Execution timed out after ${EXECUTION_TIMEOUT_MS}ms (possible infinite loop).`,
        errorType: 'TIMEOUT',
        durationMs,
      });
    }, EXECUTION_TIMEOUT_MS);

    worker.onmessage = (event: MessageEvent<CodeExecutionResult<T>>) => {
      finish(event.data);
    };

    worker.onerror = (err) => {
      const durationMs = Math.max(
        0,
        Math.round(
          (typeof performance !== 'undefined' ? performance.now() : Date.now()) -
            startedAt
        )
      );
      finish({
        ok: false,
        events: [],
        finalState: cloneWorldState(level.initialState),
        metrics: createEmptyMetrics(),
        logs: [],
        error: err.message || 'Worker runtime error.',
        errorType: 'RUNTIME',
        durationMs,
      });
    };

    worker.postMessage({ level, code });
  });
}
