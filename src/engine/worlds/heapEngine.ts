import { createEmptyMetrics, evaluateScore } from '../scorer';
import type {
  HeapKind,
  HeapNodeSlot,
  HeapWorldState,
  LevelDefinition,
  ScoreReport,
  SimEvent,
  SimMetrics,
} from '../types';

export function cloneHeapState(state: HeapWorldState): HeapWorldState {
  return {
    world: 'heap',
    kind: state.kind,
    mode: state.mode,
    items: state.items.map((slot) => ({ ...slot })),
    pendingQueue: [...state.pendingQueue],
    extracted: [...state.extracted],
    secondaryItems: state.secondaryItems
      ? state.secondaryItems.map((slot) => ({ ...slot }))
      : undefined,
    targetExtracted: state.targetExtracted ? [...state.targetExtracted] : undefined,
    targetMedian: state.targetMedian,
    maxHeapSize: state.maxHeapSize,
    selectedIndex: state.selectedIndex,
  };
}

export function isValidHeap(items: HeapNodeSlot[], kind: HeapKind): boolean {
  for (let i = 1; i < items.length; i++) {
    const parentIdx = Math.floor((i - 1) / 2);
    const parentVal = items[parentIdx].value;
    const childVal = items[i].value;
    const valid = kind === 'min' ? parentVal <= childVal : parentVal >= childVal;
    if (!valid) {
      return false;
    }
  }
  return true;
}

export function computeHeapViolations(items: HeapNodeSlot[], kind: HeapKind): number {
  let violations = 0;
  if (items.length > 0 && items[0].state === 'violating') {
    items[0].state = 'idle';
  }
  for (let i = 1; i < items.length; i++) {
    const parentIdx = Math.floor((i - 1) / 2);
    const parentVal = items[parentIdx].value;
    const childVal = items[i].value;
    const violates = kind === 'min' ? parentVal > childVal : parentVal < childVal;
    if (violates) {
      items[i].state = 'violating';
      violations += 1;
    } else if (items[i].state === 'violating') {
      items[i].state = 'idle';
    }
  }
  return violations;
}

export function computeRunningMedian(
  maxHeapItems: HeapNodeSlot[],
  minHeapItems: HeapNodeSlot[]
): number | null {
  const total = maxHeapItems.length + minHeapItems.length;
  if (total === 0) return null;
  if (maxHeapItems.length > minHeapItems.length) {
    return maxHeapItems[0].value;
  }
  if (minHeapItems.length > maxHeapItems.length) {
    return minHeapItems[0].value;
  }
  return (maxHeapItems[0].value + minHeapItems[0].value) / 2;
}

export interface HeapSession {
  size(): number;
  peek(): number | null;
  get(i: number): number;
  parent(i: number): number;
  left(i: number): number;
  right(i: number): number;
  pendingQueue(): number[];
  extracted(): number[];
  select(index: number | null): void;
  compare(i: number, j: number): number;
  swap(i: number, j: number): void;
  pushRaw(value?: number): number;
  siftUp(index: number): number;
  siftDown(index: number): number;
  insert(value?: number): number;
  extractRoot(): number | null;
  heapify(): void;
  insertDual(value?: number): number | null;
  getState(): HeapWorldState;
  getEvents(): SimEvent<HeapWorldState>[];
  getMetrics(): SimMetrics;
}

