import type {
  HashBucket,
  HashEntry,
  HashResolutionStrategy,
  HashTableMode,
  HashTableWorldState,
  LevelDefinition,
} from '../engine/types';

function buildHashTableState(opts: {
  mode: HashTableMode;
  strategy: HashResolutionStrategy;
  capacity: number;
  entries?: Array<{ bucketIndex: number; entry: HashEntry }>;
  pendingKeys?: Array<{ key: number; value: string }>;
  searchTarget?: number;
  twoSumTarget?: number;
  twoSumArray?: number[];
  loadFactorThreshold?: number;
}): HashTableWorldState {
  const buckets: HashBucket[] = Array.from({ length: opts.capacity }, (_, index) => ({
    index,
    entry: null,
    tombstone: false,
    chain: [],
    state: 'idle',
  }));

  if (opts.entries) {
    for (const item of opts.entries) {
      const bucket = buckets[item.bucketIndex];
      if (!bucket) continue;
      if (opts.strategy === 'chaining') {
        bucket.chain.push({ ...item.entry });
      } else {
        bucket.entry = { ...item.entry };
      }
    }
  }

  return {
    world: 'hash-table',
    mode: opts.mode,
    strategy: opts.strategy,
    capacity: opts.capacity,
    buckets,
    pendingKeys: opts.pendingKeys
      ? opts.pendingKeys.map((p) => ({ key: p.key, value: p.value }))
      : [],
    lastHashBeam: null,
    searchTarget: opts.searchTarget,
    foundBucket: null,
    twoSumTarget: opts.twoSumTarget,
    twoSumArray: opts.twoSumArray ? [...opts.twoSumArray] : undefined,
    foundPair: null,
    loadFactorThreshold: opts.loadFactorThreshold ?? 0.75,
    rehashCount: 0,
    collisions: 0,
  };
}

