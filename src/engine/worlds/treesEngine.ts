import { createEmptyMetrics, evaluateScore } from '../scorer';
import type {
  LevelDefinition,
  ScoreReport,
  SimEvent,
  SimMetrics,
  TreeNode,
  TreesWorldState,
  TreeTraversalOrder,
} from '../types';

export function cloneTreesState(state: TreesWorldState): TreesWorldState {
  const nodes: Record<string, TreeNode> = {};
  for (const [id, node] of Object.entries(state.nodes)) {
    nodes[id] = {
      ...node,
      pos: [node.pos[0], node.pos[1], node.pos[2]],
    };
  }
  return {
    world: 'trees',
    mode: state.mode,
    nodes,
    rootId: state.rootId,
    selectedNodeId: state.selectedNodeId,
    pendingQueue: [...state.pendingQueue],
    visitedSequence: [...state.visitedSequence],
    targetSequence: state.targetSequence ? [...state.targetSequence] : undefined,
    searchTarget: state.searchTarget,
    foundNodeId: state.foundNodeId,
    expectedValues: state.expectedValues ? [...state.expectedValues] : undefined,
    showBalanceFactors: state.showBalanceFactors,
    invariantViolations: state.invariantViolations,
  };
}

/**
 * Recomputes exact subtree height, AVL balanceFactor = height(left) - height(right),
 * and non-overlapping 3D isometric canopy coordinates (x, y, z) for every node.
 * Root sits near z = -3.8; deeper levels step forward in +z and gently down in y.
 */
export function recomputeTreeLayoutAndMetrics(state: TreesWorldState): void {
  const reachable = new Set<string>();
  const depths = new Map<string, number>();
  const inOrderSlots = new Map<string, number>();
  let nextSlot = 0;
  let maxDepth = 0;

  const computeHeightAndOrder = (id: string | null, depth: number): number => {
    if (!id || !state.nodes[id] || reachable.has(id)) return 0;
    reachable.add(id);
    depths.set(id, depth);
    if (depth > maxDepth) maxDepth = depth;

    const node = state.nodes[id];
    const leftH = computeHeightAndOrder(node.leftId, depth + 1);
    inOrderSlots.set(id, nextSlot++);
    const rightH = computeHeightAndOrder(node.rightId, depth + 1);

    node.balanceFactor = leftH - rightH;
    return 1 + Math.max(leftH, rightH);
  };

  computeHeightAndOrder(state.rootId, 0);

  const count = inOrderSlots.size;
  if (count > 0) {
    const xStep = count <= 3 ? 2.2 : count <= 7 ? 1.75 : 1.5;
    const zStep = maxDepth <= 3 ? 2.2 : 1.85;
    const centerSlot = (count - 1) / 2;

    for (const [id, slot] of inOrderSlots.entries()) {
      const node = state.nodes[id];
      const depth = depths.get(id) ?? 0;
      const x = Number(((slot - centerSlot) * xStep).toFixed(3));
      const y = Number((0.6 - depth * 0.22).toFixed(3));
      const z = Number((-3.8 + depth * zStep).toFixed(3));
      node.pos = [x, y, z];
    }
  }

  for (const [id, node] of Object.entries(state.nodes)) {
    if (!reachable.has(id)) {
      node.balanceFactor = 0;
    }
  }
}

/**
 * Validates that the tree rooted at `state.rootId` is acyclic, has no shared
 * child pointers, and satisfies the strict global BST invariant (min < val < max).
 */
export function isValidBST(state: TreesWorldState): boolean {
  if (!state.rootId) return true;
  if (!state.nodes[state.rootId]) return false;

  const seen = new Set<string>();
  const validate = (id: string | null, min: number, max: number): boolean => {
    if (!id) return true;
    if (seen.has(id)) return false;
    const node = state.nodes[id];
    if (!node) return false;
    if (node.value <= min || node.value >= max) return false;
    seen.add(id);
    return (
      validate(node.leftId, min, node.value) &&
      validate(node.rightId, node.value, max)
    );
  };

  return validate(state.rootId, -Infinity, Infinity);
}

