import { createEmptyMetrics, evaluateScore } from '../scorer';
import type {
  GridCell,
  LevelDefinition,
  PathfindingAlgorithm,
  PathfindingWorldState,
  ScoreReport,
  SimEvent,
  SimMetrics,
} from '../types';

export function clonePathfindingState(
  state: PathfindingWorldState
): PathfindingWorldState {
  return {
    world: 'pathfinding',
    width: state.width,
    height: state.height,
    cells: state.cells.map((cell) => ({ ...cell })),
    algorithm: state.algorithm,
    start: [state.start[0], state.start[1]],
    goal: [state.goal[0], state.goal[1]],
    editableBudget: state.editableBudget,
    pathCost: state.pathCost,
    visitedCount: state.visitedCount,
    peakFrontier: state.peakFrontier,
    pathFound: state.pathFound,
  };
}

export interface SearchSummary {
  pathFound: boolean;
  pathCost: number;
  visitedCount: number;
  peakFrontier: number;
}

export interface AlgorithmComparisonRow extends SearchSummary {
  algorithm: PathfindingAlgorithm;
}

export interface PathfindingSession {
  setAlgorithm(algo: PathfindingAlgorithm): void;
  setWall(x: number, y: number, isWall: boolean): void;
  setWeight(x: number, y: number, weight: number): void;
  setStart(x: number, y: number): void;
  setGoal(x: number, y: number): void;
  runSearch(): SearchSummary;
  compareAllAlgorithms(): AlgorithmComparisonRow[];
  getState(): PathfindingWorldState;
  getEvents(): SimEvent<PathfindingWorldState>[];
  getMetrics(): SimMetrics;
}

const DIRECTIONS: ReadonlyArray<[number, number]> = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

function cellKey(x: number, y: number): string {
  return `${x},${y}`;
}

