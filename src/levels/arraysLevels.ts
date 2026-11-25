import type { ArraysWorldState, LevelDefinition } from '../engine/types';

function makeSlots(
  values: number[],
  corruptZero = false,
): ArraysWorldState['slots'] {
  return values.map((value, idx) => ({
    id: `slot-${idx}`,
    value,
    state: corruptZero && value === 0 ? 'corrupted' : 'idle',
  }));
}

export const ARRAYS_LEVELS: LevelDefinition<ArraysWorldState>[] = [
  {
    id: 'arrays-1',
    code: '1.1',
    worldId: 'arrays',
    order: 1,
    title: 'Contiguous Index',
    concept: 'O(1) Indexing & Minimal Swaps',
    brief: 'Reorder the 5 memory blocks into ascending order using direct O(1) swaps.',
    goalSummary: 'Sort all blocks ascending: [17, 25, 42, 68, 91]',
    objectiveKind: 'sort-ascending',
    initialState: {
      world: 'arrays',
      slots: makeSlots([42, 17, 68, 25, 91]),
      pointers: { i: 0 },
      targetValues: [17, 25, 42, 68, 91],
    },
    par: {
      sRankCycles: 18,
      threeStarCycles: 24,
      twoStarCycles: 34,
      maxAuxMemory: 0,
      targetBigO: 'O(n) swaps',
    },
    pseudocode: [
      'for i = 0 to n - 2:',
      '  minIdx = i',
      '  for j = i + 1 to n - 1:',
      '    if A[j] < A[minIdx]: minIdx = j',
      '  if minIdx != i: swap(A[i], A[minIdx])',
      '  markSorted(i)',
    ],
    starterCode: `// Sort the array in ascending order using minimal swaps.
// API: api.length, api.get(i), api.compare(i, j), api.swap(i, j), api.setPointer(name, i), api.markSorted(i)

for (let i = 0; i < api.length - 1; i++) {
  let minIdx = i;
  for (let j = i + 1; j < api.length; j++) {
    if (api.compare(j, minIdx) < 0) {
      minIdx = j;
    }
  }
  if (minIdx !== i) {
    api.swap(i, minIdx);
  }
  api.markSorted(i);
}
api.markSorted(api.length - 1);
`,
    referenceSolution: `for (let i = 0; i < api.length - 1; i++) {
  api.setPointer('i', i);
  let minIdx = i;
  for (let j = i + 1; j < api.length; j++) {
    if (api.compare(j, minIdx) < 0) {
      minIdx = j;
    }
  }
  if (minIdx !== i) {
    api.swap(i, minIdx);
  }
  api.markSorted(i);
}
api.markSorted(api.length - 1);
`,
    hints: [
      'Selection sort places one final element per pass, minimizing expensive swaps.',
      'For each index i, scan indices i + 1..n - 1 to find the smallest remaining block.',
      'Swap slot i with minIdx only if minIdx !== i, then lock slot i as sorted.',
    ],
    insight:
      'Contiguous memory lets you jump to any index in O(1) time. Selection-style swapping minimizes expensive memory writes to at most n - 1 swaps.',
    bigOIntuition:
      'Because array slots sit side by side in RAM, computing baseAddress + i * stride takes constant O(1) time regardless of array length.',
  },
  {
    id: 'arrays-2',
    code: '1.2',
    worldId: 'arrays',
    order: 2,
    title: 'Dual-Pointer Mirror',
    concept: 'Two-Pointer In-Place Reversal',
    brief: 'Converge left and right pointers inward to mirror the bus in-place with zero auxiliary memory.',
    goalSummary: 'Reverse in-place: [84, 70, 56, 42, 28, 14] (0 aux slots)',
    objectiveKind: 'reverse-in-place',
    initialState: {
      world: 'arrays',
      slots: makeSlots([14, 28, 42, 56, 70, 84]),
      pointers: { left: 0, right: 5 },
      targetValues: [84, 70, 56, 42, 28, 14],
    },
    par: {
      sRankCycles: 10,
      threeStarCycles: 14,
      twoStarCycles: 20,
      maxAuxMemory: 0,
      targetBigO: 'O(n) time / O(1) space',
    },
    pseudocode: [
      'left = 0, right = n - 1',
      'while left < right:',
      '  swap(A[left], A[right])',
      '  left = left + 1',
      '  right = right - 1',
    ],
    starterCode: `// Reverse the array in-place using two converging pointers.
let left = 0;
let right = api.length - 1;

while (left < right) {
  api.setPointer('left', left);
  api.setPointer('right', right);
  // TODO: swap left and right, then move inward
  break;
}
`,
    referenceSolution: `let left = 0;
let right = api.length - 1;

while (left < right) {
  api.setPointer('left', left);
  api.setPointer('right', right);
  api.swap(left, right);
  left++;
  right--;
}
`,
    hints: [
      'Symmetric elements at opposite ends simply trade places—no extra array needed.',
      'Pair index 0 with 5, index 1 with 4, and index 2 with 3 as pointers converge.',
      'Inside the while (left < right) loop, call api.swap(left, right), then left++ and right--.',
    ],
    insight:
      'Converging two pointers from opposite ends reverses n elements in exactly n/2 swaps using O(1) extra space—no second array needed.',
    bigOIntuition:
      'Allocating a reversed copy costs O(n) memory. Swapping symmetric pairs in-place drops space complexity from O(n) down to O(1).',
  },
  {
    id: 'arrays-3',
    code: '1.3',
    worldId: 'arrays',
    order: 3,
    title: 'Zero-Compaction',
    concept: 'Fast / Slow Read-Write Partition',
    brief: 'Compact all corrupted 0-blocks to the right end while preserving the exact order of active packets.',
    goalSummary: 'Compact zeros right: [34, 18, 52, 0, 0, 0] (preserve order)',
    objectiveKind: 'move-zeros-end',
    initialState: {
      world: 'arrays',
      slots: makeSlots([0, 34, 0, 18, 52, 0], true),
      pointers: { read: 0, write: 0 },
      targetValues: [34, 18, 52, 0, 0, 0],
    },
    par: {
      sRankCycles: 18,
      threeStarCycles: 24,
      twoStarCycles: 32,
      maxAuxMemory: 0,
      targetBigO: 'O(n) time / O(1) space',
    },
    pseudocode: [
      'write = 0',
      'for read = 0 to n - 1:',
      '  if A[read] != 0:',
      '    if read != write: swap(A[write], A[read])',
      '    write = write + 1',
    ],
    starterCode: `// Move all 0 blocks to the right while preserving the relative order of non-zero blocks.
let write = 0;

for (let read = 0; read < api.length; read++) {
  api.setPointer('read', read);
  // TODO: if api.get(read) !== 0, swap with write and advance write
}
`,
    referenceSolution: `let write = 0;

for (let read = 0; read < api.length; read++) {
  api.setPointer('read', read);
  if (api.get(read) !== 0) {
    if (read !== write) {
      api.swap(write, read);
    }
    write++;
    api.setPointer('write', write);
  }
}
`,
    hints: [
      'Use a fast read pointer to scout non-zero blocks and a slow write pointer for the next clean slot.',
      'Whenever read finds a non-zero block, move it forward into slot write so order stays intact.',
      'Check if (api.get(read) !== 0): swap(write, read) when read !== write, then increment write.',
    ],
    insight:
      'A fast read-pointer scouts ahead while a slow write-pointer guards the compacted frontier—achieving stable in-place partitioning in one O(n) pass.',
    bigOIntuition:
      'Shifting elements left on every zero would take O(n^2) work. Tracking the next write slot reduces the entire compaction to linear O(n) time.',
  },
  {
    id: 'arrays-4',
    code: '1.4',
    worldId: 'arrays',
    order: 4,
    title: 'Thermal Window',
    concept: 'Sliding Window (k = 3)',
    brief: 'Slide a 3-slot window across the energy rail to lock onto the contiguous slice with maximum sum.',
    goalSummary: 'Lock 3-slot window on maximum energy sum (112 at [2..4])',
    objectiveKind: 'max-sliding-window',
    meta: {
      windowSize: 3,
      expectedRange: [2, 4],
      expectedSum: 112,
    },
    initialState: {
      world: 'arrays',
      slots: makeSlots([12, 22, 38, 46, 28, 18, 14]),
      pointers: { left: 0, right: 2 },
      window: [0, 2],
    },
    par: {
      sRankCycles: 18,
      threeStarCycles: 24,
      twoStarCycles: 32,
      maxAuxMemory: 0,
      targetBigO: 'O(n) sliding window',
    },
    pseudocode: [
      'sum = A[0] + A[1] + A[2]; best = sum; bestStart = 0',
      'markWindow(0, 2)',
      'for right = 3 to n - 1:',
      '  sum = sum + A[right] - A[right - 3]',
      '  markWindow(right - 2, right)',
      '  if sum > best: best = sum; bestStart = right - 2',
      'markWindow(bestStart, bestStart + 2)',
    ],
    starterCode: `// Find the 3-slot contiguous window with the maximum sum.
const k = 3;
let sum = 0;
for (let i = 0; i < k; i++) {
  sum += api.get(i);
}
let bestSum = sum;
let bestStart = 0;
api.markWindow(0, k - 1);

// TODO: slide the window right by adding A[right] and subtracting A[right - k]

api.markWindow(bestStart, bestStart + k - 1);
`,
    referenceSolution: `const k = 3;
let sum = 0;
for (let i = 0; i < k; i++) {
  sum += api.get(i);
}
let bestSum = sum;
let bestStart = 0;
api.markWindow(0, k - 1);

for (let right = k; right < api.length; right++) {
  sum += api.get(right) - api.get(right - k);
  const left = right - k + 1;
  api.markWindow(left, right);
  if (sum > bestSum) {
    bestSum = sum;
    bestStart = left;
  }
}
api.markWindow(bestStart, bestStart + k - 1);
`,
    hints: [
      'Adjacent windows overlap by k - 1 slots—avoid re-summing the whole slice each step.',
      'As right advances by 1, add api.get(right) and subtract api.get(right - k) to update sum in O(1).',
      'Track bestSum and bestStart during the sweep, then call api.markWindow(bestStart, bestStart + 2) at the end.',
    ],
    insight:
      'Instead of re-summing k elements at every position in O(n * k) time, sliding the window adds the entering slot and subtracts the leaving slot in O(1) per step.',
    bigOIntuition:
      'Reusing overlapping work is the core trick of sliding windows: total operations drop from O(n * k) to O(n).',
  },
  {
    id: 'arrays-5',
    code: '1.5',
    worldId: 'arrays',
    order: 5,
    title: 'Binary Halving',
    concept: 'Binary Search — O(log n)',
    brief: 'Locate target key 73 on the sorted 9-slot rail in at most 5 probes by halving the search interval each step.',
    goalSummary: 'Probe & lock target 73 in <= 3 probes for S-Rank (budget: 5)',
    objectiveKind: 'binary-search',
    maxCyclesBudget: 5,
    initialState: {
      world: 'arrays',
      slots: makeSlots([11, 19, 27, 35, 48, 56, 64, 73, 88]),
      pointers: { lo: 0, hi: 8 },
      searchTarget: 73,
      probedIndices: [],
      foundIndex: null,
    },
    par: {
      sRankCycles: 3,
      threeStarCycles: 4,
      twoStarCycles: 5,
      maxAuxMemory: 0,
      targetBigO: 'O(log n) probes',
    },
    pseudocode: [
      'lo = 0, hi = n - 1',
      'while lo <= hi:',
      '  mid = floor((lo + hi) / 2)',
      '  cmp = probe(mid)',
      '  if cmp == 0: break',
      '  if cmp < 0: lo = mid + 1 else hi = mid - 1',
    ],
    starterCode: `// Locate target key 73 in O(log n) probes using api.probe(index).
// api.probe(mid) returns -1 if A[mid] < target, +1 if A[mid] > target, and 0 on a match.
let lo = 0;
let hi = api.length - 1;

while (lo <= hi) {
  const mid = Math.floor((lo + hi) / 2);
  api.setPointer('lo', lo);
  api.setPointer('hi', hi);
  // TODO: probe(mid) and narrow [lo, hi] based on the sign of cmp
  break;
}
`,
    referenceSolution: `let lo = 0;
let hi = api.length - 1;

while (lo <= hi) {
  const mid = Math.floor((lo + hi) / 2);
  api.setPointer('lo', lo);
  api.setPointer('hi', hi);
  const cmp = api.probe(mid);
  if (cmp === 0) {
    break;
  } else if (cmp < 0) {
    lo = mid + 1;
  } else {
    hi = mid - 1;
  }
}
`,
    hints: [
      'A linear scan from index 0 exceeds the 5-probe thermal budget—exploit the sorted order.',
      'Always probe the midpoint of [lo, hi] to eliminate half of all remaining slots in one cycle.',
      'Probe index 4 (48 < 73 -> search [5..8]), then index 6 (64 < 73 -> search [7..8]), then index 7 (73!).',
    ],
    insight:
      'Every Binary Search probe discards half of the remaining sorted range—finding a key in 9 slots in at most 4 steps, and in 1,000,000 slots in just 20 steps.',
    bigOIntuition:
      'Halving the problem size n -> n/2 -> n/4 -> ... -> 1 takes at most ceil(log2(n)) steps, turning O(n) linear scans into O(log n).',
  },
  {
    id: 'arrays-6',
    code: '1.6',
    worldId: 'arrays',
    order: 6,
    title: 'Tri-Core Partition',
    concept: 'Dutch National Flag (3-Way Partition)',
    brief: 'Partition low (10), mid (50), and high (90) cores in a single O(n) in-place pass using three pointers.',
    goalSummary: '3-way partition: [10, 10, 10, 50, 50, 90, 90] (0 aux slots)',
    objectiveKind: 'dutch-flag-partition',
    initialState: {
      world: 'arrays',
      slots: makeSlots([50, 10, 90, 50, 10, 90, 10]),
      pointers: { low: 0, mid: 0, high: 6 },
      targetValues: [10, 10, 10, 50, 50, 90, 90],
    },
    par: {
      sRankCycles: 12,
      threeStarCycles: 16,
      twoStarCycles: 24,
      maxAuxMemory: 0,
      targetBigO: 'O(n) / O(1) space',
    },
    pseudocode: [
      'low = 0; mid = 0; high = n - 1',
      'while mid <= high:',
      '  if A[mid] == 10: swap(low, mid); low++; mid++',
      '  else if A[mid] == 50: mid++',
      '  else: swap(mid, high); high--',
    ],
    starterCode: `// Partition [50, 10, 90, 50, 10, 90, 10] into [10, 10, 10, 50, 50, 90, 90] in one O(n) pass.
let low = 0;
let mid = 0;
let high = api.length - 1;

while (mid <= high) {
  const val = api.get(mid);
  // TODO: route 10 -> low, keep 50 at mid, and route 90 -> high
  break;
}
`,
    referenceSolution: `let low = 0;
let mid = 0;
let high = api.length - 1;

while (mid <= high) {
  api.setPointer('low', low);
  api.setPointer('mid', mid);
  api.setPointer('high', high);
  const val = api.get(mid);
  if (val === 10) {
    if (low !== mid) api.swap(low, mid);
    low++;
    mid++;
  } else if (val === 50) {
    mid++;
  } else {
    if (mid !== high) api.swap(mid, high);
    high--;
  }
}
`,
    hints: [
      'Maintain three regions: [0..low-1] holds 10s, [low..mid-1] holds 50s, and [high+1..n-1] holds 90s.',
      'Inspect api.get(mid): 10 swaps to low (advance both), 50 simply advances mid, 90 swaps to high.',
      'After swapping a 90 with high, decrement high WITHOUT advancing mid—the newly swapped value still needs inspection!',
    ],
    insight:
      "Dijkstra's Dutch National Flag algorithm partitions three distinct bands in a single O(n) pass with O(1) space—the exact core of 3-way Quicksort for duplicate-heavy data.",
    bigOIntuition:
      'Every iteration either advances mid or retreats high, shrinking the unknown interval [mid..high] by 1 per step for guaranteed O(n) time.',
  },
];
