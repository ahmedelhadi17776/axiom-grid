import { createEmptyMetrics, evaluateScore } from '../scorer';
import type {
  HashBucket,
  HashEntry,
  HashResolutionStrategy,
  HashTableWorldState,
  LevelDefinition,
  ScoreReport,
  SimEvent,
  SimMetrics,
} from '../types';

export function cloneHashTableState(state: HashTableWorldState): HashTableWorldState {
  return {
    world: 'hash-table',
    mode: state.mode,
    strategy: state.strategy,
    capacity: state.capacity,
    buckets: state.buckets.map((bucket) => ({
      index: bucket.index,
      entry: bucket.entry ? { ...bucket.entry } : null,
      tombstone: bucket.tombstone,
      chain: bucket.chain.map((entry) => ({ ...entry })),
      state: bucket.state,
    })),
    pendingKeys: state.pendingKeys.map((item) => ({
      key: item.key,
      value: item.value,
    })),
    lastHashBeam: state.lastHashBeam
      ? {
          ...state.lastHashBeam,
          probePath: [...state.lastHashBeam.probePath],
        }
      : state.lastHashBeam,
    searchTarget: state.searchTarget,
    foundBucket: state.foundBucket,
    twoSumTarget: state.twoSumTarget,
    twoSumArray: state.twoSumArray ? [...state.twoSumArray] : undefined,
    foundPair: state.foundPair ? [state.foundPair[0], state.foundPair[1]] : state.foundPair,
    loadFactorThreshold: state.loadFactorThreshold,
    rehashCount: state.rehashCount,
    collisions: state.collisions,
  };
}

function countLiveEntries(state: HashTableWorldState): number {
  let count = 0;
  for (const bucket of state.buckets) {
    if (bucket.entry !== null) {
      count += 1;
    }
    count += bucket.chain.length;
  }
  return count;
}

export function computeLoadFactor(state: HashTableWorldState): number {
  return countLiveEntries(state) / Math.max(1, state.capacity);
}

export interface HashTableSession {
  readonly capacity: number;
  readonly strategy: HashResolutionStrategy;
  loadFactor(): number;
  pendingKeys(): Array<{ key: number; value: string }>;
  hash(key: number): number;
  setStrategy(strategy: HashResolutionStrategy): void;
  insert(key: number, value?: string): number;
  insertAtBucket(bucketIndex: number): boolean;
  lookup(key: number): number;
  remove(key: number, useTombstone?: boolean): boolean;
  rehash(newCapacity?: number): void;
  markPair(a: number, b: number): boolean;
  getState(): HashTableWorldState;
  getEvents(): SimEvent<HashTableWorldState>[];
  getMetrics(): SimMetrics;
}

function createEmptyBuckets(capacity: number): HashBucket[] {
  return Array.from({ length: capacity }, (_, index) => ({
    index,
    entry: null,
    tombstone: false,
    chain: [],
    state: 'idle',
  }));
}

function hasDistinctPairInArray(arr: number[], a: number, b: number): boolean {
  const idxA = arr.indexOf(a);
  if (idxA === -1) return false;
  for (let i = 0; i < arr.length; i++) {
    if (i !== idxA && arr[i] === b) {
      return true;
    }
  }
  return false;
}