export const HASH_TABLE_LEVELS: LevelDefinition<HashTableWorldState>[] = [
  {
    id: 'hash-table-1',
    code: '7.1',
    worldId: 'hash-table',
    order: 1,
    title: 'Modulo Prism',
    concept: 'O(1) Direct Hashing — h(k) = k mod M',
    brief:
      'Route 4 incoming keys directly into their exact vault buckets using modulo hashing with zero collisions.',
    goalSummary: 'Insert all 4 keys into buckets h(k) = k % 7',
    objectiveKind: 'hash-insert-all',
    initialState: buildHashTableState({
      mode: 'direct',
      strategy: 'linear',
      capacity: 7,
      pendingKeys: [
        { key: 10, value: 'A' },
        { key: 15, value: 'B' },
        { key: 20, value: 'C' },
        { key: 28, value: 'D' },
      ],
    }),
    par: {
      sRankCycles: 4,
      threeStarCycles: 5,
      twoStarCycles: 7,
      maxAuxMemory: 0,
      targetBigO: 'O(1) per insert',
    },
    pseudocode: [
      'for (key, value) in pendingKeys():',
      '  bucket = hash(key)  // key % capacity',
      '  insert(key, value)  // direct O(1) slot write',
    ],
    starterCode: `// Route every pending key to bucket h(k) = k % 7!
// API: api.pendingKeys(), api.hash(key), api.insert(key, value)
for (const item of api.pendingKeys()) {
  const bucket = api.hash(item.key);
  // TODO: insert item into the hash table
}
`,
    referenceSolution: `for (const item of api.pendingKeys()) {
  api.insert(item.key, item.value);
}
`,
    hints: [
      'Compute each bucket index with key % 7: 10 % 7 = 3, 15 % 7 = 1, 20 % 7 = 6, 28 % 7 = 0.',
      'Click the matching vault bay in 3D or call api.insert(item.key, item.value) for each queued key.',
      'Because all four remainders are distinct, every key lands in O(1) time with zero collisions.',
    ],
    insight:
      'A hash function converts a key directly into an array index—bypassing O(n) scans and O(log n) tree hops for O(1) direct addressing.',
    bigOIntuition:
      'Computing k % M takes constant arithmetic regardless of how many items live in the table.',
  },
  {
    id: 'hash-table-2',
    code: '7.2',
    worldId: 'hash-table',
    order: 2,
    title: 'Linear Probe',
    concept: 'Open Addressing — Linear Probing & Primary Clustering',
    brief:
      'Buckets [2] and [3] are occupied. Resolve cascading hash collisions for keys 16, 23, and 30 by probing (h + step) % 7.',
    goalSummary: 'Resolve all 3 collisions via linear probing into [4], [5], [6]',
    objectiveKind: 'hash-insert-all',
    initialState: buildHashTableState({
      mode: 'linear-probe',
      strategy: 'linear',
      capacity: 7,
      entries: [
        { bucketIndex: 2, entry: { key: 9, value: 'P1', originalBucket: 2 } },
        { bucketIndex: 3, entry: { key: 10, value: 'P2', originalBucket: 3 } },
      ],
      pendingKeys: [
        { key: 16, value: 'X' },
        { key: 23, value: 'Y' },
        { key: 30, value: 'Z' },
      ],
    }),
    par: {
      sRankCycles: 12,
      threeStarCycles: 14,
      twoStarCycles: 18,
      maxAuxMemory: 0,
      targetBigO: 'O(1) avg / O(n) cluster',
    },
    pseudocode: [
      'for (key, value) in pendingKeys():',
      '  h = hash(key)',
      '  step forward (h + 1, h + 2, ...) until empty bucket',
      '  insert(key, value)  // observe primary clustering!',
    ],
    starterCode: `// Keys 16, 23, 30 all hash to bucket 2 (mod 7)!
// Linear probing scans forward: 2 -> 3 -> 4 -> 5 -> 6.
for (const item of api.pendingKeys()) {
  // TODO: insert each colliding key and watch the cluster grow
}
`,
    referenceSolution: `for (const item of api.pendingKeys()) {
  api.insert(item.key, item.value);
}
`,
    hints: [
      '16 % 7 = 2, 23 % 7 = 2, and 30 % 7 = 2—all three collide with keys 9 and 10 at buckets [2] and [3].',
      'Linear probing steps +1 slot at a time: 16 lands at [4], 23 lands at [5], and 30 lands at [6].',
      'Notice how each insertion makes the contiguous block longer—this is called Primary Clustering.',
    ],
    insight:
      'Open addressing stores colliding keys inside the table itself using zero extra pointers, but linear probing creates contiguous clusters that slow down subsequent probes.',
    bigOIntuition:
      'Each new key hashing into a cluster of length k must step past all k occupied slots before finding an open bay.',
  },
  {
    id: 'hash-table-3',
    code: '7.3',
    worldId: 'hash-table',
    order: 3,
    title: 'Tombstone Protocol',
    concept: 'Safe Deletion in Open Addressing',
    brief:
      'Keys 9, 16, and 23 all hashed to bucket [2]. Delete key 16 WITH a tombstone marker, then look up key 23 without breaking the probe chain.',
    goalSummary: 'Remove key 16 with tombstone & locate key 23',
    objectiveKind: 'hash-tombstone-lookup',
    meta: { deleteKey: 16 },
    initialState: buildHashTableState({
      mode: 'tombstone',
      strategy: 'linear',
      capacity: 7,
      searchTarget: 23,
      entries: [
        { bucketIndex: 2, entry: { key: 9, value: 'A', originalBucket: 2 } },
        { bucketIndex: 3, entry: { key: 16, value: 'B', originalBucket: 2 } },
        { bucketIndex: 4, entry: { key: 23, value: 'C', originalBucket: 2 } },
      ],
    }),
    par: {
      sRankCycles: 5,
      threeStarCycles: 6,
      twoStarCycles: 9,
      maxAuxMemory: 0,
      targetBigO: 'O(1) probe past [DEL]',
    },
    pseudocode: [
      'remove(16, useTombstone = true)  // leave [DEL] marker at [3]',
      'lookup(23):',
      '  probe [2] (9 != 23) -> [3] ([DEL], keep going!) -> [4] (23 == 23!)',
    ],
    starterCode: `// Deleting 16 naively (useTombstone = false) leaves an empty hole at [3],
// which makes lookup(23) stop early and falsely report "not found"!
// API: api.remove(key, useTombstone), api.lookup(key)

// TODO: remove key 16 WITH a tombstone, then lookup key 23
`,
    referenceSolution: `api.remove(16, true);
api.lookup(23);
`,
    hints: [
      'Linear probe lookup stops at the first truly empty bucket. If bucket [3] becomes empty, lookup(23) halts before reaching [4].',
      'Call api.remove(16, true) to replace bucket [3] with a [DEL] tombstone marker instead of an empty bay.',
      'Then call api.lookup(23)—the probe beam skips right over the tombstone at [3] and locks onto key 23 at [4].',
    ],
    insight:
      'In open addressing, deletion cannot simply empty a slot—a Tombstone marker tells lookups "keep probing" while letting future insertions reuse the bay.',
    bigOIntuition:
      'Too many accumulated tombstones still lengthen probe chains until a Rehash sweeps them all away.',
  },
  {
    id: 'hash-table-4',
    code: '7.4',
    worldId: 'hash-table',
    order: 4,
    title: 'Chained Buckets',
    concept: 'Separate Chaining Collision Resolution',
    brief:
      'Insert 5 heavily colliding keys (mod 5) using Separate Chaining—stacking linked pods per bucket with zero cross-bucket clustering.',
    goalSummary: 'Chain all 5 keys cleanly into buckets [1] and [2]',
    objectiveKind: 'hash-insert-all',
    initialState: buildHashTableState({
      mode: 'chaining',
      strategy: 'chaining',
      capacity: 5,
      pendingKeys: [
        { key: 6, value: 'A' },
        { key: 11, value: 'B' },
        { key: 16, value: 'C' },
        { key: 7, value: 'D' },
        { key: 12, value: 'E' },
      ],
    }),
    par: {
      sRankCycles: 5,
      threeStarCycles: 7,
      twoStarCycles: 10,
      maxAuxMemory: 8,
      targetBigO: 'O(1 + α) per op',
    },
    pseudocode: [
      'for (key, value) in pendingKeys():',
      '  h = hash(key)  // key % 5',
      '  append (key, value) to buckets[h].chain',
    ],
    starterCode: `// Separate Chaining keeps every key at its exact home bucket h(k) = k % 5!
// Keys 6, 11, 16 share bucket [1]; keys 7, 12 share bucket [2].
for (const item of api.pendingKeys()) {
  // TODO: insert each item into its chained bucket
}
`,
    referenceSolution: `for (const item of api.pendingKeys()) {
  api.insert(item.key, item.value);
}
`,
    hints: [
      'Compute k % 5: keys 6, 11, 16 all map to bucket [1], while keys 7 and 12 map to bucket [2].',
      'With Separate Chaining, collisions append linked pods directly to their home bucket instead of spilling into neighbors.',
      'Insert every item in api.pendingKeys()—bucket [1] grows to depth 3 and bucket [2] to depth 2.',
    ],
    insight:
      'Separate chaining isolates collisions inside per-bucket linked lists, eliminating primary clustering and allowing load factors above 1.0 at the cost of extra node memory.',
    bigOIntuition:
      'Expected lookup time is O(1 + α), where α = n / M is the average chain length per bucket.',
  },
  {
    id: 'hash-table-5',
    code: '7.5',
    worldId: 'hash-table',
    order: 5,
    title: 'Rehash Expansion',
    concept: 'Load Factor α & Amortized O(1) Resizing',
    brief:
      'The 5-bay vault is at 60% load and 2 more keys would push α to 100%. Trigger a 2x Rehash (5 → 10) and insert all keys while keeping α ≤ 0.70.',
    goalSummary: 'Rehash 5 → 10 bays & insert all keys with load ≤ 70%',
    objectiveKind: 'hash-rehash',
    initialState: buildHashTableState({
      mode: 'rehash',
      strategy: 'linear',
      capacity: 5,
      loadFactorThreshold: 0.7,
      entries: [
        { bucketIndex: 1, entry: { key: 6, value: 'A', originalBucket: 1 } },
        { bucketIndex: 2, entry: { key: 7, value: 'B', originalBucket: 2 } },
        { bucketIndex: 3, entry: { key: 8, value: 'C', originalBucket: 3 } },
      ],
      pendingKeys: [
        { key: 14, value: 'D' },
        { key: 21, value: 'E' },
      ],
    }),
    par: {
      sRankCycles: 6,
      threeStarCycles: 8,
      twoStarCycles: 12,
      maxAuxMemory: 10,
      targetBigO: 'Amortized O(1) insert',
    },
    pseudocode: [
      'if (liveKeys + pending) / capacity > 0.70:',
      '  rehash(capacity * 2)  // recompute h(k) = k % 10 for all keys',
      'for (key, value) in pendingKeys():',
      '  insert(key, value)',
    ],
    starterCode: `// Adding 2 keys to a 5-bay vault with 3 entries pushes load factor to 1.00 (> 0.70)!
// API: api.loadFactor(), api.rehash(newCapacity?), api.pendingKeys(), api.insert(k, v)

// TODO: double capacity via api.rehash() and insert the remaining keys
`,
    referenceSolution: `api.rehash();
for (const item of api.pendingKeys()) {
  api.insert(item.key, item.value);
}
`,
    hints: [
      'With 3 occupied bays out of 5 (α = 0.60), inserting 14 and 21 would push α to 1.00—above the 0.70 threshold.',
      'Call api.rehash() to double capacity from 5 to 10 and migrate keys 6, 7, 8 to their new mod-10 buckets.',
      'Then insert 14 (→ [4]) and 21 (→ [1]) so all 5 keys live comfortably at 50% load.',
    ],
    insight:
      'Doubling table capacity when load factor α crosses ~0.70 costs O(n) once, but spreads out to Amortized O(1) per insertion over the lifetime of the table.',
    bigOIntuition:
      'Because capacity doubles geometrically (5 → 10 → 20 → 40), total migration work across n inserts sums to less than 2n—keeping every insert O(1) amortized.',
  },
  {
    id: 'hash-table-6',
    code: '7.6',
    worldId: 'hash-table',
    order: 6,
    title: 'Complement Pair',
    concept: 'Two-Sum in O(n) via Hash Lookup',
    brief:
      'Scan [14, 27, 8, 35, 19, 42] in a single O(n) pass to find two numbers summing to 54 by hashing seen values and probing complements.',
    goalSummary: 'Find pair summing to 54 in O(n) & call markPair(35, 19)',
    objectiveKind: 'hash-two-sum',
    maxCyclesBudget: 24,
    initialState: buildHashTableState({
      mode: 'two-sum',
      strategy: 'linear',
      capacity: 11,
      twoSumArray: [14, 27, 8, 35, 19, 42],
      twoSumTarget: 54,
    }),
    par: {
      sRankCycles: 12,
      threeStarCycles: 14,
      twoStarCycles: 18,
      maxAuxMemory: 11,
      targetBigO: 'O(n) time, O(n) space',
    },
    pseudocode: [
      'for num in [14, 27, 8, 35, 19, 42]:',
      '  complement = 54 - num',
      '  if lookup(complement) != -1:',
      '    markPair(complement, num); break',
      '  insert(num)',
    ],
    starterCode: `// Find two distinct numbers in nums that sum to target = 54 in O(n) time!
// API: api.lookup(key), api.insert(key, value), api.markPair(a, b)
const nums = [14, 27, 8, 35, 19, 42];
const target = 54;

for (const num of nums) {
  const complement = target - num;
  // TODO: if complement is already in the hash table, call api.markPair(complement, num) and break;
  // otherwise insert num into the hash table!
}
`,
    referenceSolution: `const nums = [14, 27, 8, 35, 19, 42];
const target = 54;

for (const num of nums) {
  const complement = target - num;
  if (api.lookup(complement) !== -1) {
    api.markPair(complement, num);
    break;
  }
  api.insert(num, String(num));
}
`,
    hints: [
      'A brute-force nested loop checks all O(n²) pairs. Instead, remember each visited number in the hash table.',
      'For each num, compute complement = 54 - num and call api.lookup(complement) in O(1) time.',
      'When you reach 19, its complement 35 is already hashed—call api.markPair(35, 19) and break!',
    ],
    insight:
      'Trading O(n) space for a hash table collapses Two-Sum from O(n²) pairwise comparisons down to a single O(n) linear pass.',
    bigOIntuition:
      'Each element is inserted once and looked up once: n × O(1) = O(n) total time.',
  },
];