function collectReachableNodes(state: TreesWorldState): TreeNode[] {
  const result: TreeNode[] = [];
  const seen = new Set<string>();
  const walk = (id: string | null): void => {
    if (!id || seen.has(id) || !state.nodes[id]) return;
    seen.add(id);
    const node = state.nodes[id];
    result.push(node);
    walk(node.leftId);
    walk(node.rightId);
  };
  walk(state.rootId);
  return result;
}

function normalizePitch(value: number, nodes: Record<string, TreeNode>): number {
  const vals = Object.values(nodes).map((n) => n.value);
  if (vals.length === 0) return 0.5;
  let min = Infinity;
  let max = -Infinity;
  for (const v of vals) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export interface TreesSession {
  root(): string | null;
  getNode(id: string): TreeNode | null;
  getBalanceFactor(id: string): number;
  pendingQueue(): number[];
  selectNode(id: string | null): void;
  probe(id: string): number;
  insert(value: number): string | null;
  insertAt(
    parentId: string | null,
    side: 'left' | 'right',
    value?: number
  ): string | null;
  visitNode(id: string): void;
  runTraversal(order: TreeTraversalOrder): number[];
  deleteNode(id: string): boolean;
  rotateLeft(id: string): boolean;
  rotateRight(id: string): boolean;
  autoBalance(): number;
  getState(): TreesWorldState;
  getEvents(): SimEvent<TreesWorldState>[];
  getMetrics(): SimMetrics;
}

export function createTreesSession(initialState: TreesWorldState): TreesSession {
  const state = cloneTreesState(initialState);
  recomputeTreeLayoutAndMetrics(state);

  const events: SimEvent<TreesWorldState>[] = [];
  const metrics = createEmptyMetrics();
  let nextEventId = 1;
  let nextNodeSeq = Object.keys(state.nodes).length + 1;

  const allocNodeId = (): string => {
    while (state.nodes[`t${nextNodeSeq}`]) {
      nextNodeSeq += 1;
    }
    return `t${nextNodeSeq++}`;
  };

  const clearHighlights = (): void => {
    for (const node of Object.values(state.nodes)) {
      node.highlighted = false;
    }
  };

  const drainPendingKey = (value: number): void => {
    if (state.pendingQueue.length === 0) return;
    if (state.pendingQueue[0] === value) {
      state.pendingQueue.shift();
      return;
    }
    const idx = state.pendingQueue.indexOf(value);
    if (idx !== -1) {
      state.pendingQueue.splice(idx, 1);
    }
  };

  const pushEvent = (
    type: SimEvent<TreesWorldState>['type'],
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
      snapshot: cloneTreesState(state),
    });
  };

  const findParent = (
    targetId: string
  ): { parentId: string | null; side: 'left' | 'right' | null } => {
    if (state.rootId === targetId) {
      return { parentId: null, side: null };
    }
    const seen = new Set<string>();
    const stack: string[] = state.rootId ? [state.rootId] : [];
    while (stack.length > 0) {
      const currId = stack.pop()!;
      if (seen.has(currId)) continue;
      seen.add(currId);
      const curr = state.nodes[currId];
      if (!curr) continue;
      if (curr.leftId === targetId) return { parentId: currId, side: 'left' };
      if (curr.rightId === targetId) return { parentId: currId, side: 'right' };
      if (curr.leftId) stack.push(curr.leftId);
      if (curr.rightId) stack.push(curr.rightId);
    }
    return { parentId: null, side: null };
  };

  const getSlotBounds = (
    parentId: string,
    side: 'left' | 'right'
  ): { min: number; max: number } | null => {
    if (!state.rootId) return null;
    const seen = new Set<string>();
    const dfs = (
      currId: string | null,
      min: number,
      max: number
    ): { min: number; max: number } | null => {
      if (!currId || seen.has(currId) || !state.nodes[currId]) return null;
      seen.add(currId);
      const node = state.nodes[currId];
      if (currId === parentId) {
        return side === 'left'
          ? { min, max: node.value }
          : { min: node.value, max };
      }
      const leftRes = dfs(node.leftId, min, node.value);
      if (leftRes) return leftRes;
      return dfs(node.rightId, node.value, max);
    };
    return dfs(state.rootId, -Infinity, Infinity);
  };

  const rotateLeftImpl = (id: string): boolean => {
    const x = state.nodes[id];
    if (!x || !x.rightId || !state.nodes[x.rightId]) {
      metrics.cycles += 1;
      pushEvent(
        'INVARIANT_FAULT',
        `Cannot rotate left around ${id}: missing right child`,
        -1,
        x ? [id] : [],
        { cycles: 1 },
        0
      );
      return false;
    }

    const yId = x.rightId;
    const y = state.nodes[yId];
    const t2 = y.leftId;
    const { parentId, side } = findParent(id);

    y.leftId = id;
    x.rightId = t2;

    if (parentId === null) {
      state.rootId = yId;
    } else if (side === 'left') {
      state.nodes[parentId].leftId = yId;
    } else if (side === 'right') {
      state.nodes[parentId].rightId = yId;
    }

    clearHighlights();
    y.highlighted = true;
    x.highlighted = true;
    state.selectedNodeId = yId;
    recomputeTreeLayoutAndMetrics(state);

    metrics.cycles += 1;
    pushEvent(
      'ROTATE_LEFT',
      `Rotate Left around ${id}(${x.value}) → pivot ${yId}(${y.value})`,
      2,
      [id, yId],
      { cycles: 1 },
      0.72
    );
    return true;
  };

  const rotateRightImpl = (id: string): boolean => {
    const x = state.nodes[id];
    if (!x || !x.leftId || !state.nodes[x.leftId]) {
      metrics.cycles += 1;
      pushEvent(
        'INVARIANT_FAULT',
        `Cannot rotate right around ${id}: missing left child`,
        -1,
        x ? [id] : [],
        { cycles: 1 },
        0
      );
      return false;
    }

    const yId = x.leftId;
    const y = state.nodes[yId];
    const t2 = y.rightId;
    const { parentId, side } = findParent(id);

    y.rightId = id;
    x.leftId = t2;

    if (parentId === null) {
      state.rootId = yId;
    } else if (side === 'left') {
      state.nodes[parentId].leftId = yId;
    } else if (side === 'right') {
      state.nodes[parentId].rightId = yId;
    }

    clearHighlights();
    y.highlighted = true;
    x.highlighted = true;
    state.selectedNodeId = yId;
    recomputeTreeLayoutAndMetrics(state);

    metrics.cycles += 1;
    pushEvent(
      'ROTATE_RIGHT',
      `Rotate Right around ${id}(${x.value}) → pivot ${yId}(${y.value})`,
      2,
      [id, yId],
      { cycles: 1 },
      0.68
    );
    return true;
  };

  return {
    root(): string | null {
      return state.rootId;
    },

    getNode(id: string): TreeNode | null {
      const node = state.nodes[id];
      if (!node) return null;
      return { ...node, pos: [node.pos[0], node.pos[1], node.pos[2]] };
    },

    getBalanceFactor(id: string): number {
      return state.nodes[id]?.balanceFactor ?? 0;
    },

    pendingQueue(): number[] {
      return [...state.pendingQueue];
    },

    selectNode(id: string | null): void {
      const validId = id && state.nodes[id] ? id : null;
      state.selectedNodeId = validId;
      pushEvent(
        'MOVE_POINTER',
        validId
          ? `Select node ${validId}(${state.nodes[validId].value})`
          : 'Clear node selection',
        0,
        validId ? [validId] : [],
        {},
        0.5
      );
    },

    probe(id: string): number {
      const node = state.nodes[id];
      if (!node) {
        metrics.cycles += 1;
        pushEvent(
          'NULL_DEREF',
          `Null dereference: node "${id}" does not exist`,
          -1,
          [],
          { cycles: 1 },
          0
        );
        return 0;
      }

      clearHighlights();
      node.highlighted = true;
      state.selectedNodeId = id;
      metrics.cycles += 1;

      const target = state.searchTarget;
      if (target === undefined) {
        pushEvent(
          'PROBE',
          `Probe ${id}(${node.value})`,
          1,
          [id],
          { cycles: 1 },
          normalizePitch(node.value, state.nodes)
        );
        return 0;
      }

      const cmp = node.value < target ? -1 : node.value > target ? 1 : 0;
      if (cmp === 0) {
        state.foundNodeId = id;
      }

      const label =
        cmp === 0
          ? `Target ${target} locked at ${id}!`
          : cmp < 0
            ? `Probe ${id}(${node.value}) < ${target} — branch RIGHT`
            : `Probe ${id}(${node.value}) > ${target} — branch LEFT`;

      pushEvent(
        'PROBE',
        label,
        cmp === 0 ? 3 : 2,
        [id],
        { cycles: 1 },
        cmp === 0 ? 0.95 : normalizePitch(node.value, state.nodes)
      );
      return cmp;
    },

    insert(value: number): string | null {
      clearHighlights();

      if (!state.rootId || !state.nodes[state.rootId]) {
        const newId = allocNodeId();
        state.nodes[newId] = {
          id: newId,
          value,
          leftId: null,
          rightId: null,
          pos: [0, 0.6, -3.8],
          highlighted: true,
        };
        state.rootId = newId;
        state.selectedNodeId = newId;
        drainPendingKey(value);
        recomputeTreeLayoutAndMetrics(state);
        metrics.cycles += 1;
        pushEvent(
          'INSERT_NODE',
          `Insert root ${newId}(${value})`,
          1,
          [newId],
          { cycles: 1 },
          normalizePitch(value, state.nodes)
        );
        return newId;
      }

      let currId: string | null = state.rootId;
      const visited = new Set<string>();

      while (currId && state.nodes[currId] && !visited.has(currId)) {
        visited.add(currId);
        const curr: TreeNode = state.nodes[currId];
        if (value === curr.value) {
          state.invariantViolations += 1;
          metrics.cycles += 1;
          pushEvent(
            'INVARIANT_FAULT',
            `Duplicate key ${value} rejected at ${currId}`,
            -1,
            [currId],
            { cycles: 1 },
            0
          );
          return null;
        }

        const goLeft: boolean = value < curr.value;
        const nextId: string | null = goLeft ? curr.leftId : curr.rightId;

        if (nextId && state.nodes[nextId]) {
          clearHighlights();
          curr.highlighted = true;
          pushEvent(
            'TRAVERSE',
            `Compare ${value} ${goLeft ? '<' : '>'} ${currId}(${curr.value}) → ${goLeft ? 'left' : 'right'}`,
            1,
            [currId, nextId],
            {},
            normalizePitch(curr.value, state.nodes)
          );
          currId = nextId;
        } else {
          const newId = allocNodeId();
          state.nodes[newId] = {
            id: newId,
            value,
            leftId: null,
            rightId: null,
            pos: [curr.pos[0], curr.pos[1], curr.pos[2]],
            highlighted: true,
          };
          if (goLeft) {
            curr.leftId = newId;
          } else {
            curr.rightId = newId;
          }
          clearHighlights();
          state.nodes[newId].highlighted = true;
          state.selectedNodeId = newId;
          drainPendingKey(value);
          recomputeTreeLayoutAndMetrics(state);

          metrics.cycles += 1;
          pushEvent(
            'INSERT_NODE',
            `Insert ${newId}(${value}) as ${goLeft ? 'left' : 'right'} child of ${currId}(${curr.value})`,
            2,
            [currId, newId],
            { cycles: 1 },
            normalizePitch(value, state.nodes)
          );
          return newId;
        }
      }

      return null;
    },

    insertAt(
      parentId: string | null,
      side: 'left' | 'right',
      value?: number
    ): string | null {
      const val =
        value !== undefined
          ? value
          : state.pendingQueue.length > 0
            ? state.pendingQueue[0]
            : undefined;
      if (val === undefined) return null;

      clearHighlights();

      if (parentId === null) {
        if (state.rootId !== null) {
          state.invariantViolations += 1;
          metrics.cycles += 1;
          pushEvent(
            'INVARIANT_FAULT',
            `Root already exists — cannot dock ${val} at root`,
            -1,
            [state.rootId],
            { cycles: 1 },
            0
          );
          return null;
        }
        const newId = allocNodeId();
        state.nodes[newId] = {
          id: newId,
          value: val,
          leftId: null,
          rightId: null,
          pos: [0, 0.6, -3.8],
          highlighted: true,
        };
        state.rootId = newId;
        state.selectedNodeId = newId;
        drainPendingKey(val);
        recomputeTreeLayoutAndMetrics(state);
        metrics.cycles += 1;
        pushEvent(
          'INSERT_NODE',
          `Dock root ${newId}(${val})`,
          1,
          [newId],
          { cycles: 1 },
          normalizePitch(val, state.nodes)
        );
        return newId;
      }

      const parent = state.nodes[parentId];
      if (!parent) {
        metrics.cycles += 1;
        pushEvent(
          'NULL_DEREF',
          `Null dereference: parent node "${parentId}" does not exist`,
          -1,
          [],
          { cycles: 1 },
          0
        );
        return null;
      }

      const existingChild = side === 'left' ? parent.leftId : parent.rightId;
      if (existingChild !== null) {
        state.invariantViolations += 1;
        metrics.cycles += 1;
        pushEvent(
          'INVARIANT_FAULT',
          `Socket ${parentId}.${side} is already occupied by ${existingChild}`,
          -1,
          [parentId, existingChild],
          { cycles: 1 },
          0
        );
        return null;
      }

      const bounds = getSlotBounds(parentId, side);
      if (!bounds || val <= bounds.min || val >= bounds.max) {
        state.invariantViolations += 1;
        metrics.cycles += 1;
        const minLabel =
          !bounds || bounds.min === -Infinity ? '-∞' : String(bounds.min);
        const maxLabel =
          !bounds || bounds.max === Infinity ? '+∞' : String(bounds.max);
        pushEvent(
          'INVARIANT_FAULT',
          `BST Invariant Fault: ${val} cannot dock at ${parentId}.${side} (valid range: ${minLabel} < k < ${maxLabel})`,
          -1,
          [parentId],
          { cycles: 1 },
          0
        );
        return null;
      }

      const newId = allocNodeId();
      state.nodes[newId] = {
        id: newId,
        value: val,
        leftId: null,
        rightId: null,
        pos: [...parent.pos],
        highlighted: true,
      };
      if (side === 'left') {
        parent.leftId = newId;
      } else {
        parent.rightId = newId;
      }
      state.selectedNodeId = newId;
      drainPendingKey(val);
      recomputeTreeLayoutAndMetrics(state);

      metrics.cycles += 1;
      pushEvent(
        'INSERT_NODE',
        `Dock ${newId}(${val}) at ${parentId}.${side}`,
        2,
        [parentId, newId],
        { cycles: 1 },
        normalizePitch(val, state.nodes)
      );
      return newId;
    },

    visitNode(id: string): void {
      const node = state.nodes[id];
      if (!node) {
        metrics.cycles += 1;
        pushEvent(
          'NULL_DEREF',
          `Null dereference: node "${id}" does not exist`,
          -1,
          [],
          { cycles: 1 },
          0
        );
        return;
      }

      clearHighlights();
      node.highlighted = true;
      state.selectedNodeId = id;

      if (node.visitedOrder !== undefined) {
        return;
      }

      state.visitedSequence.push(node.value);
      node.visitedOrder = state.visitedSequence.length;
      metrics.cycles += 1;

      pushEvent(
        'TRAVERSE',
        `Visit #${node.visitedOrder}: ${id}(${node.value})`,
        2,
        [id],
        { cycles: 1 },
        normalizePitch(node.value, state.nodes)
      );
    },

    runTraversal(order: TreeTraversalOrder): number[] {
      state.visitedSequence = [];
      for (const node of Object.values(state.nodes)) {
        node.visitedOrder = undefined;
        node.highlighted = false;
      }

      if (!state.rootId || !state.nodes[state.rootId]) {
        return [];
      }

      let peakAux = 0;

      const emitVisit = (nodeId: string, currentAux: number): void => {
        const node = state.nodes[nodeId];
        if (!node) return;
        clearHighlights();
        node.highlighted = true;
        state.selectedNodeId = nodeId;
        state.visitedSequence.push(node.value);
        node.visitedOrder = state.visitedSequence.length;

        if (currentAux > peakAux) peakAux = currentAux;
        if (peakAux > metrics.auxMemory) metrics.auxMemory = peakAux;
        metrics.cycles += 1;

        pushEvent(
          'TRAVERSE',
          `${order.toUpperCase()} #${node.visitedOrder}: ${nodeId}(${node.value})`,
          2,
          [nodeId],
          { cycles: 1, auxMemory: metrics.auxMemory },
          normalizePitch(node.value, state.nodes)
        );
      };

      if (order === 'levelorder') {
        const queue: string[] = [state.rootId];
        const seen = new Set<string>([state.rootId]);
        peakAux = Math.max(peakAux, queue.length);

        while (queue.length > 0) {
          peakAux = Math.max(peakAux, queue.length);
          const currId = queue.shift()!;
          const curr = state.nodes[currId];
          if (!curr) continue;

          if (curr.leftId && state.nodes[curr.leftId] && !seen.has(curr.leftId)) {
            seen.add(curr.leftId);
            queue.push(curr.leftId);
          }
          if (curr.rightId && state.nodes[curr.rightId] && !seen.has(curr.rightId)) {
            seen.add(curr.rightId);
            queue.push(curr.rightId);
          }
          peakAux = Math.max(peakAux, queue.length);
          emitVisit(currId, peakAux);
        }
      } else {
        const seen = new Set<string>();
        const dfs = (id: string | null, depth: number): void => {
          if (!id || seen.has(id) || !state.nodes[id]) return;
          seen.add(id);
          if (depth > peakAux) peakAux = depth;
          const node = state.nodes[id];

          if (order === 'preorder') {
            emitVisit(id, depth);
            dfs(node.leftId, depth + 1);
            dfs(node.rightId, depth + 1);
          } else if (order === 'inorder') {
            dfs(node.leftId, depth + 1);
            emitVisit(id, depth);
            dfs(node.rightId, depth + 1);
          } else {
            dfs(node.leftId, depth + 1);
            dfs(node.rightId, depth + 1);
            emitVisit(id, depth);
          }
        };
        dfs(state.rootId, 1);
      }

      return [...state.visitedSequence];
    },

    deleteNode(id: string): boolean {
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
        return false;
      }

      const { parentId, side } = findParent(id);
      const replaceParentLink = (replacementId: string | null): void => {
        if (parentId === null) {
          state.rootId = replacementId;
        } else if (side === 'left') {
          state.nodes[parentId].leftId = replacementId;
        } else if (side === 'right') {
          state.nodes[parentId].rightId = replacementId;
        }
      };

      const deletedValue = target.value;
      let promotedId: string | null = null;

      if (!target.leftId && !target.rightId) {
        // 0-child leaf deletion
        replaceParentLink(null);
        delete state.nodes[id];
      } else if (!target.leftId || !target.rightId) {
        // 1-child bypass
        const childId = target.leftId ?? target.rightId;
        replaceParentLink(childId);
        promotedId = childId;
        delete state.nodes[id];
      } else {
        // 2-child in-order successor promotion
        let succParentId = id;
        let succId = target.rightId;
        const pathTargets: string[] = [id, succId];

        while (state.nodes[succId]?.leftId) {
          succParentId = succId;
          succId = state.nodes[succId].leftId!;
          pathTargets.push(succId);
        }

        const succ = state.nodes[succId];
        clearHighlights();
        succ.highlighted = true;
        pushEvent(
          'TRAVERSE',
          `Locate in-order successor ${succId}(${succ.value}) for ${id}(${deletedValue})`,
          2,
          pathTargets,
          {},
          normalizePitch(succ.value, state.nodes)
        );

        if (succParentId === id) {
          succ.leftId = target.leftId;
        } else {
          state.nodes[succParentId].leftId = succ.rightId;
          succ.leftId = target.leftId;
          succ.rightId = target.rightId;
        }

        replaceParentLink(succId);
        promotedId = succId;
        delete state.nodes[id];
      }

      if (state.selectedNodeId === id) {
        state.selectedNodeId = promotedId;
      }
      if (state.foundNodeId === id) {
        state.foundNodeId = null;
      }

      clearHighlights();
      if (promotedId && state.nodes[promotedId]) {
        state.nodes[promotedId].highlighted = true;
      }
      recomputeTreeLayoutAndMetrics(state);

      metrics.cycles += 1;
      pushEvent(
        'DELETE_NODE',
        promotedId && state.nodes[promotedId]
          ? `Delete ${id}(${deletedValue}) → promoted ${promotedId}(${state.nodes[promotedId].value})`
          : `Delete leaf ${id}(${deletedValue})`,
        3,
        promotedId ? [id, promotedId] : [id],
        { cycles: 1 },
        0.35
      );
      return true;
    },

    rotateLeft(id: string): boolean {
      return rotateLeftImpl(id);
    },

    rotateRight(id: string): boolean {
      return rotateRightImpl(id);
    },

    autoBalance(): number {
      let rotations = 0;
      const maxRotations = Math.max(4, Object.keys(state.nodes).length * 4);

      const findDeepestImbalanced = (id: string | null, seen: Set<string>): string | null => {
        if (!id || seen.has(id) || !state.nodes[id]) return null;
        seen.add(id);
        const node = state.nodes[id];
        const leftImb = findDeepestImbalanced(node.leftId, seen);
        if (leftImb) return leftImb;
        const rightImb = findDeepestImbalanced(node.rightId, seen);
        if (rightImb) return rightImb;
        if (Math.abs(node.balanceFactor ?? 0) > 1) return id;
        return null;
      };

      while (rotations < maxRotations) {
        recomputeTreeLayoutAndMetrics(state);
        const targetId = findDeepestImbalanced(state.rootId, new Set());
        if (!targetId) break;

        const node = state.nodes[targetId];
        const bf = node.balanceFactor ?? 0;

        if (bf > 1 && node.leftId) {
          const leftBf = state.nodes[node.leftId]?.balanceFactor ?? 0;
          if (leftBf < 0) {
            if (rotateLeftImpl(node.leftId)) rotations += 1;
          }
          if (rotateRightImpl(targetId)) {
            rotations += 1;
          } else {
            break;
          }
        } else if (bf < -1 && node.rightId) {
          const rightBf = state.nodes[node.rightId]?.balanceFactor ?? 0;
          if (rightBf > 0) {
            if (rotateRightImpl(node.rightId)) rotations += 1;
          }
          if (rotateLeftImpl(targetId)) {
            rotations += 1;
          } else {
            break;
          }
        } else {
          break;
        }
      }

      return rotations;
    },

    getState(): TreesWorldState {
      return cloneTreesState(state);
    },

    getEvents(): SimEvent<TreesWorldState>[] {
      return events;
    },

    getMetrics(): SimMetrics {
      return { ...metrics };
    },
  };
}

function sortedNumbersEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort((x, y) => x - y);
  const sb = [...b].sort((x, y) => x - y);
  for (let i = 0; i < sa.length; i++) {
    if (sa[i] !== sb[i]) return false;
  }
  return true;
}

function exactNumbersEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function evaluateTreesLevel(
  level: LevelDefinition<TreesWorldState>,
  state: TreesWorldState,
  metrics: SimMetrics
): ScoreReport {
  if (
    level.maxCyclesBudget !== undefined &&
    metrics.cycles > level.maxCyclesBudget
  ) {
    return evaluateScore(
      false,
      metrics,
      level.par,
      level.insight,
      `Cycle budget exceeded (${metrics.cycles} / ${level.maxCyclesBudget} cycles).`
    );
  }

  const evalState = cloneTreesState(state);
  recomputeTreeLayoutAndMetrics(evalState);

  const reachableNodes = collectReachableNodes(evalState);
  const reachableValues = reachableNodes.map((n) => n.value);
  const kind = level.objectiveKind ?? 'bst-insert';

  switch (kind) {
    case 'bst-search': {
      const target =
        evalState.searchTarget ?? level.initialState.searchTarget;
      const foundNode = evalState.foundNodeId
        ? evalState.nodes[evalState.foundNodeId]
        : undefined;
      if (!foundNode || (target !== undefined && foundNode.value !== target)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Target key ${target ?? '?'} has not been locked yet. Follow BST ordering (< left, > right) and probe the target node.`
        );
      }
      return evaluateScore(true, metrics, level.par, level.insight);
    }

    case 'bst-insert': {
      const allowViolations = level.meta?.allowViolations === true;
      if (!allowViolations && evalState.invariantViolations > 0) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `BST invariant fault recorded (${evalState.invariantViolations} violation(s)). Every left child must be smaller and every right child larger within its ancestor bounds.`
        );
      }
      if (evalState.pendingQueue.length > 0) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `${evalState.pendingQueue.length} queued key(s) still pending: [${evalState.pendingQueue.join(', ')}].`
        );
      }
      if (!isValidBST(evalState)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          'Tree violates the global Binary Search Tree ordering invariant.'
        );
      }
      const expected =
        evalState.expectedValues ?? level.initialState.expectedValues;
      if (expected && !sortedNumbersEqual(reachableValues, expected)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Expected tree keys [${[...expected].sort((a, b) => a - b).join(', ')}], got [${[...reachableValues].sort((a, b) => a - b).join(', ')}].`
        );
      }
      return evaluateScore(true, metrics, level.par, level.insight);
    }

    case 'tree-traversal': {
      const targetSeq =
        evalState.targetSequence ?? level.initialState.targetSequence ?? [];
      if (!exactNumbersEqual(evalState.visitedSequence, targetSeq)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Traversal mismatch: expected [${targetSeq.join(', ')}], visited [${evalState.visitedSequence.join(', ')}].`
        );
      }
      return evaluateScore(true, metrics, level.par, level.insight);
    }

    case 'bst-delete': {
      if (!isValidBST(evalState)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          'Tree violates the Binary Search Tree ordering invariant after deletion.'
        );
      }
      const remainingCorrupted = reachableNodes.filter((n) => n.corrupted);
      if (remainingCorrupted.length > 0) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Corrupted node(s) still present in canopy: ${remainingCorrupted.map((n) => `${n.id}(${n.value})`).join(', ')}.`
        );
      }
      const deleteVal =
        typeof level.meta?.deleteValue === 'number'
          ? level.meta.deleteValue
          : undefined;
      if (deleteVal !== undefined && reachableValues.includes(deleteVal)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Target key ${deleteVal} is still present in the tree.`
        );
      }
      const initialNonCorrupted = collectReachableNodes(level.initialState)
        .filter((n) => !n.corrupted && n.value !== deleteVal)
        .map((n) => n.value);
      const expected =
        evalState.expectedValues ??
        level.initialState.expectedValues ??
        initialNonCorrupted;
      if (!sortedNumbersEqual(reachableValues, expected)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Key preservation failed: expected [${[...expected].sort((a, b) => a - b).join(', ')}], got [${[...reachableValues].sort((a, b) => a - b).join(', ')}].`
        );
      }
      return evaluateScore(true, metrics, level.par, level.insight);
    }

    case 'avl-balance': {
      if (!isValidBST(evalState)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          'Tree violates the Binary Search Tree ordering invariant.'
        );
      }
      const initialVals = collectReachableNodes(level.initialState).map(
        (n) => n.value
      );
      const expected =
        evalState.expectedValues ??
        level.initialState.expectedValues ??
        initialVals;
      if (!sortedNumbersEqual(reachableValues, expected)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `All original keys must be preserved during rotations.`
        );
      }
      const overloaded = reachableNodes.filter(
        (n) => Math.abs(n.balanceFactor ?? 0) > 1
      );
      if (overloaded.length > 0) {
        const list = overloaded
          .map((n) => `${n.id}(${n.value}, BF=${n.balanceFactor})`)
          .join(', ');
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `AVL imbalance remains on: ${list}. Rotate until every node has |BF| ≤ 1.`
        );
      }
      return evaluateScore(true, metrics, level.par, level.insight);
    }

    default: {
      if (!isValidBST(evalState)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          'Tree violates the Binary Search Tree invariant.'
        );
      }
      return evaluateScore(true, metrics, level.par, level.insight);
    }
  }
}
