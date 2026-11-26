import type {
  HeapKind,
  HeapMode,
  HeapNodeSlot,
  HeapWorldState,
  LevelDefinition,
} from '../engine/types';
import { computeHeapViolations } from '../engine/worlds/heapEngine';

function buildHeapState(opts: {
  kind: HeapKind;
  mode: HeapMode;
  values: number[];
  secondaryValues?: number[];
  pendingQueue?: number[];
  targetExtracted?: number[];
  targetMedian?: number;
  maxHeapSize?: number;
  selectedIndex?: number | null;
}): HeapWorldState {
  const items: HeapNodeSlot[] = opts.values.map((value, idx) => ({
    id: `h-${idx + 1}`,
    value,
    state: 'idle',
  }));

  const secondaryItems: HeapNodeSlot[] | undefined = opts.secondaryValues
    ? opts.secondaryValues.map((value, idx) => ({
        id: `h-${items.length + idx + 1}`,
        value,
        state: 'idle',
      }))
    : undefined;

  if (opts.mode === 'median') {
    computeHeapViolations(items, 'max');
    if (secondaryItems) {
      computeHeapViolations(secondaryItems, 'min');
    }
  } else {
    computeHeapViolations(items, opts.kind);
  }

  return {
    world: 'heap',
    kind: opts.kind,
    mode: opts.mode,
    items,
    pendingQueue: opts.pendingQueue ? [...opts.pendingQueue] : [],
    extracted: [],
    secondaryItems,
    targetExtracted: opts.targetExtracted ? [...opts.targetExtracted] : undefined,
    targetMedian: opts.targetMedian,
    maxHeapSize: opts.maxHeapSize,
    selectedIndex: opts.selectedIndex ?? null,
  };
}

