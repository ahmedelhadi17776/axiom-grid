import { createEmptyMetrics, evaluateScore } from '../scorer';
import type {
  LevelDefinition,
  LinkedListNode,
  LinkedListWorldState,
  ScoreReport,
  SimEvent,
  SimMetrics,
} from '../types';

export function cloneLinkedListState(
  state: LinkedListWorldState
): LinkedListWorldState {
  const nodes: Record<string, LinkedListNode> = {};
  for (const [id, node] of Object.entries(state.nodes)) {
    nodes[id] = {
      ...node,
      pos: [node.pos[0], node.pos[1], node.pos[2]],
    };
  }
  return {
    world: 'linked-lists',
    nodes,
    headId: state.headId,
    cursors: { ...state.cursors },
    targetSequence: state.targetSequence ? [...state.targetSequence] : undefined,
    hasCycle: state.hasCycle,
    cycleSevered: state.cycleSevered,
  };
}

export function detectCycleInList(state: LinkedListWorldState): {
  hasCycle: boolean;
  meetingNodeId: string | null;
} {
  if (!state.headId || !state.nodes[state.headId]) {
    return { hasCycle: false, meetingNodeId: null };
  }

  let slow: string | null = state.headId;
  let fast: string | null = state.headId;

  const maxSteps = Object.keys(state.nodes).length * 2 + 2;
  for (let step = 0; step < maxSteps; step++) {
    if (!slow || !fast) return { hasCycle: false, meetingNodeId: null };
    const slowNode: LinkedListNode | undefined = state.nodes[slow];
    const fastNode: LinkedListNode | undefined = state.nodes[fast];
    if (!slowNode || !fastNode || !fastNode.nextId) {
      return { hasCycle: false, meetingNodeId: null };
    }
    const fastNext: LinkedListNode | undefined = state.nodes[fastNode.nextId];
    if (!fastNext) {
      return { hasCycle: false, meetingNodeId: null };
    }

    slow = slowNode.nextId;
    fast = fastNext.nextId;

    if (slow !== null && slow === fast) {
      return { hasCycle: true, meetingNodeId: slow };
    }
  }

  return { hasCycle: false, meetingNodeId: null };
}

function computeReachableIds(state: LinkedListWorldState): Set<string> {
  const reachable = new Set<string>();
  let curr = state.headId;
  while (curr && state.nodes[curr] && !reachable.has(curr)) {
    reachable.add(curr);
    curr = state.nodes[curr].nextId;
  }
  return reachable;
}

export interface LinkedListSession {
  head(): string | null;
  getNode(id: string): LinkedListNode | null;
  link(fromId: string, toId: string | null): void;
  setHead(id: string | null): void;
  insertNode(
    id: string,
    value: number,
    afterId: string | null,
    pos?: [number, number, number]
  ): void;
  deleteNode(id: string): void;
  setCursor(name: string, nodeId: string | null): void;
  advance(cursorName: string): string | null;
  stepProbe(slowName?: string, fastName?: string): boolean;
  detectCycle(): { hasCycle: boolean; meetingNodeId: string | null };
  getState(): LinkedListWorldState;
  getEvents(): SimEvent<LinkedListWorldState>[];
  getMetrics(): SimMetrics;
}