function normalizePitch(value: number, items: HeapNodeSlot[]): number {
  if (items.length === 0) return 0.5;
  let min = value;
  let max = value;
  for (const s of items) {
    if (s.value < min) min = s.value;
    if (s.value > max) max = s.value;
  }
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

function violatesParent(childValue: number, parentValue: number, kind: HeapKind): boolean {
  return kind === 'min' ? childValue < parentValue : childValue > parentValue;
}

function isBetterChild(candidateValue: number, bestValue: number, kind: HeapKind): boolean {
  return kind === 'min' ? candidateValue < bestValue : candidateValue > bestValue;
}

export function createHeapSession(initialState: HeapWorldState): HeapSession {
  const state = cloneHeapState(initialState);
  const events: SimEvent<HeapWorldState>[] = [];
  const metrics = createEmptyMetrics();

  let nextEventId = 1;
  let nextNodeId =
    state.items.length + (state.secondaryItems?.length ?? 0) + 1;

  const refreshAllViolations = (): void => {
    if (state.mode === 'median') {
      computeHeapViolations(state.items, 'max');
      if (state.secondaryItems) {
        computeHeapViolations(state.secondaryItems, 'min');
      }
    } else {
      computeHeapViolations(state.items, state.kind);
    }
  };

  refreshAllViolations();

  const isValidIndex = (i: number): boolean =>
    Number.isInteger(i) && i >= 0 && i < state.items.length;

  const clearTransientStates = (list: HeapNodeSlot[] = state.items): void => {
    for (const slot of list) {
      if (
        slot.state === 'comparing' ||
        slot.state === 'swapping' ||
        slot.state === 'active' ||
        slot.state === 'sifted' ||
        slot.state === 'extracted'
      ) {
        slot.state = 'idle';
      }
    }
  };

  const pushEvent = (
    type: SimEvent<HeapWorldState>['type'],
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
      snapshot: cloneHeapState(state),
    });
  };

  const emitBoundsFault = (context: string, indices: number[]): void => {
    metrics.cycles += 1;
    pushEvent(
      'BOUNDS_FAULT',
      `Bounds fault in ${context}(${indices.join(', ')}) — valid range [0..${state.items.length - 1}]`,
      -1,
      [],
      { cycles: 1 },
      0
    );
  };

  const siftUpInArray = (
    arr: HeapNodeSlot[],
    kind: HeapKind,
    startIndex: number,
    spireLabel?: string
  ): number => {
    let cur = startIndex;
    while (cur > 0) {
      const p = Math.floor((cur - 1) / 2);
      if (!violatesParent(arr[cur].value, arr[p].value, kind)) {
        break;
      }

      clearTransientStates(arr);
      const moved = arr[cur];
      const demoted = arr[p];
      arr[p] = moved;
      arr[cur] = demoted;

      refreshAllViolations();
      if (moved.state !== 'violating') moved.state = 'sifted';
      if (demoted.state !== 'violating') demoted.state = 'swapping';

      metrics.cycles += 1;
      const prefix = spireLabel ? `[${spireLabel}] ` : '';
      pushEvent(
        'SIFT_UP',
        `${prefix}Sift up (${moved.value}): [${cur}] → [${p}]`,
        2,
        [moved.id, demoted.id],
        { cycles: 1 },
        normalizePitch(moved.value, arr)
      );

      clearTransientStates(arr);
      refreshAllViolations();
      cur = p;
    }

    refreshAllViolations();
    return cur;
  };

  const siftDownInArray = (
    arr: HeapNodeSlot[],
    kind: HeapKind,
    startIndex: number,
    spireLabel?: string
  ): number => {
    let cur = startIndex;
    const n = arr.length;
    while (true) {
      const l = 2 * cur + 1;
      const r = 2 * cur + 2;
      let best = cur;

      if (l < n && isBetterChild(arr[l].value, arr[best].value, kind)) {
        best = l;
      }
      if (r < n && isBetterChild(arr[r].value, arr[best].value, kind)) {
        best = r;
      }
      if (best === cur) {
        break;
      }

      clearTransientStates(arr);
      const moved = arr[cur];
      const promoted = arr[best];
      arr[best] = moved;
      arr[cur] = promoted;

      refreshAllViolations();
      if (moved.state !== 'violating') moved.state = 'sifted';
      if (promoted.state !== 'violating') promoted.state = 'swapping';

      metrics.cycles += 1;
      const prefix = spireLabel ? `[${spireLabel}] ` : '';
      pushEvent(
        'SIFT_DOWN',
        `${prefix}Sift down (${moved.value}): [${cur}] → [${best}]`,
        3,
        [moved.id, promoted.id],
        { cycles: 1 },
        normalizePitch(moved.value, arr)
      );

      clearTransientStates(arr);
      refreshAllViolations();
      cur = best;
    }

    refreshAllViolations();
    return cur;
  };

  const session: HeapSession = {
    size(): number {
      return state.items.length;
    },

    peek(): number | null {
      return state.items.length > 0 ? state.items[0].value : null;
    },

    get(i: number): number {
      if (!isValidIndex(i)) {
        emitBoundsFault('get', [i]);
        return Number.NaN;
      }
      return state.items[i].value;
    },

    parent(i: number): number {
      return i <= 0 ? -1 : Math.floor((i - 1) / 2);
    },

    left(i: number): number {
      return 2 * i + 1;
    },

    right(i: number): number {
      return 2 * i + 2;
    },

    pendingQueue(): number[] {
      return [...state.pendingQueue];
    },

    extracted(): number[] {
      return [...state.extracted];
    },

    select(index: number | null): void {
      if (index === null) {
        state.selectedIndex = null;
        return;
      }
      if (!isValidIndex(index)) {
        state.selectedIndex = null;
        return;
      }
      state.selectedIndex = index;
    },

    compare(i: number, j: number): number {
      if (!isValidIndex(i) || !isValidIndex(j)) {
        emitBoundsFault('compare', [i, j]);
        return 0;
      }

      clearTransientStates();
      const slotA = state.items[i];
      const slotB = state.items[j];
      const prevA = slotA.state;
      const prevB = slotB.state;

      slotA.state = 'comparing';
      slotB.state = 'comparing';

      metrics.cycles += 1;
      const cmp = slotA.value < slotB.value ? -1 : slotA.value > slotB.value ? 1 : 0;
      const symbol = cmp < 0 ? '<' : cmp > 0 ? '>' : '==';

      pushEvent(
        'COMPARE',
        `Compare [${i}](${slotA.value}) ${symbol} [${j}](${slotB.value})`,
        1,
        [slotA.id, slotB.id],
        { cycles: 1 },
        normalizePitch(Math.max(slotA.value, slotB.value), state.items)
      );

      slotA.state = prevA;
      slotB.state = prevB;
      refreshAllViolations();
      return cmp;
    },

    swap(i: number, j: number): void {
      if (!isValidIndex(i) || !isValidIndex(j)) {
        emitBoundsFault('swap', [i, j]);
        return;
      }

      clearTransientStates();
      const slotA = state.items[i];
      const slotB = state.items[j];

      if (i !== j) {
        state.items[i] = slotB;
        state.items[j] = slotA;
      }

      refreshAllViolations();
      if (state.items[i].state !== 'violating') state.items[i].state = 'swapping';
      if (state.items[j].state !== 'violating') state.items[j].state = 'swapping';

      metrics.cycles += 1;
      pushEvent(
        'SWAP',
        `Swap [${i}](${slotA.value}) ↔ [${j}](${slotB.value})`,
        2,
        [slotA.id, slotB.id],
        { cycles: 1 },
        normalizePitch(Math.max(slotA.value, slotB.value), state.items)
      );

      clearTransientStates();
      refreshAllViolations();
    },

    pushRaw(value?: number): number {
      const val = value !== undefined ? value : state.pendingQueue.shift();
      if (val === undefined) {
        metrics.cycles += 1;
        pushEvent(
          'UNDERFLOW',
          'Pending queue is empty — no value to push',
          -1,
          [],
          { cycles: 1 },
          0
        );
        return -1;
      }

      clearTransientStates();
      const slot: HeapNodeSlot = {
        id: `h-${nextNodeId++}`,
        value: val,
        state: 'active',
      };
      state.items.push(slot);
      const newIdx = state.items.length - 1;

      refreshAllViolations();
      metrics.cycles += 1;

      pushEvent(
        'INSERT_NODE',
        `Push (${val}) at [${newIdx}]`,
        1,
        [slot.id],
        { cycles: 1 },
        normalizePitch(val, state.items)
      );

      if (slot.state === 'active') {
        slot.state = 'idle';
      }
      refreshAllViolations();
      return newIdx;
    },

    siftUp(index: number): number {
      if (!isValidIndex(index)) {
        emitBoundsFault('siftUp', [index]);
        return -1;
      }
      return siftUpInArray(state.items, state.kind, index);
    },

    siftDown(index: number): number {
      if (!isValidIndex(index)) {
        emitBoundsFault('siftDown', [index]);
        return -1;
      }
      return siftDownInArray(state.items, state.kind, index);
    },

    insert(value?: number): number {
      const idx = session.pushRaw(value);
      if (idx < 0) return -1;
      return session.siftUp(idx);
    },

    extractRoot(): number | null {
      if (state.items.length === 0) {
        metrics.cycles += 1;
        pushEvent(
          'UNDERFLOW',
          'Cannot extract root — heap is empty',
          -1,
          [],
          { cycles: 1 },
          0
        );
        return null;
      }

      clearTransientStates();
      const rootSlot = state.items[0];
      const extractedValue = rootSlot.value;

      if (state.items.length === 1) {
        state.items.pop();
      } else {
        const lastSlot = state.items.pop()!;
        lastSlot.state = 'active';
        state.items[0] = lastSlot;
      }

      state.extracted.push(extractedValue);
      if (state.selectedIndex !== null && state.selectedIndex >= state.items.length) {
        state.selectedIndex = null;
      }

      refreshAllViolations();
      metrics.cycles += 1;

      pushEvent(
        'EXTRACT_ROOT',
        `Extract root (${extractedValue})`,
        1,
        [rootSlot.id],
        { cycles: 1 },
        normalizePitch(
          extractedValue,
          state.items.length > 0 ? state.items : [rootSlot]
        )
      );

      if (state.items.length > 1) {
        siftDownInArray(state.items, state.kind, 0);
      } else {
        clearTransientStates();
        refreshAllViolations();
      }

      return extractedValue;
    },

    heapify(): void {
      const startIdx = Math.floor(state.items.length / 2) - 1;
      for (let i = startIdx; i >= 0; i--) {
        siftDownInArray(state.items, state.kind, i);
      }
      clearTransientStates();
      refreshAllViolations();

      pushEvent(
        'HEAPIFY',
        `Heapify complete (${state.items.length} nodes, ${state.kind}-heap)`,
        4,
        state.items.map((s) => s.id),
        {},
        0.85
      );
    },

    insertDual(value?: number): number | null {
      if (!state.secondaryItems) {
        state.secondaryItems = [];
      }
      const lower = state.items; // Max-Heap (lower half)
      const upper = state.secondaryItems; // Min-Heap (upper half)

      const val = value !== undefined ? value : state.pendingQueue.shift();
      if (val === undefined) {
        metrics.cycles += 1;
        pushEvent(
          'UNDERFLOW',
          'Pending queue is empty — no value to insert into Twin Spires',
          -1,
          [],
          { cycles: 1 },
          0
        );
        return computeRunningMedian(lower, upper);
      }

      clearTransientStates(lower);
      clearTransientStates(upper);

      const newSlot: HeapNodeSlot = {
        id: `h-${nextNodeId++}`,
        value: val,
        state: 'active',
      };

      const allCombined = [...lower, ...upper, newSlot];

      if (lower.length === 0 || val <= lower[0].value) {
        lower.push(newSlot);
        metrics.cycles += 1;
        pushEvent(
          'INSERT_NODE',
          `[Max-Heap] Insert (${val})`,
          1,
          [newSlot.id],
          { cycles: 1 },
          normalizePitch(val, allCombined)
        );
        siftUpInArray(lower, 'max', lower.length - 1, 'Max-Heap');
      } else {
        upper.push(newSlot);
        metrics.cycles += 1;
        pushEvent(
          'INSERT_NODE',
          `[Min-Heap] Insert (${val})`,
          1,
          [newSlot.id],
          { cycles: 1 },
          normalizePitch(val, allCombined)
        );
        siftUpInArray(upper, 'min', upper.length - 1, 'Min-Heap');
      }

      // Rebalance so 0 <= lower.length - upper.length <= 1
      if (lower.length > upper.length + 1) {
        const movedRoot = lower[0];
        if (lower.length === 1) {
          lower.pop();
        } else {
          lower[0] = lower.pop()!;
          siftDownInArray(lower, 'max', 0, 'Max-Heap');
        }
        movedRoot.state = 'active';
        upper.push(movedRoot);
        metrics.cycles += 1;
        pushEvent(
          'SIFT_UP',
          `Rebalance Max→Min: move (${movedRoot.value})`,
          3,
          [movedRoot.id],
          { cycles: 1 },
          normalizePitch(movedRoot.value, allCombined)
        );
        siftUpInArray(upper, 'min', upper.length - 1, 'Min-Heap');
      } else if (upper.length > lower.length) {
        const movedRoot = upper[0];
        if (upper.length === 1) {
          upper.pop();
        } else {
          upper[0] = upper.pop()!;
          siftDownInArray(upper, 'min', 0, 'Min-Heap');
        }
        movedRoot.state = 'active';
        lower.push(movedRoot);
        metrics.cycles += 1;
        pushEvent(
          'SIFT_UP',
          `Rebalance Min→Max: move (${movedRoot.value})`,
          3,
          [movedRoot.id],
          { cycles: 1 },
          normalizePitch(movedRoot.value, allCombined)
        );
        siftUpInArray(lower, 'max', lower.length - 1, 'Max-Heap');
      }

      clearTransientStates(lower);
      clearTransientStates(upper);
      computeHeapViolations(lower, 'max');
      computeHeapViolations(upper, 'min');

      const median = computeRunningMedian(lower, upper);
      const rootTargets: string[] = [];
      if (lower.length > 0) rootTargets.push(lower[0].id);
      if (upper.length > 0) rootTargets.push(upper[0].id);

      pushEvent(
        'HEAPIFY',
        `Twin Spires balanced — median = ${median !== null ? median : 'N/A'}`,
        4,
        rootTargets,
        {},
        median !== null ? normalizePitch(median, [...lower, ...upper]) : 0.5
      );

      return median;
    },

    getState(): HeapWorldState {
      return cloneHeapState(state);
    },

    getEvents(): SimEvent<HeapWorldState>[] {
      return events;
    },

    getMetrics(): SimMetrics {
      return { ...metrics };
    },
  };

  return session;
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function sortedCopy(nums: number[]): number[] {
  return [...nums].sort((a, b) => a - b);
}