export const HEAP_LEVELS: LevelDefinition<HeapWorldState>[] = [
  {
    id: 'heap-1',
    code: '8.1',
    worldId: 'heap',
    order: 1,
    title: 'Bubble Up',
    concept: 'Min-Heap Insert & Sift-Up — O(log n)',
    brief:
      'Dock queued priority keys [8, 18] onto the bottom of the 4-node Min-Heap and sift each upward until every parent is smaller than its children.',
    goalSummary: 'Insert [8, 18] and restore a valid 6-node Min-Heap',
    objectiveKind: 'heap-valid',
    initialState: buildHeapState({
      kind: 'min',
      mode: 'sift-up',
      values: [12, 24, 30, 48],
      pendingQueue: [8, 18],
    }),
    par: {
      sRankCycles: 5,
      threeStarCycles: 6,
      twoStarCycles: 8,
      maxAuxMemory: 0,
      targetBigO: 'O(log n) per insert',
    },
    pseudocode: [
      'while pendingQueue() is not empty:',
      '  idx = pushRaw()              // append to last array slot',
      '  while idx > 0 and heap[idx] < heap[parent(idx)]:',
      '    swap(idx, parent(idx))     // bubble up toward root',
      '    idx = parent(idx)',
    ],
    starterCode: `// Insert all queued keys [8, 18] into the Min-Heap and sift them up!
// API: api.pendingQueue(), api.insert(), api.pushRaw(), api.siftUp(idx)

while (api.pendingQueue().length > 0) {
  // TODO: call api.insert() (or pushRaw() + siftUp(idx))
  break;
}
`,
    referenceSolution: `while (api.pendingQueue().length > 0) {
  api.insert();
}
`,
    hints: [
      'A binary heap stays complete by always appending a new key at the end of the array (index size), then repairing upward.',
      'Key 8 lands at index 4, swaps past parent 24 (index 1), and then swaps past root 12 (index 0) to become the new minimum.',
      'Key 18 lands at index 5 and swaps once with parent 30 (index 2). Call api.insert() inside the while loop to process both cleanly.',
    ],
    insight:
      'Appending at the last slot preserves complete-tree geometry in a flat array, while Sift-Up restores the Min-Heap invariant along a single rootward path of length at most log2(n).',
    bigOIntuition:
      'Because parent(i) = floor((i - 1) / 2) halves the index on every hop, inserting into a heap of n nodes performs at most O(log n) swaps.',
  },
  {
    id: 'heap-2',
    code: '8.2',
    worldId: 'heap',
    order: 2,
    title: 'Crown Extract',
    concept: 'Extract-Min & Sift-Down — O(log n)',
    brief:
      'Pop the 3 highest-priority (smallest) crowns [10, 15, 20] from the root, promoting the last leaf and sifting it down after each extraction.',
    goalSummary: 'Extract [10, 15, 20] in order & keep remaining Min-Heap valid',
    objectiveKind: 'heap-extract',
    initialState: buildHeapState({
      kind: 'min',
      mode: 'extract',
      values: [10, 20, 15, 40, 50, 30],
      targetExtracted: [10, 15, 20],
    }),
    par: {
      sRankCycles: 7,
      threeStarCycles: 8,
      twoStarCycles: 11,
      maxAuxMemory: 0,
      targetBigO: 'O(log n) per extract',
    },
    pseudocode: [
      'repeat 3 times:',
      '  minVal = heap[0]             // capture root crown',
      '  heap[0] = heap.pop()         // move last leaf to root',
      '  siftDown(0)                  // swap with smaller child until valid',
      '  emit(minVal)',
    ],
    starterCode: `// Extract the 3 smallest roots [10, 15, 20] in priority order!
// API: api.extractRoot(), api.peek(), api.size(), api.siftDown(idx)

for (let i = 0; i < 3; i++) {
  // TODO: call api.extractRoot() to pop root & sift down the replacement leaf
}
`,
    referenceSolution: `for (let i = 0; i < 3; i++) {
  api.extractRoot();
}
`,
    hints: [
      'Removing index 0 directly would leave a hole in the array; instead, overwrite the root with the very last leaf so the tree stays complete.',
      'After promoting the last leaf to index 0, repeatedly swap it with its smaller child (left = 2i + 1, right = 2i + 2) until both children are larger.',
      'Call api.extractRoot() three times to emit 10, 15, and 20 while leaving [30, 40, 50] as a valid Min-Heap.',
    ],
    insight:
      'Extract-Min achieves O(log n) priority dispatch by swapping the root with the last leaf in O(1) and sifting down along the smaller-child spine.',
    bigOIntuition:
      'Every sift-down step descends one level of the binary tree, bounding extraction work by the tree height floor(log2 n).',
  },
  {
    id: 'heap-3',
    code: '8.3',
    worldId: 'heap',
    order: 3,
    title: 'Floyd Heapify',
    concept: 'Bottom-Up Build-Heap — O(n)',
    brief:
      'Transform the scrambled 7-node spire [64, 42, 55, 18, 30, 12, 25] into a valid Min-Heap in-place using Floyd’s bottom-up O(n) heapify within the strict cycle budget.',
    goalSummary: 'Build a valid Min-Heap in-place in <= 7 cycles (O(n))',
    objectiveKind: 'heap-valid',
    maxCyclesBudget: 7,
    initialState: buildHeapState({
      kind: 'min',
      mode: 'heapify',
      values: [64, 42, 55, 18, 30, 12, 25],
    }),
    par: {
      sRankCycles: 4,
      threeStarCycles: 5,
      twoStarCycles: 7,
      maxAuxMemory: 0,
      targetBigO: 'O(n) bottom-up',
    },
    pseudocode: [
      '// Leaves [floor(n/2) .. n-1] are already valid 1-node heaps',
      'for i = floor(n / 2) - 1 down to 0:',
      '  siftDown(i)                  // repair subtree rooted at i',
      '// Total swaps bounded by O(n) geometric series!',
    ],
    starterCode: `// Build a valid Min-Heap in-place using bottom-up Floyd Heapify (O(n))!
// API: api.heapify(), api.siftDown(idx), api.size()

// TODO: call api.heapify() or siftDown from floor(size / 2) - 1 down to 0
`,
    referenceSolution: `api.heapify();
`,
    hints: [
      'Over half of a binary heap’s nodes are leaves (indices floor(n/2) to n-1)—they have no children and already satisfy the heap property.',
      'Start at the last internal node index floor(7 / 2) - 1 = 2 and call siftDown(i) going backward: i = 2, 1, 0.',
      'Calling api.heapify() runs Floyd’s exact bottom-up loop and fixes all 7 nodes in just 4 swaps!',
    ],
    insight:
      'Floyd’s bottom-up Heapify beats O(n log n) repeated insertion by sifting most nodes only 0 or 1 levels—converging in strict O(n) linear time.',
    bigOIntuition:
      'Half the nodes are height 0, a quarter height 1, an eighth height 2: sum(h / 2^(h+1)) <= 1, so total sift-down work is O(n) rather than O(n log n).',
  },
  {
    id: 'heap-4',
    code: '8.4',
    worldId: 'heap',
    order: 4,
    title: 'Top-K Filter',
    concept: 'Bounded K-Min-Heap Streaming — O(n log k)',
    brief:
      'Stream all 6 incoming values [24, 85, 12, 63, 47, 91] through a size-3 Min-Heap, evicting the smallest root whenever size exceeds K = 3 to retain only the Top 3 largest.',
    goalSummary: 'Stream all 6 keys & retain Top-3 [63, 85, 91] in a size-3 Min-Heap',
    objectiveKind: 'heap-top-k',
    initialState: buildHeapState({
      kind: 'min',
      mode: 'top-k',
      values: [],
      pendingQueue: [24, 85, 12, 63, 47, 91],
      targetExtracted: [63, 85, 91],
      maxHeapSize: 3,
    }),
    par: {
      sRankCycles: 15,
      threeStarCycles: 17,
      twoStarCycles: 21,
      maxAuxMemory: 0,
      targetBigO: 'O(n log k) time / O(k) space',
    },
    pseudocode: [
      'K = 3',
      'while pendingQueue() is not empty:',
      '  insert()                     // push next stream key into Min-Heap',
      '  if size() > K:',
      '    extractRoot()              // evict smallest key; Top-K survive!',
    ],
    starterCode: `// Keep only the Top K = 3 largest values from [24, 85, 12, 63, 47, 91]!
// API: api.pendingQueue(), api.insert(), api.size(), api.extractRoot()
const K = 3;

while (api.pendingQueue().length > 0) {
  api.insert();
  // TODO: if api.size() exceeds K, evict the smallest root with api.extractRoot()
}
`,
    referenceSolution: `const K = 3;

while (api.pendingQueue().length > 0) {
  api.insert();
  if (api.size() > K) {
    api.extractRoot();
  }
}
`,
    hints: [
      'Why use a Min-Heap to find the Top-K LARGEST elements? Because the root always exposes the weakest member currently in your Top-K set in O(1)!',
      'For every incoming key from pendingQueue(), call api.insert(). Whenever api.size() > 3, immediately call api.extractRoot() to evict the minimum.',
      'After streaming all 6 keys, 12, 24, and 47 are evicted and [63, 85, 91] remain inside the valid size-3 Min-Heap.',
    ],
    insight:
      'A bounded size-K Min-Heap acts as a streaming bouncer: keeping the Kth-largest threshold at the root lets you filter n items in O(n log k) time and O(k) memory.',
    bigOIntuition:
      'Instead of sorting the entire stream in O(n log n) and O(n) memory, capping the heap at K shrinks every operation to O(log k) regardless of stream length.',
  },
  {
    id: 'heap-5',
    code: '8.5',
    worldId: 'heap',
    order: 5,
    title: 'In-Place HeapSort',
    concept: 'Max-Heap Extraction Sort — O(n log n)',
    brief:
      'Heapify the unsorted array [34, 12, 58, 22, 46] into a Max-Heap, then repeatedly extract the maximum crown until all 5 keys are emitted in descending order [58, 46, 34, 22, 12].',
    goalSummary: 'Heapify into Max-Heap & extract sorted [58, 46, 34, 22, 12]',
    objectiveKind: 'heap-sort',
    initialState: buildHeapState({
      kind: 'max',
      mode: 'heapsort',
      values: [34, 12, 58, 22, 46],
      targetExtracted: [58, 46, 34, 22, 12],
    }),
    par: {
      sRankCycles: 11,
      threeStarCycles: 13,
      twoStarCycles: 16,
      maxAuxMemory: 0,
      targetBigO: 'O(n log n) time / O(1) aux',
    },
    pseudocode: [
      'heapify()                      // Phase 1: build Max-Heap in O(n)',
      'while size() > 0:',
      '  extractRoot()                // Phase 2: pop global max in O(log n)',
      '// Result: exact descending sequence with O(1) auxiliary space',
    ],
    starterCode: `// Sort [34, 12, 58, 22, 46] in descending order using Max-Heap HeapSort!
// API: api.heapify(), api.size(), api.extractRoot()

// TODO: Phase 1 — call api.heapify() to build a valid Max-Heap
// TODO: Phase 2 — extractRoot() while api.size() > 0
`,
    referenceSolution: `api.heapify();
while (api.size() > 0) {
  api.extractRoot();
}
`,
    hints: [
      'HeapSort works in two distinct phases: first turn the raw array into a Max-Heap, then drain the root one element at a time.',
      'Call api.heapify() first so the maximum value (58) rises to index 0 in O(n) time.',
      'Loop while (api.size() > 0) and call api.extractRoot() to emit [58, 46, 34, 22, 12] in exact descending order.',
    ],
    insight:
      'HeapSort combines O(n) bottom-up heapify with n O(log n) root extractions to guarantee O(n log n) worst-case sorting with O(1) extra memory—no QuickSort pivot blowups.',
    bigOIntuition:
      'Phase 1 takes O(n) and Phase 2 performs n extractions of O(log n) each, giving a rock-solid O(n log n) upper bound in every input order.',
  },
  {
    id: 'heap-6',
    code: '8.6',
    worldId: 'heap',
    order: 6,
    title: 'Twin Spires',
    concept: 'Running Median via Max-Heap + Min-Heap — O(log n)',
    brief:
      'Feed the stream [40, 10, 30, 50, 20] into paired Max-Heap (lower half) and Min-Heap (upper half) spires so they stay size-balanced and lock the exact running median 30.',
    goalSummary: 'Stream all 5 keys into Twin Spires & lock running median = 30',
    objectiveKind: 'heap-median',
    initialState: buildHeapState({
      kind: 'max',
      mode: 'median',
      values: [],
      secondaryValues: [],
      pendingQueue: [40, 10, 30, 50, 20],
      targetMedian: 30,
    }),
    par: {
      sRankCycles: 9,
      threeStarCycles: 11,
      twoStarCycles: 14,
      maxAuxMemory: 0,
      targetBigO: 'O(log n) insert / O(1) median',
    },
    pseudocode: [
      'while pendingQueue() is not empty:',
      '  val = next key from stream',
      '  insertDual()                 // route <= lower.max to Max-Heap, else Min-Heap',
      '  // auto-rebalance so 0 <= |MaxHeap| - |MinHeap| <= 1',
      '  // median is always MaxHeap.peek() (or avg of both roots)',
    ],
    starterCode: `// Maintain Twin Spires (Max-Heap lower half + Min-Heap upper half) for running median!
// API: api.pendingQueue(), api.insertDual()

while (api.pendingQueue().length > 0) {
  // TODO: call api.insertDual() to route & rebalance each incoming stream key
  break;
}
`,
    referenceSolution: `while (api.pendingQueue().length > 0) {
  api.insertDual();
}
`,
    hints: [
      'A single heap only exposes the min or max—splitting the stream into a Max-Heap (lower half) and Min-Heap (upper half) exposes the exact middle at their roots!',
      'Keeping the two spires within 1 node of equal size ensures that the lower Max-Heap root (or average of both roots) is always the true median.',
      'Call api.insertDual() in the while loop until pendingQueue() is empty; the Twin Spires settle on lower [30, 10, 20] and upper [40, 50] with median 30.',
    ],
    insight:
      'Pairing a Max-Heap for the smaller half with a Min-Heap for the larger half turns live median tracking into O(log n) updates and O(1) queries—zero re-sorting needed.',
    bigOIntuition:
      'Each new value triggers at most one heap insertion and one root transfer across the spires, bounding every stream step to O(log n) time.',
  },
];