export function createHashTableSession(
  initialState: HashTableWorldState
): HashTableSession {
  const state = cloneHashTableState(initialState);
  const events: SimEvent<HashTableWorldState>[] = [];
  const metrics = createEmptyMetrics();
  let nextEventId = 1;

  const computeHash = (key: number, cap = state.capacity): number => {
    const safeCap = Math.max(1, cap);
    return ((Math.trunc(key) % safeCap) + safeCap) % safeCap;
  };

  const normalizeBucketPitch = (bucketIdx: number): number => {
    if (state.capacity <= 1) return 0.5;
    return Math.max(0.15, Math.min(0.95, 0.2 + (bucketIdx / (state.capacity - 1)) * 0.7));
  };

  const clearTransientStates = (): void => {
    for (const bucket of state.buckets) {
      if (bucket.tombstone && bucket.entry === null) {
        bucket.state = 'tombstone';
      } else if (bucket.state !== 'idle') {
        bucket.state = 'idle';
      }
      if (bucket.entry) {
        bucket.entry.state = 'idle';
      }
      for (const entry of bucket.chain) {
        entry.state = 'idle';
      }
    }
  };

  const pushEvent = (
    type: SimEvent<HashTableWorldState>['type'],
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
      snapshot: cloneHashTableState(state),
    });
  };

  const popMatchingPendingKey = (key: number): void => {
    if (state.pendingKeys.length > 0 && state.pendingKeys[0].key === key) {
      state.pendingKeys.shift();
    }
  };

  const computeExtraChainNodes = (): number => {
    let extra = 0;
    for (const bucket of state.buckets) {
      if (bucket.chain.length > 1) {
        extra += bucket.chain.length - 1;
      }
    }
    return extra;
  };

  const predictInsertBucket = (key: number): number => {
    const h = computeHash(key);
    if (state.strategy === 'chaining') {
      return h;
    }

    let firstTombstoneIdx: number | null = null;
    for (let step = 0; step < state.capacity; step++) {
      const idx = (h + step) % state.capacity;
      const bucket = state.buckets[idx];
      if (bucket.entry !== null && bucket.entry.key === key) {
        return idx;
      }
      if (bucket.entry === null && bucket.tombstone) {
        if (firstTombstoneIdx === null) {
          firstTombstoneIdx = idx;
        }
        continue;
      }
      if (bucket.entry === null && !bucket.tombstone) {
        return firstTombstoneIdx !== null ? firstTombstoneIdx : idx;
      }
    }

    return firstTombstoneIdx !== null ? firstTombstoneIdx : -1;
  };

  const insertKey = (key: number, value?: string): number => {
    clearTransientStates();
    const h = computeHash(key);
    const resolvedValue =
      value ??
      (state.pendingKeys.length > 0 && state.pendingKeys[0].key === key
        ? state.pendingKeys[0].value
        : String(key));

    if (state.strategy === 'chaining') {
      const bucket = state.buckets[h];
      const existingIdx = bucket.chain.findIndex((entry) => entry.key === key);

      if (existingIdx !== -1) {
        bucket.chain[existingIdx].value = resolvedValue;
        bucket.chain[existingIdx].state = 'active';
        bucket.state = 'active';
        state.lastHashBeam = {
          key,
          targetBucket: h,
          landedBucket: h,
          probePath: [h],
          collided: false,
        };
        popMatchingPendingKey(key);
        metrics.cycles += 1;
        const auxMem = state.capacity + computeExtraChainNodes();
        metrics.auxMemory = Math.max(metrics.auxMemory, auxMem);
        pushEvent(
          'INSERT_NODE',
          `Updated key ${key} in bucket [${h}] chain`,
          2,
          [`bucket-${h}`],
          { cycles: 1, auxMemory: metrics.auxMemory },
          normalizeBucketPitch(h)
        );
        return h;
      }

      const willCollide = bucket.chain.length > 0;
      if (willCollide) {
        state.collisions += 1;
        bucket.state = 'collision';
        state.lastHashBeam = {
          key,
          targetBucket: h,
          landedBucket: h,
          probePath: [h],
          collided: true,
        };
        pushEvent(
          'COLLISION',
          `Collision at bucket [${h}] (chain length ${bucket.chain.length}) — appending key ${key}`,
          1,
          [`bucket-${h}`],
          {},
          0.25
        );
      }

      bucket.chain.push({
        key,
        value: resolvedValue,
        originalBucket: h,
        state: 'active',
      });
      bucket.state = 'active';
      state.lastHashBeam = {
        key,
        targetBucket: h,
        landedBucket: h,
        probePath: [h],
        collided: bucket.chain.length > 1,
      };
      popMatchingPendingKey(key);
      metrics.cycles += 1;
      const auxMem = state.capacity + computeExtraChainNodes();
      metrics.auxMemory = Math.max(metrics.auxMemory, auxMem);

      pushEvent(
        'INSERT_NODE',
        `Inserted key ${key} into bucket [${h}] chain (depth ${bucket.chain.length})`,
        2,
        [`bucket-${h}`],
        { cycles: 1, auxMemory: metrics.auxMemory },
        normalizeBucketPitch(h)
      );
      return h;
    }

    // Linear probing mode
    const probePath: number[] = [];
    let firstTombstoneIdx: number | null = null;
    let collided = false;

    for (let step = 0; step < state.capacity; step++) {
      const idx = (h + step) % state.capacity;
      probePath.push(idx);
      const bucket = state.buckets[idx];

      if (bucket.entry !== null && bucket.entry.key === key) {
        bucket.entry.value = resolvedValue;
        bucket.entry.state = 'active';
        bucket.state = 'active';
        state.lastHashBeam = {
          key,
          targetBucket: h,
          landedBucket: idx,
          probePath,
          collided,
        };
        popMatchingPendingKey(key);
        metrics.cycles += 1;
        pushEvent(
          'INSERT_NODE',
          `Updated key ${key} at bucket [${idx}]`,
          3,
          [`bucket-${idx}`],
          { cycles: 1 },
          normalizeBucketPitch(idx)
        );
        return idx;
      }

      if (bucket.entry === null && bucket.tombstone) {
        if (firstTombstoneIdx === null) {
          firstTombstoneIdx = idx;
        }
        metrics.cycles += 1;
        bucket.state = 'probing';
        pushEvent(
          'HASH_PROBE',
          `Probed tombstone at [${idx}] — remembering slot while checking for duplicates`,
          2,
          [`bucket-${idx}`],
          { cycles: 1 },
          0.45
        );
        bucket.state = 'tombstone';
        continue;
      }

      if (bucket.entry === null && !bucket.tombstone) {
        const targetIdx = firstTombstoneIdx !== null ? firstTombstoneIdx : idx;
        const targetBucket = state.buckets[targetIdx];
        targetBucket.entry = {
          key,
          value: resolvedValue,
          originalBucket: h,
          state: 'active',
        };
        targetBucket.tombstone = false;
        targetBucket.state = 'active';
        state.lastHashBeam = {
          key,
          targetBucket: h,
          landedBucket: targetIdx,
          probePath,
          collided,
        };
        popMatchingPendingKey(key);
        metrics.cycles += 1;
        pushEvent(
          'INSERT_NODE',
          `Inserted key ${key} at bucket [${targetIdx}]${collided ? ` (probed from [${h}])` : ''}`,
          3,
          [`bucket-${targetIdx}`],
          { cycles: 1 },
          normalizeBucketPitch(targetIdx)
        );
        return targetIdx;
      }

      // Occupied by a different key -> collision
      collided = true;
      state.collisions += 1;
      metrics.cycles += 1;
      bucket.state = 'collision';
      if (bucket.entry) {
        bucket.entry.state = 'collision';
      }
      pushEvent(
        'COLLISION',
        `Collision at [${idx}] (occupied by ${bucket.entry?.key}) — linear probing next slot`,
        2,
        [`bucket-${idx}`],
        { cycles: 1 },
        0.25
      );
      bucket.state = 'idle';
      if (bucket.entry) {
        bucket.entry.state = 'idle';
      }
    }

    if (firstTombstoneIdx !== null) {
      const targetBucket = state.buckets[firstTombstoneIdx];
      targetBucket.entry = {
        key,
        value: resolvedValue,
        originalBucket: h,
        state: 'active',
      };
      targetBucket.tombstone = false;
      targetBucket.state = 'active';
      state.lastHashBeam = {
        key,
        targetBucket: h,
        landedBucket: firstTombstoneIdx,
        probePath,
        collided,
      };
      popMatchingPendingKey(key);
      metrics.cycles += 1;
      pushEvent(
        'INSERT_NODE',
        `Reused tombstone [${firstTombstoneIdx}] for key ${key}`,
        3,
        [`bucket-${firstTombstoneIdx}`],
        { cycles: 1 },
        normalizeBucketPitch(firstTombstoneIdx)
      );
      return firstTombstoneIdx;
    }

    metrics.overflows += 1;
    metrics.cycles += 1;
    state.lastHashBeam = {
      key,
      targetBucket: h,
      landedBucket: -1,
      probePath,
      collided: true,
    };
    pushEvent(
      'OVERFLOW',
      `Hash table full (capacity ${state.capacity}) — cannot insert key ${key}; rehash required`,
      -1,
      [],
      { cycles: 1, overflows: 1 },
      0.1
    );
    return -1;
  };

  return {
    get capacity(): number {
      return state.capacity;
    },

    get strategy(): HashResolutionStrategy {
      return state.strategy;
    },

    loadFactor(): number {
      return computeLoadFactor(state);
    },

    pendingKeys(): Array<{ key: number; value: string }> {
      return state.pendingKeys.map((item) => ({
        key: item.key,
        value: item.value,
      }));
    },

    hash(key: number): number {
      return computeHash(key);
    },

    setStrategy(strategy: HashResolutionStrategy): void {
      state.strategy = strategy;
      pushEvent(
        'WRITE',
        `Set collision resolution strategy to '${strategy}'`,
        0,
        [],
        {},
        0.5
      );
    },

    insert(key: number, value?: string): number {
      return insertKey(key, value);
    },

    insertAtBucket(bucketIndex: number): boolean {
      if (state.pendingKeys.length === 0) {
        return false;
      }
      if (
        !Number.isInteger(bucketIndex) ||
        bucketIndex < 0 ||
        bucketIndex >= state.capacity
      ) {
        return false;
      }

      const next = state.pendingKeys[0];
      const h = computeHash(next.key);
      const expectedBucket = predictInsertBucket(next.key);

      if (expectedBucket === -1) {
        insertKey(next.key, next.value);
        return false;
      }

      if (bucketIndex === expectedBucket) {
        const landed = insertKey(next.key, next.value);
        return landed >= 0;
      }

      clearTransientStates();
      metrics.cycles += 1;
      state.buckets[bucketIndex].state = 'collision';
      pushEvent(
        'COLLISION',
        `Key ${next.key} hashes to [${h}] -> expected bucket [${expectedBucket}], not [${bucketIndex}]`,
        1,
        [`bucket-${bucketIndex}`],
        { cycles: 1 },
        0.2
      );
      return false;
    },

    lookup(key: number): number {
      clearTransientStates();
      state.foundBucket = null;
      const h = computeHash(key);

      if (state.strategy === 'chaining') {
        const bucket = state.buckets[h];
        metrics.cycles += 1;
        const foundEntry = bucket.chain.find((entry) => entry.key === key);
        if (foundEntry) {
          bucket.state = 'found';
          foundEntry.state = 'found';
          state.foundBucket = h;
          state.lastHashBeam = {
            key,
            targetBucket: h,
            landedBucket: h,
            probePath: [h],
            collided: bucket.chain.length > 1,
          };
          pushEvent(
            'HASH_PROBE',
            `Found key ${key} in bucket [${h}] chain`,
            2,
            [`bucket-${h}`],
            { cycles: 1 },
            0.9
          );
          return h;
        }

        bucket.state = 'probing';
        state.lastHashBeam = {
          key,
          targetBucket: h,
          landedBucket: -1,
          probePath: [h],
          collided: false,
        };
        pushEvent(
          'HASH_PROBE',
          `Key ${key} not found in bucket [${h}] chain`,
          2,
          [`bucket-${h}`],
          { cycles: 1 },
          0.3
        );
        return -1;
      }

      const probePath: number[] = [];
      for (let step = 0; step < state.capacity; step++) {
        const idx = (h + step) % state.capacity;
        probePath.push(idx);
        const bucket = state.buckets[idx];
        metrics.cycles += 1;

        if (bucket.entry !== null && bucket.entry.key === key) {
          bucket.state = 'found';
          bucket.entry.state = 'found';
          state.foundBucket = idx;
          state.lastHashBeam = {
            key,
            targetBucket: h,
            landedBucket: idx,
            probePath,
            collided: step > 0,
          };
          pushEvent(
            'HASH_PROBE',
            `Found key ${key} at bucket [${idx}] (${step + 1} probe${step === 0 ? '' : 's'})`,
            3,
            [`bucket-${idx}`],
            { cycles: 1 },
            0.9
          );
          return idx;
        }

        if (bucket.entry === null && !bucket.tombstone) {
          bucket.state = 'probing';
          state.lastHashBeam = {
            key,
            targetBucket: h,
            landedBucket: -1,
            probePath,
            collided: step > 0,
          };
          pushEvent(
            'HASH_PROBE',
            `Stopped at empty bucket [${idx}] — key ${key} not found`,
            2,
            [`bucket-${idx}`],
            { cycles: 1 },
            0.25
          );
          return -1;
        }

        if (bucket.entry === null && bucket.tombstone) {
          bucket.state = 'probing';
          pushEvent(
            'HASH_PROBE',
            `Passed tombstone at [${idx}] — continuing linear probe for key ${key}`,
            2,
            [`bucket-${idx}`],
            { cycles: 1 },
            0.45
          );
          bucket.state = 'tombstone';
          continue;
        }

        bucket.state = 'probing';
        pushEvent(
          'HASH_PROBE',
          `Probed [${idx}] (key ${bucket.entry?.key} != ${key}) — advancing`,
          2,
          [`bucket-${idx}`],
          { cycles: 1 },
          0.4
        );
        bucket.state = 'idle';
      }

      state.lastHashBeam = {
        key,
        targetBucket: h,
        landedBucket: -1,
        probePath,
        collided: true,
      };
      pushEvent(
        'HASH_PROBE',
        `Completed full table probe — key ${key} not found`,
        2,
        [],
        {},
        0.2
      );
      return -1;
    },

    remove(key: number, useTombstone = true): boolean {
      clearTransientStates();
      const h = computeHash(key);

      if (state.strategy === 'chaining') {
        const bucket = state.buckets[h];
        const idx = bucket.chain.findIndex((entry) => entry.key === key);
        metrics.cycles += 1;

        if (idx === -1) {
          pushEvent(
            'HASH_PROBE',
            `Key ${key} not found in bucket [${h}] chain`,
            1,
            [`bucket-${h}`],
            { cycles: 1 },
            0.25
          );
          return false;
        }

        bucket.chain.splice(idx, 1);
        bucket.state = 'active';
        pushEvent(
          'DELETE_NODE',
          `Removed key ${key} from bucket [${h}] chain`,
          2,
          [`bucket-${h}`],
          { cycles: 1 },
          0.5
        );
        return true;
      }

      for (let step = 0; step < state.capacity; step++) {
        const idx = (h + step) % state.capacity;
        const bucket = state.buckets[idx];
        metrics.cycles += 1;

        if (bucket.entry !== null && bucket.entry.key === key) {
          bucket.entry = null;
          if (useTombstone) {
            bucket.tombstone = true;
            bucket.state = 'tombstone';
            pushEvent(
              'TOMBSTONE',
              `Removed key ${key} at [${idx}] and placed TOMBSTONE marker`,
              2,
              [`bucket-${idx}`],
              { cycles: 1 },
              0.55
            );
          } else {
            bucket.tombstone = false;
            bucket.state = 'idle';
            pushEvent(
              'DELETE_NODE',
              `Naively cleared key ${key} at [${idx}] without tombstone (breaks linear probe chains!)`,
              2,
              [`bucket-${idx}`],
              { cycles: 1 },
              0.25
            );
          }
          return true;
        }

        if (bucket.entry === null && !bucket.tombstone) {
          pushEvent(
            'HASH_PROBE',
            `Key ${key} not found — stopped at empty bucket [${idx}]`,
            1,
            [`bucket-${idx}`],
            { cycles: 1 },
            0.25
          );
          return false;
        }
      }

      return false;
    },

    rehash(newCapacity?: number): void {
      clearTransientStates();
      const targetCapacity = Math.max(
        1,
        Math.trunc(newCapacity ?? state.capacity * 2)
      );

      const liveEntries: HashEntry[] = [];
      for (const bucket of state.buckets) {
        if (bucket.entry !== null) {
          liveEntries.push({ ...bucket.entry });
        }
        for (const entry of bucket.chain) {
          liveEntries.push({ ...entry });
        }
      }

      state.capacity = targetCapacity;
      state.buckets = createEmptyBuckets(targetCapacity);
      state.foundBucket = null;
      state.lastHashBeam = null;

      for (const item of liveEntries) {
        const h = computeHash(item.key, targetCapacity);
        const rehashedEntry: HashEntry = {
          key: item.key,
          value: item.value,
          originalBucket: h,
          state: 'rehashed',
        };

        if (state.strategy === 'chaining') {
          state.buckets[h].chain.push(rehashedEntry);
        } else {
          for (let step = 0; step < targetCapacity; step++) {
            const idx = (h + step) % targetCapacity;
            if (state.buckets[idx].entry === null) {
              state.buckets[idx].entry = rehashedEntry;
              break;
            }
          }
        }
      }

      state.rehashCount += 1;
      metrics.cycles += liveEntries.length;
      metrics.auxMemory = Math.max(metrics.auxMemory, targetCapacity);

      pushEvent(
        'REHASH',
        `Rehashed table to capacity ${targetCapacity} (${liveEntries.length} live entries migrated, tombstones purged)`,
        3,
        state.buckets.map((b) => `bucket-${b.index}`),
        { cycles: liveEntries.length, auxMemory: targetCapacity },
        0.8
      );
    },

    markPair(a: number, b: number): boolean {
      const target = state.twoSumTarget;
      const arr = state.twoSumArray;
      const valid =
        target !== undefined &&
        arr !== undefined &&
        a + b === target &&
        hasDistinctPairInArray(arr, a, b);

      if (valid) {
        state.foundPair = [a, b];
        pushEvent(
          'SUCCESS',
          `Found Two-Sum pair (${a}, ${b}) = ${target}!`,
          4,
          [],
          {},
          1.0
        );
        return true;
      }

      metrics.cycles += 1;
      pushEvent(
        'FAIL',
        `Pair (${a}, ${b}) does not sum to target ${target ?? '?'} from distinct array entries`,
        -1,
        [],
        { cycles: 1 },
        0.15
      );
      return false;
    },

    getState(): HashTableWorldState {
      return cloneHashTableState(state);
    },

    getEvents(): SimEvent<HashTableWorldState>[] {
      return events;
    },

    getMetrics(): SimMetrics {
      return { ...metrics };
    },
  };
}