function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export function createPathfindingSession(
  initialState: PathfindingWorldState
): PathfindingSession {
  const state = clonePathfindingState(initialState);
  const events: SimEvent<PathfindingWorldState>[] = [];
  const metrics = createEmptyMetrics();
  let nextEventId = 1;

  const getCell = (x: number, y: number): GridCell | undefined => {
    if (x < 0 || y < 0 || x >= state.width || y >= state.height) {
      return undefined;
    }
    const idx = y * state.width + x;
    const direct = state.cells[idx];
    if (direct && direct.x === x && direct.y === y) {
      return direct;
    }
    return state.cells.find((c) => c.x === x && c.y === y);
  };

  const pushEvent = (
    type: SimEvent<PathfindingWorldState>['type'],
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
      snapshot: clonePathfindingState(state),
    });
  };

  const clearSearchOverlays = (): void => {
    for (const cell of state.cells) {
      cell.visited = false;
      cell.visitedBy = undefined;
      cell.inFrontier = false;
      cell.inPath = false;
      cell.distance = undefined;
    }
    state.pathCost = 0;
    state.visitedCount = 0;
    state.peakFrontier = 0;
    state.pathFound = false;
  };

  const runBidirectionalSearch = (
    sx: number,
    sy: number,
    gx: number,
    gy: number,
    startKey: string,
    goalKey: string,
    startCell: GridCell,
    goalCell: GridCell,
    pitchFor: (x: number, y: number) => number
  ): SearchSummary => {
    let visitedCount = 0;
    let peakFrontier = 0;

    if (startKey === goalKey) {
      startCell.visited = true;
      startCell.visitedBy = 'start';
      startCell.inPath = true;
      startCell.distance = 0;
      visitedCount = 1;
      peakFrontier = 1;
      state.pathFound = true;
      state.pathCost = 0;
      state.visitedCount = 1;
      state.peakFrontier = 1;
      metrics.cycles = 1;
      metrics.auxMemory = 1;
      pushEvent('VISIT', `Visit (${sx}, ${sy}) [d=0]`, 1, [startKey], { cycles: 1, auxMemory: 1 }, 1);
      pushEvent('PATH_FOUND', `BIDIRECTIONAL path found: cost 0, visited 1, peak frontier 1`, 4, [startKey], { auxMemory: 1 }, 1);
      return { pathFound: true, pathCost: 0, visitedCount: 1, peakFrontier: 1 };
    }

    interface BiEntry {
      x: number;
      y: number;
      key: string;
      d: number;
    }

    const openStart: BiEntry[] = [{ x: sx, y: sy, key: startKey, d: 0 }];
    const openGoal: BiEntry[] = [{ x: gx, y: gy, key: goalKey, d: 0 }];
    const parentStart = new Map<string, string>();
    const parentGoal = new Map<string, string>();
    const seenStart = new Set<string>([startKey]);
    const seenGoal = new Set<string>([goalKey]);
    const inFrontierStart = new Set<string>([startKey]);
    const inFrontierGoal = new Set<string>([goalKey]);

    startCell.inFrontier = true;
    startCell.visitedBy = 'start';
    startCell.distance = 0;
    goalCell.inFrontier = true;
    goalCell.visitedBy = 'goal';
    goalCell.distance = 0;

    peakFrontier = 2;
    state.peakFrontier = peakFrontier;
    metrics.auxMemory = peakFrontier;

    pushEvent(
      'FRONTIER',
      `Seed BIDIRECTIONAL waves at (${sx}, ${sy}) & (${gx}, ${gy})`,
      0,
      [startKey, goalKey],
      { auxMemory: peakFrontier },
      0.5
    );

    let meetStartKey: string | null = null;
    let meetGoalKey: string | null = null;
    let turn: 'start' | 'goal' = 'start';

    while (openStart.length > 0 && openGoal.length > 0) {
      const side = turn;
      turn = turn === 'start' ? 'goal' : 'start';

      const queue = side === 'start' ? openStart : openGoal;
      const inFrontierOwn = side === 'start' ? inFrontierStart : inFrontierGoal;
      const seenOwn = side === 'start' ? seenStart : seenGoal;
      const seenOther = side === 'start' ? seenGoal : seenStart;
      const parentOwn = side === 'start' ? parentStart : parentGoal;

      const current = queue.shift()!;
      inFrontierOwn.delete(current.key);

      const currCell = getCell(current.x, current.y)!;
      currCell.inFrontier = false;
      currCell.visited = true;
      currCell.visitedBy = side;

      visitedCount += 1;
      state.visitedCount = visitedCount;
      state.peakFrontier = peakFrontier;
      metrics.cycles = visitedCount;
      metrics.auxMemory = peakFrontier;

      pushEvent(
        'VISIT',
        `Visit (${current.x}, ${current.y}) [${side} wave, d=${current.d}]`,
        1,
        [current.key],
        { cycles: 1, auxMemory: peakFrontier },
        pitchFor(current.x, current.y)
      );

      for (const [dx, dy] of DIRECTIONS) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const neighbor = getCell(nx, ny);
        if (!neighbor || neighbor.type === 'wall') continue;

        const nKey = cellKey(nx, ny);
        if (seenOther.has(nKey)) {
          if (side === 'start') {
            meetStartKey = current.key;
            meetGoalKey = nKey;
          } else {
            meetStartKey = nKey;
            meetGoalKey = current.key;
          }
          break;
        }

        if (seenOwn.has(nKey)) continue;

        seenOwn.add(nKey);
        parentOwn.set(nKey, current.key);
        inFrontierOwn.add(nKey);
        neighbor.distance = current.d + 1;
        neighbor.inFrontier = true;
        neighbor.visitedBy = side;

        queue.push({ x: nx, y: ny, key: nKey, d: current.d + 1 });

        const frontierSize = inFrontierStart.size + inFrontierGoal.size;
        if (frontierSize > peakFrontier) {
          peakFrontier = frontierSize;
          state.peakFrontier = peakFrontier;
          metrics.auxMemory = peakFrontier;
        }

        pushEvent(
          'FRONTIER',
          `Discover (${nx}, ${ny}) [${side} wave, hops=${current.d + 1}]`,
          2,
          [nKey],
          { auxMemory: peakFrontier },
          pitchFor(nx, ny)
        );
      }

      if (meetStartKey && meetGoalKey) {
        break;
      }
    }

    if (meetStartKey && meetGoalKey) {
      const leftHalf: string[] = [];
      let trace: string | undefined = meetStartKey;
      while (trace) {
        leftHalf.push(trace);
        if (trace === startKey) break;
        trace = parentStart.get(trace);
      }
      leftHalf.reverse();

      const rightHalf: string[] = [];
      trace = meetGoalKey;
      while (trace) {
        rightHalf.push(trace);
        if (trace === goalKey) break;
        trace = parentGoal.get(trace);
      }

      const pathKeys = [...leftHalf, ...rightHalf];
      let totalCost = 0;
      for (let i = 0; i < pathKeys.length; i++) {
        const [px, py] = pathKeys[i].split(',').map(Number);
        const pCell = getCell(px, py);
        if (pCell) {
          pCell.inPath = true;
          if (i > 0) {
            totalCost += Math.max(1, pCell.weight);
          }
        }
      }

      state.pathFound = true;
      state.pathCost = totalCost;
      state.visitedCount = visitedCount;
      state.peakFrontier = peakFrontier;
      metrics.cycles = visitedCount;
      metrics.auxMemory = peakFrontier;

      pushEvent(
        'PATH_FOUND',
        `BIDIRECTIONAL waves met! cost ${totalCost}, visited ${visitedCount}, peak frontier ${peakFrontier}`,
        4,
        pathKeys,
        { auxMemory: peakFrontier },
        1
      );

      return {
        pathFound: true,
        pathCost: totalCost,
        visitedCount,
        peakFrontier,
      };
    }

    state.pathFound = false;
    state.pathCost = 0;
    state.visitedCount = visitedCount;
    state.peakFrontier = peakFrontier;
    metrics.cycles = visitedCount;
    metrics.auxMemory = peakFrontier;

    pushEvent(
      'NO_PATH',
      `BIDIRECTIONAL exhausted frontiers — goal (${gx}, ${gy}) unreachable`,
      5,
      [goalKey],
      { auxMemory: peakFrontier },
      0
    );

    return {
      pathFound: false,
      pathCost: 0,
      visitedCount,
      peakFrontier,
    };
  };

  const runSearchImpl = (): SearchSummary => {
    clearSearchOverlays();
    metrics.cycles = 0;
    metrics.auxMemory = 0;

    const [sx, sy] = state.start;
    const [gx, gy] = state.goal;
    const startKey = cellKey(sx, sy);
    const goalKey = cellKey(gx, gy);
    const maxDist = Math.max(1, state.width + state.height - 2);

    const pitchFor = (x: number, y: number): number => {
      const dist = manhattan(x, y, gx, gy);
      return Math.max(0, Math.min(1, 1 - dist / maxDist));
    };

    const startCell = getCell(sx, sy);
    const goalCell = getCell(gx, gy);
    if (!startCell || !goalCell) {
      pushEvent('NO_PATH', 'Invalid start or goal coordinates', 5, [], {}, 0);
      return { pathFound: false, pathCost: 0, visitedCount: 0, peakFrontier: 0 };
    }

    if (state.algorithm === 'bidirectional') {
      return runBidirectionalSearch(
        sx,
        sy,
        gx,
        gy,
        startKey,
        goalKey,
        startCell,
        goalCell,
        pitchFor
      );
    }

    const cameFrom = new Map<string, string>();
    const gScore = new Map<string, number>();
    const closed = new Set<string>();
    const inOpen = new Set<string>();

    interface QueueEntry {
      x: number;
      y: number;
      key: string;
      g: number;
      f: number;
      h: number;
      order: number;
    }

    const open: QueueEntry[] = [];
    let pushOrder = 0;
    let visitedCount = 0;
    let peakFrontier = 1;

    const startH = manhattan(sx, sy, gx, gy);
    gScore.set(startKey, 0);
    startCell.distance = 0;
    startCell.inFrontier = true;
    inOpen.add(startKey);
    open.push({
      x: sx,
      y: sy,
      key: startKey,
      g: 0,
      f:
        state.algorithm === 'astar' || state.algorithm === 'greedy'
          ? startH
          : 0,
      h: startH,
      order: pushOrder++,
    });

    pushEvent(
      'FRONTIER',
      `Seed ${state.algorithm.toUpperCase()} frontier at (${sx}, ${sy})`,
      0,
      [startKey],
      { auxMemory: 1 },
      pitchFor(sx, sy)
    );

    const popNext = (): QueueEntry | undefined => {
      if (open.length === 0) return undefined;
      if (state.algorithm === 'bfs') {
        return open.shift();
      }
      if (state.algorithm === 'dfs') {
        return open.pop();
      }
      let bestIdx = 0;
      for (let i = 1; i < open.length; i++) {
        const a = open[i];
        const b = open[bestIdx];
        if (
          a.f < b.f ||
          (a.f === b.f && a.h < b.h) ||
          (a.f === b.f && a.h === b.h && a.order < b.order)
        ) {
          bestIdx = i;
        }
      }
      const [picked] = open.splice(bestIdx, 1);
      return picked;
    };

    let found = false;

    while (open.length > 0) {
      const current = popNext()!;
      if (closed.has(current.key)) {
        continue;
      }

      closed.add(current.key);
      inOpen.delete(current.key);

      const currCell = getCell(current.x, current.y)!;
      currCell.inFrontier = false;
      currCell.visited = true;

      visitedCount += 1;
      state.visitedCount = visitedCount;
      state.peakFrontier = peakFrontier;
      metrics.cycles = visitedCount;
      metrics.auxMemory = peakFrontier;

      pushEvent(
        'VISIT',
        `Visit (${current.x}, ${current.y}) [g=${current.g}]`,
        1,
        [current.key],
        { cycles: 1, auxMemory: peakFrontier },
        pitchFor(current.x, current.y)
      );

      if (current.key === goalKey) {
        found = true;
        break;
      }

      for (const [dx, dy] of DIRECTIONS) {
        const nx = current.x + dx;
        const ny = current.y + dy;
        const neighbor = getCell(nx, ny);
        if (!neighbor || neighbor.type === 'wall') continue;

        const nKey = cellKey(nx, ny);
        if (closed.has(nKey)) continue;

        const stepWeight =
          state.algorithm === 'bfs' || state.algorithm === 'dfs'
            ? 1
            : Math.max(1, neighbor.weight);
        const tentativeG = current.g + stepWeight;

        if (state.algorithm === 'bfs' || state.algorithm === 'dfs') {
          if (inOpen.has(nKey)) continue;
          cameFrom.set(nKey, current.key);
          gScore.set(nKey, tentativeG);
          neighbor.distance = tentativeG;
          neighbor.inFrontier = true;
          inOpen.add(nKey);
          open.push({
            x: nx,
            y: ny,
            key: nKey,
            g: tentativeG,
            f: tentativeG,
            h: manhattan(nx, ny, gx, gy),
            order: pushOrder++,
          });
          if (inOpen.size > peakFrontier) {
            peakFrontier = inOpen.size;
            state.peakFrontier = peakFrontier;
            metrics.auxMemory = peakFrontier;
          }
          pushEvent(
            'FRONTIER',
            `Discover (${nx}, ${ny}) [hops=${tentativeG}]`,
            2,
            [nKey],
            { auxMemory: peakFrontier },
            pitchFor(nx, ny)
          );
        } else if (state.algorithm === 'greedy') {
          if (inOpen.has(nKey)) continue;
          const h = manhattan(nx, ny, gx, gy);
          cameFrom.set(nKey, current.key);
          gScore.set(nKey, tentativeG);
          neighbor.distance = tentativeG;
          neighbor.inFrontier = true;
          inOpen.add(nKey);
          open.push({
            x: nx,
            y: ny,
            key: nKey,
            g: tentativeG,
            f: h,
            h,
            order: pushOrder++,
          });
          if (inOpen.size > peakFrontier) {
            peakFrontier = inOpen.size;
            state.peakFrontier = peakFrontier;
            metrics.auxMemory = peakFrontier;
          }
          pushEvent(
            'FRONTIER',
            `Greedy frontier (${nx}, ${ny}) [h=${h}, g=${tentativeG}]`,
            2,
            [nKey],
            { auxMemory: peakFrontier },
            pitchFor(nx, ny)
          );
        } else {
          const prevG = gScore.get(nKey);
          if (prevG !== undefined && tentativeG >= prevG) {
            continue;
          }
          const isRelax = prevG !== undefined;
          cameFrom.set(nKey, current.key);
          gScore.set(nKey, tentativeG);
          neighbor.distance = tentativeG;
          neighbor.inFrontier = true;
          inOpen.add(nKey);

          const h = manhattan(nx, ny, gx, gy);
          const f = state.algorithm === 'astar' ? tentativeG + h : tentativeG;
          open.push({
            x: nx,
            y: ny,
            key: nKey,
            g: tentativeG,
            f,
            h,
            order: pushOrder++,
          });

          if (inOpen.size > peakFrontier) {
            peakFrontier = inOpen.size;
            state.peakFrontier = peakFrontier;
            metrics.auxMemory = peakFrontier;
          }

          pushEvent(
            isRelax ? 'RELAX_EDGE' : 'FRONTIER',
            isRelax
              ? `Relax edge → (${nx}, ${ny}) [g=${tentativeG}, f=${f}]`
              : `Frontier (${nx}, ${ny}) [g=${tentativeG}, f=${f}]`,
            isRelax ? 3 : 2,
            [nKey],
            { auxMemory: peakFrontier },
            pitchFor(nx, ny)
          );
        }
      }
    }

    if (found) {
      const pathKeys: string[] = [];
      let trace: string | undefined = goalKey;
      while (trace) {
        pathKeys.push(trace);
        if (trace === startKey) break;
        trace = cameFrom.get(trace);
      }
      pathKeys.reverse();

      let totalCost = 0;
      for (let i = 0; i < pathKeys.length; i++) {
        const [px, py] = pathKeys[i].split(',').map(Number);
        const pCell = getCell(px, py);
        if (pCell) {
          pCell.inPath = true;
          if (i > 0) {
            totalCost += Math.max(1, pCell.weight);
          }
        }
      }

      state.pathFound = true;
      state.pathCost = totalCost;
      state.visitedCount = visitedCount;
      state.peakFrontier = peakFrontier;
      metrics.cycles = visitedCount;
      metrics.auxMemory = peakFrontier;

      pushEvent(
        'PATH_FOUND',
        `${state.algorithm.toUpperCase()} path found: cost ${totalCost}, visited ${visitedCount}, peak frontier ${peakFrontier}`,
        4,
        pathKeys,
        { auxMemory: peakFrontier },
        1
      );

      return {
        pathFound: true,
        pathCost: totalCost,
        visitedCount,
        peakFrontier,
      };
    }

    state.pathFound = false;
    state.pathCost = 0;
    state.visitedCount = visitedCount;
    state.peakFrontier = peakFrontier;
    metrics.cycles = visitedCount;
    metrics.auxMemory = peakFrontier;

    pushEvent(
      'NO_PATH',
      `${state.algorithm.toUpperCase()} exhausted frontier — goal (${gx}, ${gy}) unreachable`,
      5,
      [goalKey],
      { auxMemory: peakFrontier },
      0
    );

    return {
      pathFound: false,
      pathCost: 0,
      visitedCount,
      peakFrontier,
    };
  };

  return {
    setAlgorithm(algo: PathfindingAlgorithm): void {
      state.algorithm = algo;
    },

    setWall(x: number, y: number, isWall: boolean): void {
      const cell = getCell(x, y);
      if (!cell || cell.type === 'start' || cell.type === 'goal') return;
      cell.type = isWall ? 'wall' : 'open';
      cell.weight = 1;
    },

    setWeight(x: number, y: number, weight: number): void {
      const cell = getCell(x, y);
      if (!cell || cell.type === 'start' || cell.type === 'goal') return;
      const clamped = Math.max(1, Math.round(weight));
      cell.weight = clamped;
      cell.type = clamped > 1 ? 'weighted' : 'open';
    },

    setStart(x: number, y: number): void {
      const next = getCell(x, y);
      if (!next || next.type === 'goal') return;
      const old = getCell(state.start[0], state.start[1]);
      if (old && old.type === 'start') {
        old.type = 'open';
        old.weight = 1;
      }
      next.type = 'start';
      next.weight = 1;
      state.start = [x, y];
    },

    setGoal(x: number, y: number): void {
      const next = getCell(x, y);
      if (!next || next.type === 'start') return;
      const old = getCell(state.goal[0], state.goal[1]);
      if (old && old.type === 'goal') {
        old.type = 'open';
        old.weight = 1;
      }
      next.type = 'goal';
      next.weight = 1;
      state.goal = [x, y];
    },

    runSearch(): SearchSummary {
      return runSearchImpl();
    },

    compareAllAlgorithms(): AlgorithmComparisonRow[] {
      const algorithms: PathfindingAlgorithm[] = [
        'bfs',
        'dfs',
        'dijkstra',
        'greedy',
        'astar',
        'bidirectional',
      ];
      return algorithms.map((algorithm) => {
        const cloned = clonePathfindingState(state);
        cloned.algorithm = algorithm;
        const tempSession = createPathfindingSession(cloned);
        const summary = tempSession.runSearch();
        return { algorithm, ...summary };
      });
    },

    getState(): PathfindingWorldState {
      return clonePathfindingState(state);
    },

    getEvents(): SimEvent<PathfindingWorldState>[] {
      return events;
    },

    getMetrics(): SimMetrics {
      return { ...metrics };
    },
  };
}

