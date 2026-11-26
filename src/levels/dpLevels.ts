import type {
  DPCell,
  DPItem,
  DPMode,
  DPWorldState,
  LevelDefinition,
} from '../engine/types';
import { computeReadyCells } from '../engine/worlds/dpEngine';

interface DPTableSpec {
  mode: DPMode;
  rows: number;
  cols: number;
  rowLabels: string[];
  colLabels: string[];
  baseCells: Array<[number, number, number]>;
  blockedCells?: Array<[number, number]>;
  expectedTable: (number | null)[][];
  optimalPath: [number, number][];
  targetAnswer: number;
  naiveRecursionOps: number;
  items?: DPItem[];
  coins?: number[];
  strA?: string;
  strB?: string;
}

function buildDPState(spec: DPTableSpec): DPWorldState {
  const baseMap = new Map<string, number>(
    spec.baseCells.map(([r, c, v]) => [`${r},${c}`, v]),
  );
  const blockedSet = new Set<string>(
    (spec.blockedCells ?? []).map(([r, c]) => `${r},${c}`),
  );

  const cells: DPCell[] = [];
  for (let r = 0; r < spec.rows; r++) {
    for (let c = 0; c < spec.cols; c++) {
      const key = `${r},${c}`;
      if (blockedSet.has(key)) {
        cells.push({ row: r, col: c, value: null, state: 'blocked' });
      } else if (baseMap.has(key)) {
        cells.push({ row: r, col: c, value: baseMap.get(key)!, state: 'computed' });
      } else {
        cells.push({ row: r, col: c, value: null, state: 'empty' });
      }
    }
  }

  const state: DPWorldState = {
    world: 'dp',
    mode: spec.mode,
    rows: spec.rows,
    cols: spec.cols,
    rowLabels: [...spec.rowLabels],
    colLabels: [...spec.colLabels],
    cells,
    activeCell: null,
    activeDeps: [],
    targetAnswer: spec.targetAnswer,
    expectedTable: spec.expectedTable.map((row) => [...row]),
    optimalPath: spec.optimalPath.map(([r, c]) => [r, c] as [number, number]),
    naiveRecursionOps: spec.naiveRecursionOps,
    items: spec.items ? spec.items.map((item) => ({ ...item })) : undefined,
    coins: spec.coins ? [...spec.coins] : undefined,
    strA: spec.strA,
    strB: spec.strB,
    tracebackShown: false,
  };

  computeReadyCells(state);
  return state;
}

