import { createEmptyMetrics, evaluateScore } from '../scorer';
import type {
  ArraySlot,
  ArraysWorldState,
  LevelDefinition,
  ScoreReport,
  SimEvent,
  SimMetrics,
} from '../types';

export function cloneArraysState(state: ArraysWorldState): ArraysWorldState {
  return {
    world: 'arrays',
    slots: state.slots.map((slot) => ({ ...slot })),
    pointers: { ...state.pointers },
    window: state.window ? [state.window[0], state.window[1]] : undefined,
    auxSlots: state.auxSlots ? [...state.auxSlots] : undefined,
    targetValues: state.targetValues ? [...state.targetValues] : undefined,
    searchTarget: state.searchTarget,
    probedIndices: state.probedIndices ? [...state.probedIndices] : undefined,
    foundIndex: state.foundIndex,
  };
}

export interface ArraysSession {
  readonly length: number;
  get(i: number): number;
  probe(index: number): number;
  compare(i: number, j: number): number;
  swap(i: number, j: number): void;
  setPointer(name: string, index: number): void;
  markWindow(left: number, right: number): void;
  markSorted(index: number): void;
  shiftSlice(from: number, to: number): void;
  getState(): ArraysWorldState;
  getEvents(): SimEvent<ArraysWorldState>[];
  getMetrics(): SimMetrics;
}