export function createLinkedListSession(
  initialState: LinkedListWorldState
): LinkedListSession {
  const state = cloneLinkedListState(initialState);
  const events: SimEvent<LinkedListWorldState>[] = [];
  const metrics = createEmptyMetrics();
  let nextEventId = 1;

  const initialCycleInfo = detectCycleInList(state);
  const hadInitialCycle = Boolean(state.hasCycle || initialCycleInfo.hasCycle);
  state.hasCycle = initialCycleInfo.hasCycle;

  // Track nodes that have been part of the live chain from headId so floating
  // standby nodes waiting to be spliced in (e.g., Level 2.1) don't false-trigger leaks.
  const everReachable = computeReachableIds(state);

  const pushEvent = (
    type: SimEvent<LinkedListWorldState>['type'],
    label: string,
    pseudocodeLine: number,
    targets: string[],
    metricsDelta: Partial<SimMetrics>,
    pitchHint?: number
  ): void => {
    events.push({
      id: nextEventId++,
      type,
      label,
      pseudocodeLine,
      targets,
      pitchHint,
      metricsDelta,
      snapshot: cloneLinkedListState(state),
    });
  };

  const sweepReachabilityAndCycles = (): void => {
    const cycleInfo = detectCycleInList(state);
    state.hasCycle = cycleInfo.hasCycle;
    if (hadInitialCycle && !cycleInfo.hasCycle) {
      state.cycleSevered = true;
    }

    const reachable = computeReachableIds(state);
    for (const id of reachable) {
      everReachable.add(id);
    }

    const newlyLeaked: string[] = [];
    for (const node of Object.values(state.nodes)) {
      if (reachable.has(node.id)) {
        node.leaked = false;
      } else if (everReachable.has(node.id) && !node.corrupted) {
        if (!node.leaked) {
          node.leaked = true;
          newlyLeaked.push(node.id);
        }
      }
    }

    if (newlyLeaked.length > 0) {
      metrics.leaks += newlyLeaked.length;
      pushEvent(
        'MEMORY_LEAK',
        `Memory leak detected: node(s) ${newlyLeaked.join(', ')} unreachable from HEAD`,
        -1,
        newlyLeaked,
        { leaks: newlyLeaked.length },
        0
      );
    }
  };

  return {
    head(): string | null {
      return state.headId;
    },

    getNode(id: string): LinkedListNode | null {
      const node = state.nodes[id];
      if (!node) return null;
      return { ...node, pos: [node.pos[0], node.pos[1], node.pos[2]] };
    },

    link(fromId: string, toId: string | null): void {
      const fromNode = state.nodes[fromId];
      if (!fromNode) {
        metrics.cycles += 1;
        pushEvent(
          'NULL_DEREF',
          `Null dereference: source node "${fromId}" does not exist`,
          -1,
          [],
          { cycles: 1 },
          0
        );
        return;
      }
      if (toId !== null && !state.nodes[toId]) {
        metrics.cycles += 1;
        pushEvent(
          'NULL_DEREF',
          `Null dereference: target node "${toId}" does not exist`,
          -1,
          [fromId],
          { cycles: 1 },
          0
        );
        return;
      }

      fromNode.nextId = toId;
      metrics.cycles += 1;

      const eventType = toId === null ? 'UNLINK' : 'LINK';
      const label =
        toId === null
          ? `Unlink ${fromId}.next → NULL`
          : `Link ${fromId}.next → ${toId}`;

      // Update cycle status before snapshotting the LINK/UNLINK event
      const cycleInfo = detectCycleInList(state);
      state.hasCycle = cycleInfo.hasCycle;
      if (hadInitialCycle && !cycleInfo.hasCycle) {
        state.cycleSevered = true;
      }

      pushEvent(
        eventType,
        label,
        1,
        toId ? [fromId, toId] : [fromId],
        { cycles: 1 },
        toId ? 0.65 : 0.35
      );

      sweepReachabilityAndCycles();
    },

    setHead(id: string | null): void {
      if (id !== null && !state.nodes[id]) {
        metrics.cycles += 1;
        pushEvent(
          'NULL_DEREF',
          `Null dereference: cannot set HEAD to missing node "${id}"`,
          -1,
          [],
          { cycles: 1 },
          0
        );
        return;
      }

      state.headId = id;
      metrics.cycles += 1;

      const cycleInfo = detectCycleInList(state);
      state.hasCycle = cycleInfo.hasCycle;
      if (hadInitialCycle && !cycleInfo.hasCycle) {
        state.cycleSevered = true;
      }

      pushEvent(
        'MOVE_POINTER',
        `Set HEAD → ${id ?? 'NULL'}`,
        2,
        id ? [id] : [],
        { cycles: 1 },
        0.8
      );

      sweepReachabilityAndCycles();
    },

    insertNode(
      id: string,
      value: number,
      afterId: string | null,
      pos?: [number, number, number]
    ): void {
      if (afterId !== null && !state.nodes[afterId]) {
        metrics.cycles += 1;
        pushEvent(
          'NULL_DEREF',
          `Null dereference: cannot insert after missing node "${afterId}"`,
          -1,
          [],
          { cycles: 1 },
          0
        );
        return;
      }

      const existingCount = Object.keys(state.nodes).length;
      const defaultPos: [number, number, number] = [
        -4 + existingCount * 2.2,
        0,
        1.8,
      ];

      const newNode: LinkedListNode = {
        id,
        value,
        nextId: null,
        pos: pos ? [pos[0], pos[1], pos[2]] : defaultPos,
      };

      state.nodes[id] = newNode;
      if (afterId === null) {
        newNode.nextId = state.headId;
        state.headId = id;
      } else {
        const prev = state.nodes[afterId];
        newNode.nextId = prev.nextId;
        prev.nextId = id;
      }

      metrics.cycles += 1;
      pushEvent(
        'LINK',
        `Insert node ${id}(${value}) ${afterId ? `after ${afterId}` : 'at HEAD'}`,
        1,
        afterId ? [afterId, id] : [id],
        { cycles: 1 },
        0.7
      );

      sweepReachabilityAndCycles();
    },

    deleteNode(id: string): void {
      const target = state.nodes[id];
      if (!target) {
        metrics.cycles += 1;
        pushEvent(
          'NULL_DEREF',
          `Null dereference: cannot delete missing node "${id}"`,
          -1,
          [],
          { cycles: 1 },
          0
        );
        return;
      }

      const nextId = target.nextId;
      if (state.headId === id) {
        state.headId = nextId;
      }
      for (const node of Object.values(state.nodes)) {
        if (node.id !== id && node.nextId === id) {
          node.nextId = nextId;
        }
      }
      for (const [cName, cVal] of Object.entries(state.cursors)) {
        if (cVal === id) {
          state.cursors[cName] = null;
        }
      }

      delete state.nodes[id];
      everReachable.delete(id);
      metrics.cycles += 1;

      pushEvent(
        'UNLINK',
        `Delete node ${id}(${target.value})`,
        2,
        nextId ? [nextId] : [],
        { cycles: 1 },
        0.3
      );

      sweepReachabilityAndCycles();
    },

    setCursor(name: string, nodeId: string | null): void {
      if (nodeId !== null && !state.nodes[nodeId]) {
        metrics.cycles += 1;
        pushEvent(
          'NULL_DEREF',
          `Null dereference: cannot set cursor "${name}" to missing node "${nodeId}"`,
          -1,
          [],
          { cycles: 1 },
          0
        );
        return;
      }

      state.cursors[name] = nodeId;
      pushEvent(
        'MOVE_POINTER',
        `Cursor ${name} → ${nodeId ?? 'NULL'}`,
        0,
        nodeId ? [nodeId] : [],
        {},
        0.55
      );
    },

    advance(cursorName: string): string | null {
      const currId = state.cursors[cursorName] ?? null;
      if (!currId || !state.nodes[currId]) {
        metrics.cycles += 1;
        pushEvent(
          'NULL_DEREF',
          `Null dereference: cannot advance cursor "${cursorName}" from NULL`,
          -1,
          [],
          { cycles: 1 },
          0
        );
        return null;
      }

      const nextId = state.nodes[currId].nextId;
      state.cursors[cursorName] = nextId;
      metrics.cycles += 1;

      pushEvent(
        'TRAVERSE',
        `Advance ${cursorName}: ${currId} → ${nextId ?? 'NULL'}`,
        1,
        nextId ? [currId, nextId] : [currId],
        { cycles: 1 },
        0.5
      );

      return nextId;
    },

    stepProbe(slowName = 'slow', fastName = 'fast'): boolean {
      if (state.cursors[slowName] === undefined) {
        state.cursors[slowName] = state.headId;
      }
      if (state.cursors[fastName] === undefined) {
        state.cursors[fastName] = state.headId;
      }

      const slowCurr = state.cursors[slowName];
      const fastCurr = state.cursors[fastName];

      const slowNode = slowCurr ? state.nodes[slowCurr] : undefined;
      const fastNode = fastCurr ? state.nodes[fastCurr] : undefined;

      const nextSlow = slowNode ? slowNode.nextId : null;
      const fastMid = fastNode ? fastNode.nextId : null;
      const fastMidNode = fastMid ? state.nodes[fastMid] : undefined;
      const nextFast = fastMidNode ? fastMidNode.nextId : null;

      state.cursors[slowName] = nextSlow;
      state.cursors[fastName] = nextFast;
      metrics.cycles += 1;

      if (nextSlow !== null && nextSlow === nextFast) {
        pushEvent(
          'CYCLE_DETECTED',
          `Cycle detected! ${slowName} & ${fastName} met at ${nextSlow}`,
          3,
          [nextSlow],
          { cycles: 1 },
          0.95
        );
        return true;
      }

      const targets: string[] = [];
      if (nextSlow) targets.push(nextSlow);
      if (nextFast) targets.push(nextFast);

      pushEvent(
        'TRAVERSE',
        `Probe step: ${slowName}→${nextSlow ?? 'NULL'}, ${fastName}→${nextFast ?? 'NULL'}`,
        2,
        targets,
        { cycles: 1 },
        0.6
      );
      return false;
    },

    detectCycle(): { hasCycle: boolean; meetingNodeId: string | null } {
      return detectCycleInList(state);
    },

    getState(): LinkedListWorldState {
      return cloneLinkedListState(state);
    },

    getEvents(): SimEvent<LinkedListWorldState>[] {
      return events;
    },

    getMetrics(): SimMetrics {
      return { ...metrics };
    },
  };
}