function collectPresentKeys(state: HashTableWorldState): Set<number> {
  const keys = new Set<number>();
  for (const bucket of state.buckets) {
    if (bucket.entry !== null) {
      keys.add(bucket.entry.key);
    }
    for (const entry of bucket.chain) {
      keys.add(entry.key);
    }
  }
  return keys;
}

function collectExpectedKeys(
  level: LevelDefinition<HashTableWorldState>
): number[] {
  if (Array.isArray(level.meta?.expectedKeys)) {
    return (level.meta.expectedKeys as unknown[]).filter(
      (k): k is number => typeof k === 'number'
    );
  }
  const keys = new Set<number>();
  for (const bucket of level.initialState.buckets) {
    if (bucket.entry !== null) {
      keys.add(bucket.entry.key);
    }
    for (const entry of bucket.chain) {
      keys.add(entry.key);
    }
  }
  for (const pending of level.initialState.pendingKeys) {
    keys.add(pending.key);
  }
  return Array.from(keys);
}

function bucketContainsKey(bucket: HashBucket, key: number): boolean {
  if (bucket.entry !== null && bucket.entry.key === key) {
    return true;
  }
  return bucket.chain.some((entry) => entry.key === key);
}

export function evaluateHashTableLevel(
  level: LevelDefinition<HashTableWorldState>,
  state: HashTableWorldState,
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
      `Thermal cycle budget exceeded (${metrics.cycles} / ${level.maxCyclesBudget} cycles).`
    );
  }

  if (level.strictNoOverflows && metrics.overflows > 0) {
    return evaluateScore(
      false,
      metrics,
      level.par,
      level.insight,
      `Hash table overflowed (${metrics.overflows} time${metrics.overflows === 1 ? '' : 's'}).`
    );
  }

  const kind = level.objectiveKind ?? 'hash-insert-all';
  const presentKeys = collectPresentKeys(state);

  switch (kind) {
    case 'hash-insert-all': {
      if (state.pendingKeys.length > 0) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `${state.pendingKeys.length} pending key${state.pendingKeys.length === 1 ? '' : 's'} remaining to insert.`
        );
      }

      const expectedKeys = collectExpectedKeys(level);
      const missing = expectedKeys.filter((k) => !presentKeys.has(k));
      if (missing.length > 0) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Missing expected key${missing.length === 1 ? '' : 's'} in hash table: [${missing.join(', ')}].`
        );
      }

      const maxLoadFactor =
        typeof level.meta?.maxLoadFactor === 'number'
          ? level.meta.maxLoadFactor
          : undefined;
      if (maxLoadFactor !== undefined) {
        const lf = computeLoadFactor(state);
        if (lf > maxLoadFactor + 1e-9) {
          return evaluateScore(
            false,
            metrics,
            level.par,
            level.insight,
            `Load factor ${lf.toFixed(2)} exceeds maximum allowed ${maxLoadFactor.toFixed(2)}.`
          );
        }
      }

      const minRehashes =
        typeof level.meta?.minRehashes === 'number'
          ? level.meta.minRehashes
          : undefined;
      if (minRehashes !== undefined && state.rehashCount < minRehashes) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Expected at least ${minRehashes} rehash${minRehashes === 1 ? '' : 'es'}, got ${state.rehashCount}.`
        );
      }

      return evaluateScore(true, metrics, level.par, level.insight);
    }

    case 'hash-tombstone-lookup': {
      const deleteKey =
        typeof level.meta?.deleteKey === 'number'
          ? level.meta.deleteKey
          : undefined;

      if (deleteKey !== undefined) {
        if (presentKeys.has(deleteKey)) {
          return evaluateScore(
            false,
            metrics,
            level.par,
            level.insight,
            `Target key ${deleteKey} must be removed with a tombstone before probing.`
          );
        }
        const hasTombstone = state.buckets.some(
          (bucket) => bucket.tombstone === true
        );
        if (state.strategy === 'linear' && !hasTombstone) {
          return evaluateScore(
            false,
            metrics,
            level.par,
            level.insight,
            `Key ${deleteKey} was deleted without leaving a tombstone marker — linear probe chains break without tombstones!`
          );
        }
      }

      const searchTarget = state.searchTarget ?? level.initialState.searchTarget;
      const foundIdx = state.foundBucket;
      if (
        foundIdx === null ||
        foundIdx === undefined ||
        foundIdx < 0 ||
        foundIdx >= state.buckets.length ||
        (searchTarget !== undefined &&
          !bucketContainsKey(state.buckets[foundIdx], searchTarget))
      ) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Lookup target ${searchTarget ?? '?'} has not been found yet. Probe past the tombstone!`
        );
      }

      return evaluateScore(true, metrics, level.par, level.insight);
    }

    case 'hash-rehash': {
      const minRehashes =
        typeof level.meta?.minRehashes === 'number'
          ? level.meta.minRehashes
          : 1;
      if (state.rehashCount < minRehashes) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Table must be rehashed at least ${minRehashes} time${minRehashes === 1 ? '' : 's'} (rehashCount = ${state.rehashCount}).`
        );
      }

      if (state.pendingKeys.length > 0) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `${state.pendingKeys.length} pending key${state.pendingKeys.length === 1 ? '' : 's'} remaining to insert.`
        );
      }

      const expectedKeys = collectExpectedKeys(level);
      const missing = expectedKeys.filter((k) => !presentKeys.has(k));
      if (missing.length > 0) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `All live keys must be preserved after rehash; missing: [${missing.join(', ')}].`
        );
      }

      const lf = computeLoadFactor(state);
      if (lf > state.loadFactorThreshold + 1e-9) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Load factor ${lf.toFixed(2)} still exceeds threshold ${state.loadFactorThreshold.toFixed(2)} — rehash to a larger capacity!`
        );
      }

      return evaluateScore(true, metrics, level.par, level.insight);
    }

    case 'hash-two-sum': {
      const target = state.twoSumTarget ?? level.initialState.twoSumTarget;
      const arr = state.twoSumArray ?? level.initialState.twoSumArray ?? [];
      const pair = state.foundPair;

      if (!pair) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `No Two-Sum pair marked yet. Use markPair(a, b) once you locate two entries summing to ${target ?? '?'}.`
        );
      }

      const [a, b] = pair;
      if (target === undefined || a + b !== target) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Marked pair (${a}, ${b}) sums to ${a + b}, expected ${target ?? '?'}.`
        );
      }

      if (!hasDistinctPairInArray(arr, a, b)) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `Marked pair (${a}, ${b}) does not correspond to two distinct elements in the input array.`
        );
      }

      return evaluateScore(true, metrics, level.par, level.insight);
    }

    default: {
      if (state.pendingKeys.length > 0) {
        return evaluateScore(
          false,
          metrics,
          level.par,
          level.insight,
          `${state.pendingKeys.length} pending keys remaining.`
        );
      }
      return evaluateScore(true, metrics, level.par, level.insight);
    }
  }
}
