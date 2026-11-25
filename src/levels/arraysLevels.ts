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
    insight:
      'Instead of re-summing k elements at every position in O(n * k) time, sliding the window adds the entering slot and subtracts the leaving slot in O(1) per step.',
    bigOIntuition:
      'Reusing overlapping work is the core trick of sliding windows: total operations drop from O(n * k) to O(n).',
  },
];