function traverseValuesSafe(state: LinkedListWorldState): {
  values: number[];
  hasCycle: boolean;
} {
  const visited = new Set<string>();
  const values: number[] = [];
  let curr = state.headId;
  while (curr && state.nodes[curr]) {
    if (visited.has(curr)) {
      return { values, hasCycle: true };
    }
    visited.add(curr);
    values.push(state.nodes[curr].value);
    curr = state.nodes[curr].nextId;
  }
  return { values, hasCycle: false };
}

function seqMatches(actual: number[], expected?: number[]): boolean {
  if (!expected) return true;
  if (actual.length !== expected.length) return false;
  for (let i = 0; i < expected.length; i++) {
    if (actual[i] !== expected[i]) return false;
  }
  return true;
}

export function evaluateLinkedListLevel(
  level: LevelDefinition<LinkedListWorldState>,
  state: LinkedListWorldState,
  metrics: SimMetrics
): ScoreReport {
  const { values, hasCycle } = traverseValuesSafe(state);
  const expected = state.targetSequence ?? level.initialState.targetSequence;
  const hasActiveLeak = Object.values(state.nodes).some(
    (n) => n.leaked && !n.corrupted
  );
  const effectiveMetrics: SimMetrics =
    !level.strictNoLeaks && !hasActiveLeak
      ? { ...metrics, leaks: 0 }
      : metrics;
  const kind = level.objectiveKind ?? 'sequence-match';

  if (kind === 'sever-cycle') {
    if (hasCycle || state.hasCycle) {
      return evaluateScore(
        false,
        effectiveMetrics,
        level.par,
        level.insight,
        'Cycle still active! Sever the looping tether to terminate the chain.'
      );
    }
    if (!state.cycleSevered) {
      return evaluateScore(
        false,
        effectiveMetrics,
        level.par,
        level.insight,
        'Cycle has not been severed yet.'
      );
    }
    if (level.strictNoLeaks && (metrics.leaks > 0 || hasActiveLeak)) {
      return evaluateScore(
        false,
        effectiveMetrics,
        level.par,
        level.insight,
        `Memory leak violation (${metrics.leaks} leaked node(s)). Keep all chain nodes reachable.`
      );
    }
    if (!seqMatches(values, expected)) {
      return evaluateScore(
        false,
        effectiveMetrics,
        level.par,
        level.insight,
        `Expected chain [${expected?.join(' → ')}], got [${values.join(' → ')}].`
      );
    }
    return evaluateScore(true, effectiveMetrics, level.par, level.insight);
  }

  // Default: 'sequence-match'
  if (hasCycle) {
    return evaluateScore(
      false,
      effectiveMetrics,
      level.par,
      level.insight,
      'Infinite loop detected in chain! Break the cycle so traversal terminates at NULL.'
    );
  }
  if (level.strictNoLeaks && (metrics.leaks > 0 || hasActiveLeak)) {
    return evaluateScore(
      false,
      effectiveMetrics,
      level.par,
      level.insight,
      `Zero-leak rule violated (${metrics.leaks} memory leak event(s)). Wire the downstream link before rewiring the predecessor!`
    );
  }
  if (!seqMatches(values, expected)) {
    return evaluateScore(
      false,
      effectiveMetrics,
      level.par,
      level.insight,
      `Chain mismatch: expected [${expected?.join(' → ')}], got [${values.join(' → ')}].`
    );
  }

  return evaluateScore(true, effectiveMetrics, level.par, level.insight);
}
