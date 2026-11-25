import type {
  GridCell,
  LevelDefinition,
  PathfindingAlgorithm,
  PathfindingWorldState,
} from '../engine/types';

interface GridBlueprint {
  width: number;
  height: number;
  start: [number, number];
  goal: [number, number];
  algorithm: PathfindingAlgorithm;
  editableBudget?: number;
  walls?: [number, number][];
  weights?: [number, number, number][];
}

function buildGridState(bp: GridBlueprint): PathfindingWorldState {
  const wallSet = new Set((bp.walls ?? []).map(([x, y]) => `${x},${y}`));
  const weightMap = new Map(
    (bp.weights ?? []).map(([x, y, w]) => [`${x},${y}`, w]),
  );

  const cells: GridCell[] = [];
  for (let y = 0; y < bp.height; y++) {
    for (let x = 0; x < bp.width; x++) {
      const key = `${x},${y}`;
      const isStart = x === bp.start[0] && y === bp.start[1];
      const isGoal = x === bp.goal[0] && y === bp.goal[1];

      if (isStart) {
        cells.push({ x, y, type: 'start', weight: 1 });
      } else if (isGoal) {
        cells.push({ x, y, type: 'goal', weight: 1 });
      } else if (wallSet.has(key)) {
        cells.push({ x, y, type: 'wall', weight: 1 });
      } else if (weightMap.has(key)) {
        cells.push({ x, y, type: 'weighted', weight: weightMap.get(key)! });
      } else {
        cells.push({ x, y, type: 'open', weight: 1 });
      }
    }
  }

  return {
    world: 'pathfinding',
    width: bp.width,
    height: bp.height,
    cells,
    algorithm: bp.algorithm,
    start: bp.start,
    goal: bp.goal,
    editableBudget: bp.editableBudget ?? 0,
    pathCost: 0,
    visitedCount: 0,
    peakFrontier: 0,
    pathFound: false,
  };
}