function normalizePitch(value: number, slots: ArraySlot[]): number {
  if (slots.length === 0) return 0.5;
  let min = Infinity;
  let max = -Infinity;
  for (const s of slots) {
    if (s.value < min) min = s.value;
    if (s.value > max) max = s.value;
  }
  if (max === min) return 0.5;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

export function createArraysSession(initialState: ArraysWorldState): ArraysSession {
  const state = cloneArraysState(initialState);
  const events: SimEvent<ArraysWorldState>[] = [];
  const metrics = createEmptyMetrics();
  if (state.auxSlots && state.auxSlots.length > 0) {
    metrics.auxMemory = state.auxSlots.length;
  }

  let nextEventId = 1;

  const isValidIndex = (i: number): boolean =>
    Number.isInteger(i) && i >= 0 && i < state.slots.length;

  const clearTransientStates = (): void => {
    for (const slot of state.slots) {
      if (
        slot.state === 'comparing' ||
        slot.state === 'swapping' ||
        slot.state === 'active' ||
        slot.state === 'error'
      ) {
        slot.state = slot.value === 0 && isZeroCorruptedLevel() ? 'corrupted' : 'idle';
      }
    }
    if (state.window) {
      const [wl, wr] = state.window;
      for (let idx = wl; idx <= wr; idx++) {
        if (idx >= 0 && idx < state.slots.length && state.slots[idx].state === 'idle') {
          state.slots[idx].state = 'window';
        }
      }
    }
  };

  const hasInitialCorrupted = initialState.slots.some((s) => s.state === 'corrupted');
  const isZeroCorruptedLevel = (): boolean => hasInitialCorrupted;

  const pushEvent = (
    type: SimEvent<ArraysWorldState>['type'],
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
      snapshot: cloneArraysState(state),
    });
  };

  const emitBoundsFault = (context: string, indices: number[]): void => {
    metrics.cycles += 1;
    pushEvent(
      'BOUNDS_FAULT',
      `Bounds fault in ${context}(${indices.join(', ')}) — valid range [0..${state.slots.length - 1}]`,
      -1,
      [],
      { cycles: 1 },
      0
    );
  };

  return {
    get length(): number {
      return state.slots.length;
    },

    get(i: number): number {
      if (!isValidIndex(i)) {
        emitBoundsFault('get', [i]);
        return Number.NaN;
      }
      return state.slots[i].value;
    },

    probe(index: number): number {
      if (!isValidIndex(index)) {
        emitBoundsFault('probe', [index]);
        return 0;
      }

      clearTransientStates();
      const slot = state.slots[index];
      metrics.cycles += 1;

      if (!state.probedIndices) {
        state.probedIndices = [];
      }
      if (!state.probedIndices.includes(index)) {
        state.probedIndices.push(index);
      }

      const target = state.searchTarget;
      if (target === undefined) {
        slot.state = 'comparing';
        pushEvent(
          'PROBE',
          `Probe [${index}](${slot.value})`,
          1,
          [slot.id],
          { cycles: 1 },
          normalizePitch(slot.value, state.slots)
        );
        return 0;
      }

      const cmp = slot.value < target ? -1 : slot.value > target ? 1 : 0;
      if (cmp === 0) {
        state.foundIndex = index;
        slot.state = 'sorted';
      } else {
        slot.state = 'comparing';
      }

      const label =
        cmp === 0
          ? `Found target ${target} at [${index}]!`
          : `[${index}](${slot.value}) ${cmp < 0 ? '<' : '>'} target ${target} — search ${cmp < 0 ? 'right' : 'left'}`;

      pushEvent(
        'PROBE',
        label,
        cmp === 0 ? 3 : 2,
        [slot.id],
        { cycles: 1 },
        cmp === 0 ? 0.95 : normalizePitch(slot.value, state.slots)
      );

      return cmp;
    },

    compare(i: number, j: number): number {
      if (!isValidIndex(i) || !isValidIndex(j)) {
        emitBoundsFault('compare', [i, j]);
        return 0;
      }

      clearTransientStates();
      const slotA = state.slots[i];
      const slotB = state.slots[j];
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
        normalizePitch(Math.max(slotA.value, slotB.value), state.slots)
      );

      slotA.state = prevA;
      slotB.state = prevB;
      return cmp;
    },

    swap(i: number, j: number): void {
      if (!isValidIndex(i) || !isValidIndex(j)) {
        emitBoundsFault('swap', [i, j]);
        return;
      }

      clearTransientStates();
      const slotA = state.slots[i];
      const slotB = state.slots[j];
      const prevA = slotA.state;
      const prevB = slotB.state;

      if (i !== j) {
        state.slots[i] = slotB;
        state.slots[j] = slotA;
      }

      state.slots[i].state = 'swapping';
      state.slots[j].state = 'swapping';

      metrics.cycles += 1;
      pushEvent(
        'SWAP',
        `Swap [${i}](${slotA.value}) ↔ [${j}](${slotB.value})`,
        2,
        [slotA.id, slotB.id],
        { cycles: 1 },
        normalizePitch(Math.max(slotA.value, slotB.value), state.slots)
      );

      slotA.state = prevA === 'sorted' ? 'sorted' : prevA === 'corrupted' ? 'corrupted' : 'idle';
      slotB.state = prevB === 'sorted' ? 'sorted' : prevB === 'corrupted' ? 'corrupted' : 'idle';
    },

    setPointer(name: string, index: number): void {
      if (!isValidIndex(index)) {
        emitBoundsFault('setPointer', [index]);
        return;
      }

      clearTransientStates();
      state.pointers[name] = index;
      const targetSlot = state.slots[index];

      pushEvent(
        'MOVE_POINTER',
        `Move pointer ${name} → [${index}]`,
        0,
        [targetSlot.id],
        {},
        index / Math.max(1, state.slots.length - 1)
      );
    },

    markWindow(left: number, right: number): void {
      if (!isValidIndex(left) || !isValidIndex(right) || left > right) {
        emitBoundsFault('markWindow', [left, right]);
        return;
      }

      clearTransientStates();
      state.window = [left, right];

      let windowSum = 0;
      const targets: string[] = [];
      for (let idx = 0; idx < state.slots.length; idx++) {
        const slot = state.slots[idx];
        if (idx >= left && idx <= right) {
          slot.state = 'window';
          windowSum += slot.value;
          targets.push(slot.id);
        } else if (slot.state === 'window') {
          slot.state = 'idle';
        }
      }

      metrics.cycles += 1;
      pushEvent(
        'MOVE_POINTER',
        `Window [${left}..${right}] sum = ${windowSum}`,
        2,
        targets,
        { cycles: 1 },
        Math.min(1, windowSum / Math.max(1, state.slots.reduce((a, b) => a + b.value, 0)))
      );
    },

    markSorted(index: number): void {
      if (!isValidIndex(index)) {
        emitBoundsFault('markSorted', [index]);
        return;
      }

      clearTransientStates();
      state.slots[index].state = 'sorted';
      pushEvent(
        'WRITE',
        `Lock [${index}](${state.slots[index].value}) as sorted`,
        3,
        [state.slots[index].id],
        {},
        normalizePitch(state.slots[index].value, state.slots)
      );
    },

    shiftSlice(from: number, to: number): void {
      if (!isValidIndex(from) || !isValidIndex(to)) {
        emitBoundsFault('shiftSlice', [from, to]);
        return;
      }

      clearTransientStates();
      const [moved] = state.slots.splice(from, 1);
      state.slots.splice(to, 0, moved);

      const shiftCost = Math.max(1, Math.abs(to - from));
      metrics.cycles += shiftCost;

      const low = Math.min(from, to);
      const high = Math.max(from, to);
      const targets = state.slots.slice(low, high + 1).map((s) => s.id);

      pushEvent(
        'WRITE',
        `Shift slice [${from}] → [${to}] (${shiftCost} ops)`,
        2,
        targets,
        { cycles: shiftCost },
        normalizePitch(moved.value, state.slots)
      );
    },

    getState(): ArraysWorldState {
      return cloneArraysState(state);
    },

    getEvents(): SimEvent<ArraysWorldState>[] {
      return events;
    },

    getMetrics(): SimMetrics {
      return { ...metrics };
    },
  };
}