export const DP_LEVELS: LevelDefinition<DPWorldState>[] = [
  {
    id: 'dp-1',
    code: '6.1',
    worldId: 'dp',
    order: 1,
    title: 'Stairway Pulse',
    concept: 'Climbing Stairs / Fibonacci Tabulation',
    brief: 'Fill the 1D memo rail from step 2 to step 6 where each step equals dp[i-1] + dp[i-2], reaching 13 ways in 5 ops instead of 41 recursive calls.',
    goalSummary: 'Tabulate dp[0..6] -> 13 ways (vs. 41 naive recursion ops)',
    objectiveKind: 'dp-tabulate',
    initialState: buildDPState({
      mode: 'fib',
      rows: 1,
      cols: 7,
      rowLabels: ['ways'],
      colLabels: ['s0', 's1', 's2', 's3', 's4', 's5', 's6'],
      baseCells: [
        [0, 0, 1],
        [0, 1, 1],
      ],
      expectedTable: [[1, 1, 2, 3, 5, 8, 13]],
      optimalPath: [
        [0, 0],
        [0, 1],
        [0, 2],
        [0, 3],
        [0, 4],
        [0, 5],
        [0, 6],
      ],
      targetAnswer: 13,
      naiveRecursionOps: 41,
    }),
    par: {
      sRankCycles: 5,
      threeStarCycles: 7,
      twoStarCycles: 10,
      maxAuxMemory: 7,
      targetBigO: 'O(n) time / O(n) table',
    },
    pseudocode: [
      'dp[0] = 1; dp[1] = 1',
      'for i = 2 to 6:',
      '  dp[i] = dp[i - 1] + dp[i - 2]',
      'traceOptimal()  // dp[6] = 13',
    ],
    starterCode: `// Compute ways to climb 0..6 stairs taking 1 or 2 steps at a time.
// API: api.rows, api.cols, api.get(r, c), api.set(r, c, val, deps?), api.computeCell(r, c), api.traceOptimal()

for (let c = 2; c < api.cols; c++) {
  // TODO: sum dp[0][c-1] + dp[0][c-2] and write dp[0][c]
}
api.traceOptimal();
`,
    referenceSolution: `for (let c = 2; c < api.cols; c++) {
  const val = api.get(0, c - 1) + api.get(0, c - 2);
  api.set(0, c, val, [[0, c - 1], [0, c - 2]]);
}
api.traceOptimal();
`,
    hints: [
      'You can arrive at step i either from step i - 1 (1-step hop) or step i - 2 (2-step hop).',
      'Sum the two glowing predecessor cells dp[i - 1] and dp[i - 2] moving left-to-right.',
      'Fill s2=2, s3=3, s4=5, s5=8, s6=13 via api.set(0, c, prev1 + prev2) or click each glowing ready cell.',
    ],
    insight:
      'Memoizing overlapping subproblems collapses exponential O(2^n) recursion (41 calls) into a single linear O(n) pass of just 5 additions.',
    bigOIntuition:
      'Each subproblem dp[i] is solved exactly once and reused in O(1), reducing time from O(1.618^n) to O(n).',
  },
  {
    id: 'dp-2',
    code: '6.2',
    worldId: 'dp',
    order: 2,
    title: 'Vault Raider',
    concept: 'House Robber — Non-Adjacent Choice DP',
    brief: 'Maximize stolen loot from vaults [20, 70, 90, 30, 10, 60] without triggering alarms on any two adjacent vaults.',
    goalSummary: 'Tabulate optimal non-adjacent loot -> 170 (20 + 90 + 60)',
    objectiveKind: 'dp-tabulate',
    initialState: buildDPState({
      mode: 'robber',
      rows: 1,
      cols: 6,
      rowLabels: ['max'],
      colLabels: ['20', '70', '90', '30', '10', '60'],
      items: [
        { label: 'V0', weight: 1, value: 20 },
        { label: 'V1', weight: 1, value: 70 },
        { label: 'V2', weight: 1, value: 90 },
        { label: 'V3', weight: 1, value: 30 },
        { label: 'V4', weight: 1, value: 10 },
        { label: 'V5', weight: 1, value: 60 },
      ],
      baseCells: [[0, 0, 20]],
      expectedTable: [[20, 70, 110, 110, 120, 170]],
      optimalPath: [
        [0, 0],
        [0, 2],
        [0, 5],
      ],
      targetAnswer: 170,
      naiveRecursionOps: 64,
    }),
    par: {
      sRankCycles: 5,
      threeStarCycles: 7,
      twoStarCycles: 10,
      maxAuxMemory: 6,
      targetBigO: 'O(n) time / O(n) table',
    },
    pseudocode: [
      'loot = [20, 70, 90, 30, 10, 60]; dp[0] = loot[0]',
      'for i = 1 to 5:',
      '  skip = dp[i - 1]',
      '  take = (i >= 2 ? dp[i - 2] : 0) + loot[i]',
      '  dp[i] = max(skip, take)',
    ],
    starterCode: `// Choose non-adjacent vaults from [20, 70, 90, 30, 10, 60] to maximize total loot.
const loot = [20, 70, 90, 30, 10, 60];

for (let i = 1; i < api.cols; i++) {
  // TODO: compare skip = dp[i-1] vs take = (i >= 2 ? dp[i-2] : 0) + loot[i]
}
api.traceOptimal();
`,
    referenceSolution: `const loot = [20, 70, 90, 30, 10, 60];

for (let i = 1; i < api.cols; i++) {
  const skip = api.get(0, i - 1);
  const take = (i >= 2 ? api.get(0, i - 2) : 0) + loot[i];
  const deps = i >= 2 ? [[0, i - 1], [0, i - 2]] : [[0, i - 1]];
  api.set(0, i, Math.max(skip, take), deps);
}
api.traceOptimal();
`,
    hints: [
      'At vault i you face a binary choice: skip it (keep dp[i - 1]) or rob it (add loot[i] to dp[i - 2]).',
      'Always store Math.max(skip, take) so each cell records the best possible haul up to that vault.',
      'Fill [20, 70, 110, 110, 120, 170] across columns 1..5, then call api.traceOptimal() to highlight vaults 20, 90, and 60.',
    ],
    insight:
      'State transition dp[i] = max(dp[i - 1], dp[i - 2] + loot[i]) encodes the non-adjacency constraint directly into the recurrence—beating greedy heuristics that miss 20 + 90 + 60 = 170.',
    bigOIntuition:
      'Checking all valid subsets takes O(2^n) time; dynamic programming compresses the decision tree into O(n) transitions.',
  },
  {
    id: 'dp-3',
    code: '6.3',
    worldId: 'dp',
    order: 3,
    title: 'Minimal Change',
    concept: 'Coin Change — Unbounded Min-Transition DP',
    brief: 'Find the minimum number of coins from [1, 3, 4] needed to forge every amount 0..7, proving why greedy (4+1+1+1=4) loses to DP (3+4=2).',
    goalSummary: 'Tabulate min coins for 0..7 -> 2 coins for amount 7 (3 + 4)',
    objectiveKind: 'dp-tabulate',
    initialState: buildDPState({
      mode: 'coin-change',
      rows: 1,
      cols: 8,
      rowLabels: ['min'],
      colLabels: ['0', '1', '2', '3', '4', '5', '6', '7'],
      coins: [1, 3, 4],
      baseCells: [[0, 0, 0]],
      expectedTable: [[0, 1, 2, 1, 1, 2, 2, 2]],
      optimalPath: [
        [0, 0],
        [0, 3],
        [0, 7],
      ],
      targetAnswer: 2,
      naiveRecursionOps: 89,
    }),
    par: {
      sRankCycles: 7,
      threeStarCycles: 9,
      twoStarCycles: 12,
      maxAuxMemory: 8,
      targetBigO: 'O(amount * coins)',
    },
    pseudocode: [
      'coins = [1, 3, 4]; dp[0] = 0',
      'for amt = 1 to 7:',
      '  dp[amt] = min(dp[amt - c] + 1 for c in coins if amt >= c)',
      'traceOptimal()  // dp[7] = 2 (coins 3 + 4)',
    ],
    starterCode: `// Compute the minimum coins from [1, 3, 4] to make each amount 1..7.
const coins = [1, 3, 4];

for (let amt = 1; amt < api.cols; amt++) {
  let best = Infinity;
  // TODO: test each coin c <= amt and take min(dp[amt - c] + 1)
}
api.traceOptimal();
`,
    referenceSolution: `const coins = [1, 3, 4];

for (let amt = 1; amt < api.cols; amt++) {
  let best = Infinity;
  const deps = [];
  for (const c of coins) {
    if (amt >= c) {
      deps.push([0, amt - c]);
      const cand = api.get(0, amt - c) + 1;
      if (cand < best) best = cand;
    }
  }
  api.set(0, amt, best, deps);
}
api.traceOptimal();
`,
    hints: [
      'Greedy fails on coins [1, 3, 4] for amount 6 (4+1+1=3 instead of 3+3=2), so check every coin option.',
      'For each amount amt, look back at dp[amt - 1], dp[amt - 3], and dp[amt - 4] (when in bounds) and add 1.',
      'Fill [0, 1, 2, 1, 1, 2, 2, 2] across amounts 1..7 so dp[7] = min(dp[6], dp[4], dp[3]) + 1 = 2.',
    ],
    insight:
      'Unbounded Coin Change evaluates every valid last-coin transition dp[amt - c] + 1, guaranteeing global optimality even on non-canonical coin systems where greedy fails.',
    bigOIntuition:
      'Evaluating k coins per amount from 1..A takes O(A * k) time instead of branching exponentially O(k^A).',
  },
  {
    id: 'dp-4',
    code: '6.4',
    worldId: 'dp',
    order: 4,
    title: 'Grid Conduit',
    concept: '2D Unique Paths with Obstacles',
    brief: 'Count every valid right/down route across the 4x4 circuit matrix around blocked relays (1,1) and (2,2) to reach (3,3).',
    goalSummary: 'Tabulate 2D grid paths to (3,3) -> 4 unique routes',
    objectiveKind: 'dp-tabulate',
    initialState: buildDPState({
      mode: 'grid-paths',
      rows: 4,
      cols: 4,
      rowLabels: ['r0', 'r1', 'r2', 'r3'],
      colLabels: ['c0', 'c1', 'c2', 'c3'],
      baseCells: [[0, 0, 1]],
      blockedCells: [
        [1, 1],
        [2, 2],
      ],
      expectedTable: [
        [1, 1, 1, 1],
        [1, null, 1, 2],
        [1, 1, null, 2],
        [1, 2, 2, 4],
      ],
      optimalPath: [
        [0, 0],
        [0, 1],
        [0, 2],
        [1, 2],
        [1, 3],
        [2, 3],
        [3, 3],
      ],
      targetAnswer: 4,
      naiveRecursionOps: 28,
    }),
    par: {
      sRankCycles: 13,
      threeStarCycles: 16,
      twoStarCycles: 22,
      maxAuxMemory: 14,
      targetBigO: 'O(r * c) grid DP',
    },
    pseudocode: [
      'dp[0][0] = 1',
      'for r = 0 to 3, c = 0 to 3:',
      '  if (r, c) is blocked or (0, 0): continue',
      '  dp[r][c] = (dp[r-1][c] || 0) + (dp[r][c-1] || 0)',
      'traceOptimal()  // dp[3][3] = 4',
    ],
    starterCode: `// Count unique right/down paths from (0,0) to (3,3), skipping blocked cells (1,1) and (2,2).
for (let r = 0; r < api.rows; r++) {
  for (let c = 0; c < api.cols; c++) {
    if ((r === 0 && c === 0) || (r === 1 && c === 1) || (r === 2 && c === 2)) continue;
    // TODO: sum top (r-1, c) and left (r, c-1) cells using api.get() or api.computeCell(r, c)
  }
}
api.traceOptimal();
`,
    referenceSolution: `for (let r = 0; r < api.rows; r++) {
  for (let c = 0; c < api.cols; c++) {
    if ((r === 0 && c === 0) || (r === 1 && c === 1) || (r === 2 && c === 2)) continue;
    api.computeCell(r, c);
  }
}
api.traceOptimal();
`,
    hints: [
      'Because movement is restricted to right and down, every cell depends only on its top (r-1, c) and left (r, c-1) neighbors.',
      'Blocked cells (1,1) and (2,2) contribute 0 paths to any cell below or to their right.',
      'Sweep row-by-row calling api.computeCell(r, c) (or clicking ready tiles) to reach dp[3][3] = 4.',
    ],
    insight:
      '2D grid DP turns combinatorial path counting into simple neighbor addition: each open tile sums incoming flows from top and left while obstacles zero out blocked edges.',
    bigOIntuition:
      'Each grid tile is evaluated once in topological row-major order, taking O(R * C) time instead of enumerating exponential paths.',
  },
  {
    id: 'dp-5',
    code: '6.5',
    worldId: 'dp',
    order: 5,
    title: '0/1 Cargo Knapsack',
    concept: '0/1 Knapsack — Capacity vs. Value Matrix',
    brief: 'Pack cargo cores A(w:2,v:12), B(w:3,v:18), and C(w:4,v:22) into a 5-unit bay to maximize total payload value.',
    goalSummary: 'Tabulate 4x6 knapsack matrix -> max value 30 at cap 5 (A + B)',
    objectiveKind: 'dp-tabulate',
    initialState: buildDPState({
      mode: 'knapsack',
      rows: 4,
      cols: 6,
      rowLabels: ['0 items', 'A(w2,v12)', 'B(w3,v18)', 'C(w4,v22)'],
      colLabels: ['cap 0', 'cap 1', 'cap 2', 'cap 3', 'cap 4', 'cap 5'],
      items: [
        { label: 'Core A', weight: 2, value: 12 },
        { label: 'Core B', weight: 3, value: 18 },
        { label: 'Core C', weight: 4, value: 22 },
      ],
      baseCells: [
        [0, 0, 0],
        [0, 1, 0],
        [0, 2, 0],
        [0, 3, 0],
        [0, 4, 0],
        [0, 5, 0],
        [1, 0, 0],
        [2, 0, 0],
        [3, 0, 0],
      ],
      expectedTable: [
        [0, 0, 0, 0, 0, 0],
        [0, 0, 12, 12, 12, 12],
        [0, 0, 12, 18, 18, 30],
        [0, 0, 12, 18, 22, 30],
      ],
      optimalPath: [
        [0, 0],
        [1, 2],
        [2, 5],
        [3, 5],
      ],
      targetAnswer: 30,
      naiveRecursionOps: 32,
    }),
    par: {
      sRankCycles: 15,
      threeStarCycles: 19,
      twoStarCycles: 26,
      maxAuxMemory: 24,
      targetBigO: 'O(n * W) knapsack',
    },
    pseudocode: [
      'for i = 1 to 3 (item with weight w, value v):',
      '  for cap = 1 to 5:',
      '    skip = dp[i - 1][cap]',
      '    take = cap >= w ? dp[i - 1][cap - w] + v : -inf',
      '    dp[i][cap] = max(skip, take)',
    ],
    starterCode: `// Fill the 0/1 Knapsack table for items A(w:2,v:12), B(w:3,v:18), C(w:4,v:22) across capacities 1..5.
const items = [
  { w: 2, v: 12 },
  { w: 3, v: 18 },
  { w: 4, v: 22 },
];

for (let i = 1; i < api.rows; i++) {
  const { w, v } = items[i - 1];
  for (let cap = 1; cap < api.cols; cap++) {
    // TODO: dp[i][cap] = max(dp[i-1][cap], cap >= w ? dp[i-1][cap-w] + v : 0)
  }
}
api.traceOptimal();
`,
    referenceSolution: `const items = [
  { w: 2, v: 12 },
  { w: 3, v: 18 },
  { w: 4, v: 22 },
];

for (let i = 1; i < api.rows; i++) {
  const { w, v } = items[i - 1];
  for (let cap = 1; cap < api.cols; cap++) {
    const skip = api.get(i - 1, cap);
    if (cap >= w) {
      const take = api.get(i - 1, cap - w) + v;
      api.set(i, cap, Math.max(skip, take), [[i - 1, cap], [i - 1, cap - w]]);
    } else {
      api.set(i, cap, skip, [[i - 1, cap]]);
    }
  }
}
api.traceOptimal();
`,
    hints: [
      'Row i considers only the first i items; column cap tracks remaining cargo bay capacity.',
      'If an item fits (cap >= w), compare skipping it (dp[i-1][cap]) against packing it (dp[i-1][cap - w] + v).',
      'Core A (w2,v12) + Core B (w3,v18) fills capacity 5 with value 30, beating Core C (w4,v22).',
    ],
    insight:
      '0/1 Knapsack expands state into (item prefix, remaining capacity), allowing each include/exclude choice to look up the exact optimal remainder in O(1).',
    bigOIntuition:
      'Tabulating n items against integer capacity W runs in pseudo-polynomial O(n * W) time instead of O(2^n) subset search.',
  },
  {
    id: 'dp-6',
    code: '6.6',
    worldId: 'dp',
    order: 6,
    title: 'Signal Alignment',
    concept: 'Longest Common Subsequence (LCS)',
    brief: 'Align signal streams "AXIM" and "AIMX" in a 5x5 DP matrix to extract their longest common subsequence ("AIM", length 3).',
    goalSummary: 'Tabulate LCS("AXIM", "AIMX") -> length 3 ("AIM")',
    objectiveKind: 'dp-tabulate',
    initialState: buildDPState({
      mode: 'lcs',
      rows: 5,
      cols: 5,
      rowLabels: ['∅', 'A', 'X', 'I', 'M'],
      colLabels: ['∅', 'A', 'I', 'M', 'X'],
      strA: 'AXIM',
      strB: 'AIMX',
      baseCells: [
        [0, 0, 0],
        [0, 1, 0],
        [0, 2, 0],
        [0, 3, 0],
        [0, 4, 0],
        [1, 0, 0],
        [2, 0, 0],
        [3, 0, 0],
        [4, 0, 0],
      ],
      expectedTable: [
        [0, 0, 0, 0, 0],
        [0, 1, 1, 1, 1],
        [0, 1, 1, 1, 2],
        [0, 1, 2, 2, 2],
        [0, 1, 2, 3, 3],
      ],
      optimalPath: [
        [0, 0],
        [1, 1],
        [2, 1],
        [3, 2],
        [4, 3],
        [4, 4],
      ],
      targetAnswer: 3,
      naiveRecursionOps: 70,
    }),
    par: {
      sRankCycles: 16,
      threeStarCycles: 20,
      twoStarCycles: 28,
      maxAuxMemory: 25,
      targetBigO: 'O(m * n) LCS',
    },
    pseudocode: [
      'A = "AXIM"; B = "AIMX"',
      'for r = 1 to 4, c = 1 to 4:',
      '  if A[r - 1] == B[c - 1]: dp[r][c] = dp[r - 1][c - 1] + 1',
      '  else: dp[r][c] = max(dp[r - 1][c], dp[r][c - 1])',
      'traceOptimal()  // LCS = "AIM" (length 3)',
    ],
    starterCode: `// Compute the Longest Common Subsequence matrix for "AXIM" vs "AIMX".
const A = 'AXIM';
const B = 'AIMX';

for (let r = 1; r < api.rows; r++) {
  for (let c = 1; c < api.cols; c++) {
    // TODO: diagonal + 1 on match, else max(top, left)
  }
}
api.traceOptimal();
`,
    referenceSolution: `const A = 'AXIM';
const B = 'AIMX';

for (let r = 1; r < api.rows; r++) {
  for (let c = 1; c < api.cols; c++) {
    if (A[r - 1] === B[c - 1]) {
      api.set(r, c, api.get(r - 1, c - 1) + 1, [[r - 1, c - 1]]);
    } else {
      const top = api.get(r - 1, c);
      const left = api.get(r, c - 1);
      api.set(r, c, Math.max(top, left), [[r - 1, c], [r, c - 1]]);
    }
  }
}
api.traceOptimal();
`,
    hints: [
      'Each cell dp[r][c] stores the LCS length between prefix A[0..r-1] and prefix B[0..c-1].',
      'When characters match (A[r-1] === B[c-1]), extend the diagonal subproblem: dp[r-1][c-1] + 1.',
      'When characters differ, take Math.max(dp[r-1][c], dp[r][c-1])—yielding dp[4][4] = 3 ("AIM").',
    ],
    insight:
      'LCS powers git diff, DNA sequence alignment, and merge tools: matching characters step diagonally (+1) while mismatches inherit the better of dropping either character.',
    bigOIntuition:
      'Comparing two strings of lengths m and n fills an (m+1) x (n+1) matrix in O(m * n) time instead of O(2^(m+n)) subsequence enumeration.',
  },
];