export const PATHFINDING_LEVELS: LevelDefinition<PathfindingWorldState>[] = [
  {
    id: 'pathfinding-1',
    code: '4.1',
    worldId: 'pathfinding',
    order: 1,
    title: 'Wavefront Broadcast',
    concept: 'Breadth-First Search (Unweighted)',
    brief: 'Pulse a BFS wavefront across the 8x8 circuit grid to guarantee the shortest-hop route around the firewall.',
    goalSummary: 'Run BFS to reach the goal in optimal 10 hops',
    objectiveKind: 'path-optimal-hops',
    meta: {
      maxCost: 10,
    },
    initialState: buildGridState({
      width: 8,
      height: 8,
      start: [1, 1],
      goal: [6, 6],
      algorithm: 'bfs',
      editableBudget: 0,
      walls: [
        [3, 0],
        [3, 1],
        [3, 2],
        [3, 3],
        [3, 4],
        [3, 5],
        [5, 2],
        [5, 3],
        [5, 4],
      ],
    }),
    par: {
      sRankCycles: 36,
      threeStarCycles: 45,
      twoStarCycles: 55,
      maxAuxMemory: 12,
      targetBigO: 'O(V + E) optimal hops',
    },
    pseudocode: [
      'queue = [start]; visited.add(start)',
      'while queue is not empty:',
      '  curr = queue.dequeue()',
      '  if curr == goal: return reconstructPath()',
      '  for each open neighbor of curr:',
      '    if neighbor not visited: mark & enqueue',
    ],
    starterCode: `// Deploy Breadth-First Search across the unweighted 8x8 circuit grid.
// API: api.setAlgorithm('bfs' | 'dfs' | 'dijkstra' | 'greedy' | 'astar' | 'bidirectional'), api.setWall(x, y, bool), api.setWeight(x, y, w), api.runSearch()

api.setAlgorithm('bfs');
api.runSearch();
`,
    referenceSolution: `api.setAlgorithm('bfs');
api.runSearch();
`,
    hints: [
      'Every open tile on this grid has uniform weight 1, so hop count equals path cost.',
      'Breadth-First Search expands in concentric distance rings, guaranteeing shortest hops.',
      'Select BFS (or run api.setAlgorithm("bfs"); api.runSearch()) to route around the firewall in 10 hops.',
    ],
    insight:
      'BFS expands ring by ring in exact hop distance using a FIFO queue—guaranteeing the shortest path on any unweighted graph in O(V + E) time.',
    bigOIntuition:
      'Because every edge has uniform cost 1, the first time BFS touches the goal is guaranteed to be via the fewest possible hops.',
  },
  {
    id: 'pathfinding-2',
    code: '4.2',
    worldId: 'pathfinding',
    order: 2,
    title: 'Elevation Toll',
    concept: "Weighted Graphs & Dijkstra's Algorithm",
    brief: 'BFS blinds itself to high-elevation amber ridges (cost 5). Switch to Dijkstra to discover the minimum-cost detour.',
    goalSummary: 'Achieve optimal weighted path cost <= 9 using Dijkstra',
    objectiveKind: 'path-optimal-cost',
    meta: {
      maxCost: 9,
    },
    initialState: buildGridState({
      width: 8,
      height: 8,
      start: [1, 3],
      goal: [6, 3],
      algorithm: 'bfs',
      editableBudget: 0,
      walls: [
        [3, 5],
        [3, 6],
        [3, 7],
        [4, 5],
        [4, 6],
        [4, 7],
      ],
      weights: [
        [3, 2, 5],
        [3, 3, 5],
        [3, 4, 5],
        [4, 2, 5],
        [4, 3, 5],
        [4, 4, 5],
      ],
    }),
    par: {
      sRankCycles: 48,
      threeStarCycles: 54,
      twoStarCycles: 62,
      maxAuxMemory: 16,
      targetBigO: 'O((V + E) log V) optimal cost',
    },
    pseudocode: [
      'dist[start] = 0; pq.push(start, 0)',
      'while pq is not empty:',
      '  u = pq.popMin()',
      '  if u == goal: return reconstructPath()',
      '  for each neighbor v of u:',
      '    if dist[u] + weight(v) < dist[v]: relax(v)',
    ],
    starterCode: `// Notice BFS crosses the weight-5 amber ridge for cost 13!
// Switch to Dijkstra to find the cheaper weight-1 northern detour (cost 9).

api.setAlgorithm('bfs'); // TODO: change to 'dijkstra'
api.runSearch();
`,
    referenceSolution: `api.setAlgorithm('dijkstra');
api.runSearch();
`,
    hints: [
      'BFS treats weight-5 amber tiles as cost 1, marching straight through for a total toll of 13.',
      'Dijkstra uses a min-priority queue keyed by cumulative cost g(n) to route around expensive tiles.',
      'Switch the algorithm to "dijkstra" and run the search to take the cost-9 northern detour.',
    ],
    insight:
      'BFS counts hops, not tolls—so it marches straight through cost-5 amber monoliths (cost 13). Dijkstra uses a min-priority queue to always settle the cheapest cumulative cost first (cost 9).',
    bigOIntuition:
      'With non-negative edge weights, Dijkstra guarantees global cost optimality in O((V + E) log V) time.',
  },
  {
    id: 'pathfinding-3',
    code: '4.3',
    worldId: 'pathfinding',
    order: 3,
    title: 'Heuristic Beacon',
    concept: 'A* Search & Admissible Heuristics',
    brief: 'Dijkstra wastes cycles flooding all flanks of this 10x10 sector. Engage A* to beam straight toward the goal.',
    goalSummary: 'Reach goal in cost <= 11 while visiting <= 45 nodes (use A*)',
    objectiveKind: 'path-efficient-search',
    meta: {
      maxCost: 11,
      maxVisited: 45,
    },
    initialState: buildGridState({
      width: 10,
      height: 10,
      start: [1, 4],
      goal: [8, 4],
      algorithm: 'dijkstra',
      editableBudget: 0,
      walls: [
        [4, 3],
        [4, 4],
        [4, 5],
        [6, 2],
        [6, 3],
        [6, 6],
        [6, 7],
      ],
    }),
    par: {
      sRankCycles: 38,
      threeStarCycles: 45,
      twoStarCycles: 58,
      maxAuxMemory: 24,
      targetBigO: 'A* heuristic < 40% grid',
    },
    pseudocode: [
      'f(n) = g(n) + h(n)   // g = cost so far, h = Manhattan distance',
      'openSet.push(start, f(start))',
      'while openSet is not empty:',
      '  u = openSet.popLowestF()',
      '  if u == goal: return reconstructPath()',
      '  relax neighbors with priority g(v) + h(v)',
    ],
    starterCode: `// Dijkstra explores too much of this 10x10 arena!
// Switch to A* to guide the frontier with Manhattan distance.

api.setAlgorithm('dijkstra'); // TODO: switch to 'astar'
api.runSearch();
`,
    referenceSolution: `api.setAlgorithm('astar');
api.runSearch();
`,
    hints: [
      'Dijkstra expands equally in every direction because it has no sense of where the goal lies.',
      'A* adds Manhattan distance h(n) to path cost g(n), pulling the frontier straight toward the beacon.',
      'Switch to "astar" and runSearch() to keep visited nodes well under 45 while preserving cost 11.',
    ],
    insight:
      'Adding an admissible heuristic h(n) (Manhattan distance) focuses A* directly toward the target—slashing visited nodes dramatically while preserving exact optimality.',
    bigOIntuition:
      'Because Manhattan distance never overestimates 4-directional grid cost, A* is mathematically guaranteed to find the same optimal path as Dijkstra while expanding far fewer states.',
  },
  {
    id: 'pathfinding-4',
    code: '4.4',
    worldId: 'pathfinding',
    order: 4,
    title: 'Firewall Breach',
    concept: 'Terrain Optimization + A* Mastery',
    brief: 'You have 2 breach charges to clear firewall tiles along the center line, then deploy A* to hit strict S-Rank cost & frontier par.',
    goalSummary: 'Breach <= 2 walls & run A* for cost <= 9 and visited <= 25',
    objectiveKind: 'path-mastery',
    meta: {
      maxCost: 9,
      maxVisited: 25,
    },
    initialState: buildGridState({
      width: 10,
      height: 10,
      start: [1, 4],
      goal: [8, 4],
      algorithm: 'dijkstra',
      editableBudget: 2,
      walls: [
        [4, 1],
        [4, 2],
        [4, 3],
        [4, 4],
        [4, 5],
        [4, 6],
        [4, 7],
        [4, 8],
        [4, 9],
        [6, 2],
        [6, 3],
        [6, 4],
        [6, 5],
        [6, 6],
        [6, 7],
        [6, 8],
        [6, 9],
      ],
      weights: [
        [4, 0, 5],
        [5, 0, 5],
        [6, 1, 5],
      ],
    }),
    par: {
      sRankCycles: 16,
      threeStarCycles: 22,
      twoStarCycles: 32,
      maxAuxMemory: 22,
      targetBigO: 'A* + optimal breach',
    },
    pseudocode: [
      '// Spend 2 breach charges to open the central corridor',
      'setWall(4, 4, false)',
      'setWall(6, 4, false)',
      'setAlgorithm("astar")',
      'runSearch()  // Cost 7, minimal frontier',
    ],
    starterCode: `// You have an edit budget of 2 wall breaches!
// Clear two strategic firewall tiles on row y=4, then deploy A*.

// api.setWall(4, 4, false);
// api.setWall(6, 4, false);
api.setAlgorithm('astar');
api.runSearch();
`,
    referenceSolution: `api.setWall(4, 4, false);
api.setWall(6, 4, false);
api.setAlgorithm('astar');
api.runSearch();
`,
    hints: [
      'Both start (1, 4) and goal (8, 4) sit on row y = 4, separated by two vertical firewalls.',
      'Use your 2 breach charges to punch directly through row y = 4 rather than paying the northern weight-5 tolls.',
      'Clear walls (4, 4) and (6, 4), then run A* for a straight cost-7 beam.',
    ],
    insight:
      'Algorithmic efficiency and graph topology work hand in hand: removing just two bottleneck barriers turns a costly 25-unit weighted detour into a laser-straight 7-unit A* beam.',
    bigOIntuition:
      'On an unobstructed corridor aligned with the goal, A* expands nearly O(d) nodes—linear in path length rather than quadratic in grid area.',
  },
  {
    id: 'pathfinding-5',
    code: '4.5',
    worldId: 'pathfinding',
    order: 5,
    title: 'Concave Trap',
    concept: 'Greedy Best-First vs. A* Admissibility',
    brief: 'Greedy Best-First dives blind into the weighted U-trap straight ahead. Switch to A* to respect both g(n) and h(n).',
    goalSummary: 'Beat the U-trap with optimal cost <= 13 & visited <= 48 (use A*)',
    objectiveKind: 'path-efficient-search',
    meta: {
      maxCost: 13,
      maxVisited: 48,
    },
    initialState: buildGridState({
      width: 10,
      height: 10,
      start: [1, 4],
      goal: [8, 4],
      algorithm: 'greedy',
      editableBudget: 0,
      walls: [
        [3, 2],
        [4, 2],
        [5, 2],
        [5, 3],
        [5, 5],
        [5, 6],
        [3, 6],
        [4, 6],
      ],
      weights: [
        [3, 3, 5],
        [3, 4, 5],
        [3, 5, 5],
        [4, 3, 5],
        [4, 4, 5],
        [4, 5, 5],
        [5, 4, 5],
        [6, 4, 5],
      ],
    }),
    par: {
      sRankCycles: 46,
      threeStarCycles: 54,
      twoStarCycles: 68,
      maxAuxMemory: 24,
      targetBigO: 'A* f(n) = g(n) + h(n)',
    },
    pseudocode: [
      '// Greedy uses only h(n) and walks straight into the weight-5 canyon!',
      '// A* combines accumulated cost g(n) + Manhattan heuristic h(n):',
      'setAlgorithm("astar")',
      'runSearch()  // Routes cleanly around the U-trap at cost 13',
    ],
    starterCode: `// Greedy Best-First minimizes ONLY h(n), ignoring the cost-5 canyon floor!
// Switch to A* so the search accounts for both accumulated cost g(n) and h(n).

api.setAlgorithm('greedy'); // TODO: switch to 'astar'
api.runSearch();
`,
    referenceSolution: `api.setAlgorithm('astar');
api.runSearch();
`,
    hints: [
      'Greedy Best-First ranks nodes purely by Manhattan distance h(n), ignoring tile tolls completely.',
      'Because the center gap points straight at (8, 4), Greedy pays cost 23 crossing the amber floor.',
      'Switch to "astar" so f(n) = g(n) + h(n) rejects the heavy corridor and loops cleanly around for cost 13.',
    ],
    insight:
      'Greedy Best-First is fast but non-optimal—it ignores accumulated cost g(n) and marches right into high-toll traps. A* balances g(n) + h(n) to guarantee the optimal detour.',
    bigOIntuition:
      'Whenever h(n) is admissible (never overestimates true remaining cost), A* guarantees optimal cost while still pruning far more states than Dijkstra.',
  },
  {
    id: 'pathfinding-6',
    code: '4.6',
    worldId: 'pathfinding',
    order: 6,
    title: 'Twin Wavefront',
    concept: 'Bidirectional BFS — O(b^(d/2))',
    brief: 'Single-source BFS floods this 12x12 arena past the visited budget. Launch Bidirectional BFS so start and goal waves collide mid-grid.',
    goalSummary: 'Reach goal in cost <= 12 while visiting <= 56 tiles (Bidirectional)',
    objectiveKind: 'path-efficient-search',
    meta: {
      maxCost: 12,
      maxVisited: 56,
    },
    initialState: buildGridState({
      width: 12,
      height: 12,
      start: [1, 5],
      goal: [10, 6],
      algorithm: 'bfs',
      editableBudget: 0,
      walls: [
        [4, 2],
        [4, 3],
        [4, 8],
        [4, 9],
        [7, 2],
        [7, 3],
        [7, 8],
        [7, 9],
      ],
    }),
    par: {
      sRankCycles: 56,
      threeStarCycles: 64,
      twoStarCycles: 76,
      maxAuxMemory: 32,
      targetBigO: 'O(b^(d/2)) twin waves',
    },
    pseudocode: [
      'openStart = [start]; openGoal = [goal]',
      'while openStart and openGoal are non-empty:',
      '  expand one layer from start wave (cyan)',
      '  expand one layer from goal wave (violet)',
      '  if waves touch: stitch start -> meet -> goal!',
    ],
    starterCode: `// Single-source BFS floods over 80 tiles on this 12x12 arena!
// Switch to 'bidirectional' to launch twin wavefronts from start and goal.

api.setAlgorithm('bfs'); // TODO: switch to 'bidirectional'
api.runSearch();
`,
    referenceSolution: `api.setAlgorithm('bidirectional');
api.runSearch();
`,
    hints: [
      'A single BFS circle of radius d has area proportional to d^2—flooding most of this 12x12 grid.',
      'Two half-radius circles of radius d/2 cover only 2 * (d/2)^2 = half the area!',
      'Switch to "bidirectional" and runSearch() to watch the cyan and violet waves collide in the center.',
    ],
    insight:
      'Bidirectional BFS shrinks search complexity from O(b^d) down to O(b^(d/2)) by meeting halfway—dramatically cutting explored tiles on unweighted graphs while keeping exact shortest-hop optimality.',
    bigOIntuition:
      'Two expanding disks of radius d/2 cover roughly half the 2D area of a single disk of radius d—and exponentially less in high-branching graphs.',
  },
];
