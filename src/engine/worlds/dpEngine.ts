import { createEmptyMetrics, evaluateScore } from '../scorer';
import type {
  DPCell,
  DPWorldState,
  LevelDefinition,
  ScoreReport,
  SimEvent,
  SimMetrics,
} from '../types';

export function cloneDPState(state: DPWorldState): DPWorldState {
  return {
    world: 'dp',
    mode: state.mode,
    rows: state.rows,
    cols: state.cols,
    rowLabels: [...state.rowLabels],
    colLabels: [...state.colLabels],
    cells: state.cells.map((cell) => ({
      ...cell,
      dependencies: cell.dependencies
        ? cell.dependencies.map(([r, c]) => [r, c] as [number, number])
        : undefined,
    })),
    activeCell: state.activeCell
      ? [state.activeCell[0], state.activeCell[1]]
      : null,
    activeDeps: state.activeDeps.map(([r, c]) => [r, c] as [number, number]),
    targetAnswer: state.targetAnswer,
    expectedTable: state.expectedTable
      ? state.expectedTable.map((row) => [...row])
      : undefined,
    optimalPath: state.optimalPath
      ? state.optimalPath.map(([r, c]) => [r, c] as [number, number])
      : undefined,
    naiveRecursionOps: state.naiveRecursionOps,
    items: state.items ? state.items.map((item) => ({ ...item })) : undefined,
    coins: state.coins ? [...state.coins] : undefined,
    strA: state.strA,
    strB: state.strB,
    tracebackShown: state.tracebackShown,
  };
}

function getCell(
  state: DPWorldState,
  row: number,
  col: number
): DPCell | undefined {
  if (row < 0 || col < 0 || row >= state.rows || col >= state.cols) {
    return undefined;
  }
  const idx = row * state.cols + col;
  const direct = state.cells[idx];
  if (direct && direct.row === row && direct.col === col) {
    return direct;
  }
  return state.cells.find((c) => c.row === row && c.col === col);
}

function isSatisfied(cell: DPCell | undefined): boolean {
  return Boolean(
    cell &&
      cell.value !== null &&
      (cell.state === 'computed' || cell.state === 'path')
  );
}