export function evaluatePathfindingLevel(
  level: LevelDefinition<PathfindingWorldState>,
  state: PathfindingWorldState,
  metrics: SimMetrics
): ScoreReport {
  const effectiveMetrics: SimMetrics = {
    cycles: state.visitedCount > 0 ? state.visitedCount : metrics.cycles,
    auxMemory: state.peakFrontier > 0 ? state.peakFrontier : metrics.auxMemory,
    leaks: metrics.leaks,
    overflows: metrics.overflows,
  };

  if (!state.pathFound) {
    return evaluateScore(
      false,
      effectiveMetrics,
      level.par,
      level.insight,
      'No valid path found to the goal. Run the search wave or clear a route through the grid.'
    );
  }

  const requiredAlgorithm =
    typeof level.meta?.requiredAlgorithm === 'string'
      ? (level.meta.requiredAlgorithm as PathfindingAlgorithm)
      : undefined;
  if (requiredAlgorithm && state.algorithm !== requiredAlgorithm) {
    return evaluateScore(
      false,
      effectiveMetrics,
      level.par,
      level.insight,
      `This mission requires ${requiredAlgorithm.toUpperCase()} (currently using ${state.algorithm.toUpperCase()}).`
    );
  }

  const maxCost =
    typeof level.meta?.maxCost === 'number' ? level.meta.maxCost : undefined;
  if (maxCost !== undefined && state.pathCost > maxCost) {
    const costHint =
      state.algorithm === 'bfs' || state.algorithm === 'bidirectional'
        ? `${state.algorithm.toUpperCase()} ignores tile elevation weights — try Dijkstra or A*!`
        : state.algorithm === 'greedy'
          ? 'Greedy Best-First ignores accumulated path cost g(n) and fell into the trap — switch to A*!'
          : state.algorithm === 'dfs'
            ? 'DFS does not guarantee shortest paths — try BFS, Dijkstra, or A*!'
            : 'Try routing around high-elevation weighted tiles.';
    return evaluateScore(
      false,
      effectiveMetrics,
      level.par,
      level.insight,
      `Path cost ${state.pathCost} exceeds optimal target (${maxCost}). ${costHint}`
    );
  }

  const maxVisited =
    typeof level.meta?.maxVisited === 'number'
      ? level.meta.maxVisited
      : undefined;
  if (maxVisited !== undefined && state.visitedCount > maxVisited) {
    return evaluateScore(
      false,
      effectiveMetrics,
      level.par,
      level.insight,
      `Explored ${state.visitedCount} nodes (max allowed: ${maxVisited}). Switch to A* or Bidirectional BFS to shrink the explored frontier.`
    );
  }

  const kind = level.objectiveKind ?? 'path-optimal-hops';
  if (
    (kind === 'path-efficient-search' || kind === 'path-mastery') &&
    maxVisited === undefined &&
    state.visitedCount > level.par.twoStarCycles
  ) {
    return evaluateScore(
      false,
      effectiveMetrics,
      level.par,
      level.insight,
      `Search expanded ${state.visitedCount} nodes, exceeding efficiency budget (${level.par.twoStarCycles}). Use A* for heuristic guidance.`
    );
  }

  return evaluateScore(true, effectiveMetrics, level.par, level.insight);
}