function arraysEqual(a: number[], b: number[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function evaluateArraysLevel(
  level: LevelDefinition<ArraysWorldState>,
  state: ArraysWorldState,
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

  const values = state.slots.map((s) => s.value);
  const kind = level.objectiveKind ?? 'sort-ascending';

  switch (kind) {
    case 'sort-ascending': {
      let sorted = true;
      for (let i = 0; i < values.length - 1; i++) {
        if (values[i] > values[i + 1]) {
          sorted = false;
          break;
        }
      }
      if (!sorted) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Array is not sorted in ascending order: [${values.join(', ')}].`
        );
      }
      return evaluateScore(true, metrics, level.par, level.insight);
    }

    case 'reverse-in-place': {
      const expected =
        state.targetValues ??
        level.initialState.targetValues ??
        [...level.initialState.slots].reverse().map((s) => s.value);

      if (!arraysEqual(values, expected)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Expected reversed array [${expected.join(', ')}], got [${values.join(', ')}].`
        );
      }
      if (metrics.auxMemory > level.par.maxAuxMemory) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `In-place constraint violated: used ${metrics.auxMemory} aux slots (max ${level.par.maxAuxMemory}).`
        );
      }
      return evaluateScore(true, metrics, level.par, level.insight);
    }

    case 'move-zeros-end': {
      const initialVals = level.initialState.slots.map((s) => s.value);
      const computedExpected = [
        ...initialVals.filter((v) => v !== 0),
        ...initialVals.filter((v) => v === 0),
      ];
      const expected =
        state.targetValues ?? level.initialState.targetValues ?? computedExpected;

      if (!arraysEqual(values, expected)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Expected compacted array [${expected.join(', ')}], got [${values.join(', ')}].`
        );
      }
      if (metrics.auxMemory > level.par.maxAuxMemory) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `In-place constraint violated: used ${metrics.auxMemory} aux slots (max ${level.par.maxAuxMemory}).`
        );
      }
      return evaluateScore(true, metrics, level.par, level.insight);
    }

    case 'max-sliding-window': {
      if (!state.window) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          'No sliding window is marked. Use markWindow(left, right) or slide the window frame.'
        );
      }
      const [left, right] = state.window;
      const windowSize =
        typeof level.meta?.windowSize === 'number'
          ? level.meta.windowSize
          : level.initialState.window
            ? level.initialState.window[1] - level.initialState.window[0] + 1
            : 3;

      if (
        left < 0 ||
        right >= values.length ||
        left > right ||
        right - left + 1 !== windowSize
      ) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Window [${left}..${right}] must have exact width ${windowSize}.`
        );
      }

      let windowSum = 0;
      for (let i = left; i <= right; i++) {
        windowSum += values[i];
      }

      const expectedRange = Array.isArray(level.meta?.expectedRange)
        ? (level.meta.expectedRange as [number, number])
        : undefined;
      const expectedSum =
        typeof level.meta?.expectedSum === 'number'
          ? level.meta.expectedSum
          : undefined;

      const rangeMatches =
        expectedRange !== undefined &&
        left === expectedRange[0] &&
        right === expectedRange[1];
      const sumMatches =
        expectedSum !== undefined && windowSum === expectedSum;

      if (expectedRange || expectedSum !== undefined) {
        if (!rangeMatches && !sumMatches) {
          return evaluateScore(
            false,
            metrics,
            level.par,
            level.insight,
            `Window [${left}..${right}] has sum ${windowSum}${expectedSum !== undefined ? ` (target max sum is ${expectedSum})` : ''}.`
          );
        }
      }
      return evaluateScore(true, metrics, level.par, level.insight);
    }

    case 'binary-search': {
      const target = state.searchTarget ?? level.initialState.searchTarget;
      const foundIdx = state.foundIndex;
      if (
        foundIdx === null ||
        foundIdx === undefined ||
        foundIdx < 0 ||
        foundIdx >= state.slots.length ||
        (target !== undefined && state.slots[foundIdx].value !== target)
      ) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Target ${target ?? '?'} not found yet. Probe the midpoint and halve the search interval!`
        );
      }
      return evaluateScore(true, metrics, level.par, level.insight);
    }

    case 'dutch-flag-partition': {
      const initialVals = level.initialState.slots.map((s) => s.value);
      const computedExpected = [...initialVals].sort((a, b) => a - b);
      const expected =
        state.targetValues ??
        level.initialState.targetValues ??
        computedExpected;

      if (!arraysEqual(values, expected)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Expected 3-way partition [${expected.join(', ')}], got [${values.join(', ')}].`
        );
      }
      if (metrics.auxMemory > level.par.maxAuxMemory) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `In-place constraint violated: used ${metrics.auxMemory} aux slots (max ${level.par.maxAuxMemory}).`
        );
      }
      return evaluateScore(true, metrics, level.par, level.insight);
    }

    default: {
      const target = state.targetValues ?? level.initialState.targetValues;
      if (target && !arraysEqual(values, target)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Expected [${target.join(', ')}], got [${values.join(', ')}].`
        );
      }
      return evaluateScore(true, metrics, level.par, level.insight);
    }
  }
}