function dedupeCoords(coords: [number, number][]): [number, number][] {
  const seen = new Set<string>();
  const out: [number, number][] = [];
  for (const [r, c] of coords) {
    const key = `${r},${c}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push([r, c]);
    }
  }
  return out;
}

function inferDependencies(
  state: DPWorldState,
  row: number,
  col: number
): [number, number][] {
  const cell = getCell(state, row, col);
  if (!cell || cell.state === 'blocked') return [];

  if (cell.dependencies && cell.dependencies.length > 0) {
    return dedupeCoords(
      cell.dependencies.filter(([dr, dc]) => {
        const dep = getCell(state, dr, dc);
        return dep !== undefined && dep.state !== 'blocked';
      })
    );
  }

  const deps: [number, number][] = [];
  const pushIfWalkable = (dr: number, dc: number): void => {
    const dep = getCell(state, dr, dc);
    if (dep && dep.state !== 'blocked') {
      deps.push([dr, dc]);
    }
  };

  switch (state.mode) {
    case 'fib':
    case 'robber': {
      if (col >= 2) {
        pushIfWalkable(row, col - 1);
        pushIfWalkable(row, col - 2);
      } else if (col === 1) {
        pushIfWalkable(row, 0);
      }
      break;
    }

    case 'coin-change': {
      const coins = state.coins ?? [];
      if (col > 0) {
        for (const coin of coins) {
          if (coin > 0 && col - coin >= 0) {
            pushIfWalkable(row, col - coin);
          }
        }
      }
      break;
    }

    case 'grid-paths': {
      if (row > 0) pushIfWalkable(row - 1, col);
      if (col > 0) pushIfWalkable(row, col - 1);
      break;
    }

    case 'knapsack': {
      if (row > 0 && col > 0) {
        pushIfWalkable(row - 1, col);
        const item = state.items?.[row - 1];
        if (item && col >= item.weight) {
          pushIfWalkable(row - 1, col - item.weight);
        }
      }
      break;
    }

    case 'lcs': {
      if (row > 0 && col > 0) {
        const charA = state.strA?.[row - 1];
        const charB = state.strB?.[col - 1];
        if (charA !== undefined && charB !== undefined && charA === charB) {
          pushIfWalkable(row - 1, col - 1);
        } else {
          pushIfWalkable(row - 1, col);
          pushIfWalkable(row, col - 1);
        }
      }
      break;
    }

    case 'sandbox':
    default: {
      if (state.rows === 1) {
        if (col >= 2) {
          pushIfWalkable(0, col - 1);
          pushIfWalkable(0, col - 2);
        } else if (col === 1) {
          pushIfWalkable(0, 0);
        }
      } else {
        if (row > 0) pushIfWalkable(row - 1, col);
        if (col > 0) pushIfWalkable(row, col - 1);
      }
      break;
    }
  }

  return dedupeCoords(deps);
}

/**
 * Marks every `'empty'` cell whose required subproblem dependencies are already
 * `'computed'` or `'path'` as `'ready'` so the 3D Memo Matrix can glow clickable cells.
 */
export function computeReadyCells(state: DPWorldState): void {
  for (const cell of state.cells) {
    if (cell.state !== 'empty' && cell.state !== 'ready') {
      continue;
    }
    const deps = inferDependencies(state, cell.row, cell.col);
    const allReady = deps.every(([dr, dc]) =>
      isSatisfied(getCell(state, dr, dc))
    );
    cell.state = allReady ? 'ready' : 'empty';
  }
}

function countComputedCells(state: DPWorldState): number {
  let count = 0;
  for (const cell of state.cells) {
    if (
      cell.value !== null &&
      (cell.state === 'computed' || cell.state === 'path')
    ) {
      count += 1;
    }
  }
  return count;
}

function countComputableCells(state: DPWorldState): number {
  let count = 0;
  for (const cell of state.cells) {
    if (cell.state !== 'blocked') count += 1;
  }
  return Math.max(1, count);
}

function computeRecurrenceValue(
  state: DPWorldState,
  row: number,
  col: number
): number | null {
  const expected = state.expectedTable?.[row]?.[col];
  if (expected !== undefined && expected !== null) {
    return expected;
  }

  const valAt = (r: number, c: number): number | null => {
    const cell = getCell(state, r, c);
    if (!cell || cell.state === 'blocked') return null;
    return cell.value;
  };

  switch (state.mode) {
    case 'fib': {
      if (col === 0) return 0;
      if (col === 1) return 1;
      return (valAt(row, col - 1) ?? 0) + (valAt(row, col - 2) ?? 0);
    }

    case 'robber': {
      const houseVal =
        state.items?.[col]?.value ??
        Number(state.colLabels[col]?.replace(/[^0-9.-]/g, '') || 0);
      if (col === 0) return houseVal;
      const skip = valAt(row, col - 1) ?? 0;
      const take = (col >= 2 ? (valAt(row, col - 2) ?? 0) : 0) + houseVal;
      return Math.max(skip, take);
    }

    case 'coin-change': {
      if (col === 0) return 0;
      const coins = state.coins ?? [];
      let best = Infinity;
      for (const coin of coins) {
        if (coin > 0 && col - coin >= 0) {
          const prev = valAt(row, col - coin);
          if (prev !== null && Number.isFinite(prev) && prev + 1 < best) {
            best = prev + 1;
          }
        }
      }
      return Number.isFinite(best) ? best : -1;
    }

    case 'grid-paths': {
      if (row === 0 && col === 0) return 1;
      const top = row > 0 ? (valAt(row - 1, col) ?? 0) : 0;
      const left = col > 0 ? (valAt(row, col - 1) ?? 0) : 0;
      return top + left;
    }

    case 'knapsack': {
      if (row === 0 || col === 0) return 0;
      const item = state.items?.[row - 1];
      const skip = valAt(row - 1, col) ?? 0;
      if (!item || col < item.weight) return skip;
      const take = (valAt(row - 1, col - item.weight) ?? 0) + item.value;
      return Math.max(skip, take);
    }

    case 'lcs': {
      if (row === 0 || col === 0) return 0;
      const charA = state.strA?.[row - 1];
      const charB = state.strB?.[col - 1];
      if (charA !== undefined && charB !== undefined && charA === charB) {
        return (valAt(row - 1, col - 1) ?? 0) + 1;
      }
      return Math.max(valAt(row - 1, col) ?? 0, valAt(row, col - 1) ?? 0);
    }

    case 'sandbox':
    default: {
      if (state.rows === 1) {
        if (col === 0) return 0;
        if (col === 1) return 1;
        return (valAt(0, col - 1) ?? 0) + (valAt(0, col - 2) ?? 0);
      }
      if (row === 0 && col === 0) return 1;
      return (valAt(row - 1, col) ?? 0) + (valAt(row, col - 1) ?? 0);
    }
  }
}

function backtrackOptimalPath(state: DPWorldState): [number, number][] {
  if (state.optimalPath && state.optimalPath.length > 0) {
    return state.optimalPath.map(([r, c]) => [r, c] as [number, number]);
  }

  const path: [number, number][] = [];
  let r = state.rows - 1;
  let c = state.cols - 1;
  const maxSteps = state.rows * state.cols + 2;

  for (let step = 0; step < maxSteps; step++) {
    const cell = getCell(state, r, c);
    if (!cell || cell.state === 'blocked') break;
    path.push([r, c]);

    if (r === 0 && c === 0) break;

    if (state.rows === 1) {
      if (state.mode === 'coin-change' && state.coins) {
        let nextC = -1;
        for (const coin of state.coins) {
          if (coin > 0 && c - coin >= 0) {
            const prev = getCell(state, 0, c - coin);
            if (prev?.value !== null && prev?.value !== undefined && cell.value !== null && prev.value + 1 === cell.value) {
              nextC = c - coin;
              break;
            }
          }
        }
        if (nextC < 0) break;
        c = nextC;
      } else if (state.mode === 'robber') {
        const prev1 = getCell(state, 0, c - 1)?.value ?? -1;
        if (c >= 1 && cell.value === prev1) {
          c = c - 1;
        } else if (c >= 2) {
          c = c - 2;
        } else {
          break;
        }
      } else {
        c -= 1;
      }
      continue;
    }

    if (state.mode === 'knapsack') {
      const item = state.items?.[r - 1];
      const above = getCell(state, r - 1, c)?.value ?? -1;
      if (
        item &&
        c >= item.weight &&
        cell.value !== null &&
        cell.value !== above
      ) {
        r -= 1;
        c -= item.weight;
      } else if (r > 0) {
        r -= 1;
      } else {
        break;
      }
    } else if (state.mode === 'lcs') {
      const charA = state.strA?.[r - 1];
      const charB = state.strB?.[c - 1];
      if (r > 0 && c > 0 && charA !== undefined && charA === charB) {
        r -= 1;
        c -= 1;
      } else {
        const up = r > 0 ? (getCell(state, r - 1, c)?.value ?? -1) : -1;
        const left = c > 0 ? (getCell(state, r, c - 1)?.value ?? -1) : -1;
        if (up >= left && r > 0) {
          r -= 1;
        } else if (c > 0) {
          c -= 1;
        } else {
          break;
        }
      }
    } else {
      const up = r > 0 ? (getCell(state, r - 1, c)?.value ?? -1) : -1;
      const left = c > 0 ? (getCell(state, r, c - 1)?.value ?? -1) : -1;
      if (up >= left && r > 0) {
        r -= 1;
      } else if (c > 0) {
        c -= 1;
      } else {
        break;
      }
    }
  }

  path.reverse();
  return path;
}

export interface DPSession {
  readonly rows: number;
  readonly cols: number;
  get(row: number, col: number): number | null;
  set(
    row: number,
    col: number,
    value: number,
    deps?: [number, number][]
  ): void;
  computeCell(row: number, col: number): number | null;
  traceOptimal(): [number, number][];
  runTabulation(): number | null;
  getState(): DPWorldState;
  getEvents(): SimEvent<DPWorldState>[];
  getMetrics(): SimMetrics;
}

export function createDPSession(initialState: DPWorldState): DPSession {
  const state = cloneDPState(initialState);
  computeReadyCells(state);

  const events: SimEvent<DPWorldState>[] = [];
  const metrics = createEmptyMetrics();
  metrics.auxMemory = countComputedCells(state);
  let nextEventId = 1;

  const totalComputable = countComputableCells(state);

  const pushEvent = (
    type: SimEvent<DPWorldState>['type'],
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
      snapshot: cloneDPState(state),
    });
  };

  const setImpl = (
    row: number,
    col: number,
    value: number,
    deps?: [number, number][]
  ): void => {
    const cell = getCell(state, row, col);
    if (!cell || cell.state === 'blocked') {
      metrics.cycles += 1;
      pushEvent(
        'BOUNDS_FAULT',
        `Cannot write to (${row}, ${col}) — cell is out of bounds or blocked`,
        -1,
        [],
        { cycles: 1 },
        0
      );
      return;
    }

    const resolvedDeps =
      deps ??
      (cell.dependencies && cell.dependencies.length > 0
        ? cell.dependencies
        : inferDependencies(state, row, col));

    cell.value = value;
    cell.state = 'computed';
    state.activeCell = [row, col];
    state.activeDeps = resolvedDeps.map(
      ([dr, dc]) => [dr, dc] as [number, number]
    );

    computeReadyCells(state);

    const computedCount = countComputedCells(state);
    metrics.cycles += 1;
    metrics.auxMemory = Math.max(metrics.auxMemory, computedCount);

    const depText =
      state.activeDeps.length > 0
        ? ` ← [${state.activeDeps.map(([dr, dc]) => `(${dr},${dc})`).join(', ')}]`
        : ' (base case)';

    pushEvent(
      'DP_COMPUTE',
      `dp[${row}][${col}] = ${value}${depText}`,
      2,
      [`${row},${col}`],
      { cycles: 1, auxMemory: metrics.auxMemory },
      Math.max(0.1, Math.min(1, computedCount / totalComputable))
    );
  };

  const computeCellImpl = (row: number, col: number): number | null => {
    const cell = getCell(state, row, col);
    if (!cell || cell.state === 'blocked') {
      metrics.cycles += 1;
      pushEvent(
        'BOUNDS_FAULT',
        `Cell (${row}, ${col}) is out of bounds or blocked`,
        -1,
        [],
        { cycles: 1 },
        0
      );
      return null;
    }

    const deps = inferDependencies(state, row, col);
    const missing = deps.filter(
      ([dr, dc]) => !isSatisfied(getCell(state, dr, dc))
    );
    if (missing.length > 0) {
      metrics.cycles += 1;
      pushEvent(
        'FAIL',
        `Subproblem (${row}, ${col}) not ready — compute ${missing.map(([dr, dc]) => `(${dr},${dc})`).join(', ')} first`,
        -1,
        [`${row},${col}`],
        { cycles: 1 },
        0.1
      );
      return null;
    }

    const computedValue = computeRecurrenceValue(state, row, col);
    if (computedValue === null) {
      return null;
    }

    setImpl(row, col, computedValue, deps);
    return computedValue;
  };

  const traceOptimalImpl = (): [number, number][] => {
    const path = backtrackOptimalPath(state);
    const targets: string[] = [];

    for (const [r, c] of path) {
      const cell = getCell(state, r, c);
      if (cell && cell.state !== 'blocked') {
        cell.state = 'path';
        targets.push(`${r},${c}`);
      }
    }

    state.tracebackShown = true;
    state.activeCell = path.length > 0 ? path[path.length - 1] : null;
    state.activeDeps = [];

    pushEvent(
      'DP_TRACE',
      `Optimal traceback highlighted (${path.length} cells) → answer ${state.targetAnswer}`,
      3,
      targets,
      {},
      0.95
    );

    return path;
  };

  return {
    get rows(): number {
      return state.rows;
    },

    get cols(): number {
      return state.cols;
    },

    get(row: number, col: number): number | null {
      const cell = getCell(state, row, col);
      if (!cell || cell.state === 'blocked') return null;
      return cell.value;
    },

    set(
      row: number,
      col: number,
      value: number,
      deps?: [number, number][]
    ): void {
      setImpl(row, col, value, deps);
    },

    computeCell(row: number, col: number): number | null {
      return computeCellImpl(row, col);
    },

    traceOptimal(): [number, number][] {
      return traceOptimalImpl();
    },

    runTabulation(): number | null {
      for (let r = 0; r < state.rows; r++) {
        for (let c = 0; c < state.cols; c++) {
          const cell = getCell(state, r, c);
          if (cell && (cell.state === 'empty' || cell.state === 'ready')) {
            computeCellImpl(r, c);
          }
        }
      }
      traceOptimalImpl();
      return getCell(state, state.rows - 1, state.cols - 1)?.value ?? null;
    },

    getState(): DPWorldState {
      return cloneDPState(state);
    },

    getEvents(): SimEvent<DPWorldState>[] {
      return events;
    },

    getMetrics(): SimMetrics {
      return { ...metrics };
    },
  };
}

export function evaluateDPLevel(
  level: LevelDefinition<DPWorldState>,
  state: DPWorldState,
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
      `Cycle budget exceeded (${metrics.cycles} / ${level.maxCyclesBudget} cycles). Avoid recomputing solved subproblems!`
    );
  }

  const expectedTable =
    state.expectedTable ?? level.initialState.expectedTable;
  if (expectedTable) {
    for (let r = 0; r < state.rows; r++) {
      for (let c = 0; c < state.cols; c++) {
        const expectedVal = expectedTable[r]?.[c];
        if (expectedVal === null || expectedVal === undefined) continue;
        const cell = getCell(state, r, c);
        if (!cell || cell.state === 'blocked') continue;
        if (cell.value === null) {
          return evaluateScore(
            false,
            metrics,
            level.par,
            level.insight,
            `Subproblem (${r}, ${c}) is still empty. Fill the memo table in bottom-up topological order.`
          );
        }
        if (cell.value !== expectedVal) {
          return evaluateScore(
            false,
            metrics,
            level.par,
            level.insight,
            `Recurrence mismatch at dp[${r}][${c}]: expected ${expectedVal}, got ${cell.value}.`
          );
        }
      }
    }
  }

  const targetCoord = Array.isArray(level.meta?.targetCell)
    ? (level.meta.targetCell as [number, number])
    : ([state.rows - 1, state.cols - 1] as [number, number]);
  const finalCell = getCell(state, targetCoord[0], targetCoord[1]);
  if (!finalCell || finalCell.value !== state.targetAnswer) {
    return evaluateScore(
      false,
      metrics,
      level.par,
      level.insight,
      `Target cell dp[${targetCoord[0]}][${targetCoord[1]}] must equal ${state.targetAnswer} (currently ${finalCell?.value ?? 'empty'}).`
    );
  }

  if (level.meta?.requireTraceback === true && !state.tracebackShown) {
    return evaluateScore(
      false,
      metrics,
      level.par,
      level.insight,
      'Optimal table computed — now call traceOptimal() (or click TRACE) to highlight the optimal solution path!'
    );
  }

  return evaluateScore(true, metrics, level.par, level.insight);
}