export function evaluateHeapLevel(
  level: LevelDefinition<HeapWorldState>,
  state: HeapWorldState,
  metrics: SimMetrics
): ScoreReport {
  if (level.maxCyclesBudget !== undefined && metrics.cycles > level.maxCyclesBudget) {
    return evaluateScore(
      false,
      metrics,
      level.par,
      level.insight,
      `Thermal cycle budget exceeded (${metrics.cycles} / ${level.maxCyclesBudget} cycles).`
    );
  }

  const objective = level.objectiveKind ?? 'heap-valid';

  switch (objective) {
    case 'heap-valid': {
      if (state.pendingQueue.length > 0) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Pending queue still has ${state.pendingQueue.length} uninserted value(s).`
        );
      }

      if (!isValidHeap(state.items, state.kind)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Heap property violated for ${state.kind}-heap.`
        );
      }

      const expectedValues = Array.isArray(level.meta?.expectedValues)
        ? (level.meta.expectedValues as number[])
        : [
            ...level.initialState.items.map((s) => s.value),
            ...level.initialState.pendingQueue,
          ];

      const actualSorted = sortedCopy(state.items.map((s) => s.value));
      const expectedSorted = sortedCopy(expectedValues);

      if (!arraysEqual(actualSorted, expectedSorted)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Heap values [${actualSorted.join(', ')}] do not match expected values [${expectedSorted.join(', ')}].`
        );
      }

      return evaluateScore(true, metrics, level.par, level.insight);
    }

    case 'heap-extract': {
      const target = state.targetExtracted ?? level.initialState.targetExtracted;
      if (target && !arraysEqual(state.extracted, target)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Expected extracted sequence [${target.join(', ')}], got [${state.extracted.join(', ')}].`
        );
      }

      if (!isValidHeap(state.items, state.kind)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Remaining ${state.kind}-heap violates the heap property after extraction.`
        );
      }

      return evaluateScore(true, metrics, level.par, level.insight);
    }

    case 'heap-top-k': {
      if (state.pendingQueue.length > 0) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Pending stream still has ${state.pendingQueue.length} unprocessed value(s).`
        );
      }

      if (!isValidHeap(state.items, state.kind)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Heap property violated for ${state.kind}-heap.`
        );
      }

      const target = state.targetExtracted ?? level.initialState.targetExtracted;
      const expectedSize =
        state.maxHeapSize ?? level.initialState.maxHeapSize ?? target?.length;

      if (expectedSize !== undefined && state.items.length !== expectedSize) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Expected heap of size K = ${expectedSize}, got ${state.items.length}.`
        );
      }

      if (target) {
        const actualSorted = sortedCopy(state.items.map((s) => s.value));
        const targetSorted = sortedCopy(target);
        if (!arraysEqual(actualSorted, targetSorted)) {
          return evaluateScore(
            false,
            metrics,
            level.par,
            level.insight,
            `Top-K heap contains [${actualSorted.join(', ')}], expected [${targetSorted.join(', ')}].`
          );
        }
      }

      return evaluateScore(true, metrics, level.par, level.insight);
    }

    case 'heap-sort': {
      const target = state.targetExtracted ?? level.initialState.targetExtracted;
      if (target) {
        if (!arraysEqual(state.extracted, target)) {
          return evaluateScore(
            false,
            metrics,
            level.par,
            level.insight,
            `Expected sorted sequence [${target.join(', ')}], got [${state.extracted.join(', ')}].`
          );
        }
        return evaluateScore(true, metrics, level.par, level.insight);
      }

      if (state.items.length > 0 || state.pendingQueue.length > 0) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Heap still has ${state.items.length} node(s) remaining; extract all nodes to complete Heapsort.`
        );
      }

      for (let i = 0; i < state.extracted.length - 1; i++) {
        const ordered =
          state.kind === 'min'
            ? state.extracted[i] <= state.extracted[i + 1]
            : state.extracted[i] >= state.extracted[i + 1];
        if (!ordered) {
          return evaluateScore(
            false,
            metrics,
            level.par,
            level.insight,
            `Extracted sequence [${state.extracted.join(', ')}] is not properly sorted.`
          );
        }
      }

      return evaluateScore(true, metrics, level.par, level.insight);
    }

    case 'heap-median': {
      if (state.pendingQueue.length > 0) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Pending stream still has ${state.pendingQueue.length} unprocessed value(s).`
        );
      }

      const lower = state.items;
      const upper = state.secondaryItems ?? [];

      if (!isValidHeap(lower, 'max')) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          'Lower-half spire violates Max-Heap invariant.'
        );
      }

      if (!isValidHeap(upper, 'min')) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          'Upper-half spire violates Min-Heap invariant.'
        );
      }

      if (Math.abs(lower.length - upper.length) > 1) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Twin Spires are unbalanced (max-heap: ${lower.length}, min-heap: ${upper.length}).`
        );
      }

      if (lower.length > 0 && upper.length > 0 && lower[0].value > upper[0].value) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Lower-half max (${lower[0].value}) exceeds upper-half min (${upper[0].value}).`
        );
      }

      const median = computeRunningMedian(lower, upper);
      const targetMedian = state.targetMedian ?? level.initialState.targetMedian;

      if (targetMedian !== undefined) {
        if (median === null || Math.abs(median - targetMedian) > 1e-9) {
          return evaluateScore(
            false,
            metrics,
            level.par,
            level.insight,
            `Expected running median ${targetMedian}, got ${median ?? 'null'}.`
          );
        }
      }

      return evaluateScore(true, metrics, level.par, level.insight);
    }

    default: {
      if (state.pendingQueue.length > 0) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Pending queue still has ${state.pendingQueue.length} uninserted value(s).`
        );
      }
      if (!isValidHeap(state.items, state.kind)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Heap property violated for ${state.kind}-heap.`
        );
      }
      return evaluateScore(true, metrics, level.par, level.insight);
    }
  }
}
