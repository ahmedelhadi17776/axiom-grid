export type WorldId =
  | 'arrays'
  | 'linked-lists'
  | 'stacks-queues'
  | 'pathfinding'
  | 'trees';

export type Rank = 'S' | 'A' | 'B' | 'C';

export type PlaybackSpeed = 0.5 | 1 | 2 | 4;

export interface SimMetrics {
  /** Time complexity proxy: comparisons, swaps, pointer hops, node visits, buffer ops */
  cycles: number;
  /** Space complexity proxy: extra slots, peak stack/queue occupancy, visited/frontier peak */
  auxMemory: number;
  /** Stranded / unreachable nodes (World 2) */
  leaks: number;
  /** Capacity violations (World 3) */
  overflows: number;
}

export type SimEventType =
  | 'INIT'
  | 'COMPARE'
  | 'SWAP'
  | 'MOVE_POINTER'
  | 'WRITE'
  | 'BOUNDS_FAULT'
  | 'LINK'
  | 'UNLINK'
  | 'TRAVERSE'
  | 'CYCLE_DETECTED'
  | 'MEMORY_LEAK'
  | 'NULL_DEREF'
  | 'PUSH'
  | 'POP'
  | 'ENQUEUE'
  | 'DEQUEUE'
  | 'OVERFLOW'
  | 'UNDERFLOW'
  | 'VISIT'
  | 'FRONTIER'
  | 'RELAX_EDGE'
  | 'PATH_FOUND'
  | 'NO_PATH'
  | 'PROBE'
  | 'INSERT_NODE'
  | 'DELETE_NODE'
  | 'ROTATE_LEFT'
  | 'ROTATE_RIGHT'
  | 'INVARIANT_FAULT'
  | 'SUCCESS'
  | 'FAIL';

export interface SimEvent<TState = AnyWorldState> {
  id: number;
  type: SimEventType;
  /** Human-readable telemetry log */
  label: string;
  /** 0-based index syncing live highlight in the Pseudocode Trace panel (-1 if none) */
  pseudocodeLine: number;
  /** Entity IDs for 3D highlight / particle burst */
  targets: string[];
  /** Normalized 0..1 value for procedural Web Audio pitch mapping */
  pitchHint?: number;
  /** Incremental or peak metric update applied at this event */
  metricsDelta: Partial<SimMetrics>;
  /** Immutable deep snapshot for O(1) timeline scrubbing */
  snapshot: TState;
}

export interface ParThresholds {
  sRankCycles: number;
  threeStarCycles: number;
  twoStarCycles: number;
  maxAuxMemory: number;
  /** e.g., "O(n)", "O(1) space", "O((V+E) log V)" */
  targetBigO: string;
}

export interface ScoreReport {
  passed: boolean;
  stars: 0 | 1 | 2 | 3;
  rank: Rank | null;
  metrics: SimMetrics;
  failureReason?: string;
  /** Conceptual DSA takeaway displayed upon level completion */
  insight: string;
}

/* ============================================================================
 * World 1: Arrays (Memory Bus)
 * ========================================================================== */

export type ArraySlotState =
  | 'idle'
  | 'active'
  | 'comparing'
  | 'swapping'
  | 'sorted'
  | 'window'
  | 'corrupted'
  | 'error';

export interface ArraySlot {
  id: string;
  value: number;
  state: ArraySlotState;
  locked?: boolean;
}

export interface ArraysWorldState {
  world: 'arrays';
  slots: ArraySlot[];
  pointers: Record<string, number>;
  /** Inclusive [left, right] sliding window bounds */
  window?: [number, number];
  auxSlots?: number[];
  targetValues?: number[];
  /** Optional Binary Search state */
  searchTarget?: number;
  probedIndices?: number[];
  foundIndex?: number | null;
}

/* ============================================================================
 * World 2: Linked Lists (Tether Matrix)
 * ========================================================================== */

export interface LinkedListNode {
  id: string;
  value: number;
  nextId: string | null;
  pos: [number, number, number];
  corrupted?: boolean;
  leaked?: boolean;
  locked?: boolean;
}

export interface LinkedListWorldState {
  world: 'linked-lists';
  nodes: Record<string, LinkedListNode>;
  headId: string | null;
  cursors: Record<string, string | null>;
  targetSequence?: number[];
  hasCycle?: boolean;
  cycleSevered?: boolean;
}

/* ============================================================================
 * World 3: Stacks & Queues (Pipeline Core)
 * ========================================================================== */

export interface PacketItem {
  id: string;
  value: string;
  color: string;
}

export type BufferKind = 'stack' | 'queue';

export interface PipelineBuffer {
  id: string;
  kind: BufferKind;
  label: string;
  capacity: number;
  items: PacketItem[];
  overflowed?: boolean;
}

export interface StacksQueuesWorldState {
  world: 'stacks-queues';
  inputStream: PacketItem[];
  buffers: Record<string, PipelineBuffer>;
  outputEmitted: PacketItem[];
  targetManifest: string[];
}

/* ============================================================================
 * World 4: Graph Pathfinding (Signal Grid)
 * ========================================================================== */

export type GridCellType = 'open' | 'wall' | 'weighted' | 'start' | 'goal' | 'relay';

export interface GridCell {
  x: number;
  y: number;
  type: GridCellType;
  weight: number;
  visited?: boolean;
  visitedBy?: 'start' | 'goal';
  inFrontier?: boolean;
  inPath?: boolean;
  distance?: number;
}

export type PathfindingAlgorithm =
  | 'bfs'
  | 'dfs'
  | 'dijkstra'
  | 'greedy'
  | 'astar'
  | 'bidirectional';

export interface PathfindingWorldState {
  world: 'pathfinding';
  width: number;
  height: number;
  cells: GridCell[];
  algorithm: PathfindingAlgorithm;
  start: [number, number];
  goal: [number, number];
  editableBudget?: number;
  pathCost: number;
  visitedCount: number;
  peakFrontier: number;
  pathFound: boolean;
}

/* ============================================================================
 * World 5: Binary Trees & BSTs (Canopy Nexus)
 * ========================================================================== */

export type TreeTraversalOrder =
  | 'preorder'
  | 'inorder'
  | 'postorder'
  | 'levelorder';

export type TreeInteractionMode =
  | 'search'
  | 'insert'
  | 'traverse'
  | 'delete'
  | 'balance'
  | 'sandbox';

export interface TreeNode {
  id: string;
  value: number;
  leftId: string | null;
  rightId: string | null;
  pos: [number, number, number];
  corrupted?: boolean;
  highlighted?: boolean;
  /** 1-based traversal order badge */
  visitedOrder?: number;
  /** AVL balance factor = height(left) - height(right) */
  balanceFactor?: number;
}

export interface TreesWorldState {
  world: 'trees';
  mode: TreeInteractionMode;
  nodes: Record<string, TreeNode>;
  rootId: string | null;
  selectedNodeId: string | null;
  pendingQueue: number[];
  visitedSequence: number[];
  targetSequence?: number[];
  searchTarget?: number;
  foundNodeId?: string | null;
  expectedValues?: number[];
  showBalanceFactors?: boolean;
  invariantViolations: number;
}

/* ============================================================================
 * Discriminated Union & Curriculum / Sandbox / Runner Contracts
 * ========================================================================== */

export type AnyWorldState =
  | ArraysWorldState
  | LinkedListWorldState
  | StacksQueuesWorldState
  | PathfindingWorldState
  | TreesWorldState;

export interface LevelDefinition<TState extends AnyWorldState = AnyWorldState> {
  id: string;
  /** Display code such as "1.1", "2.4", "4.3" */
  code: string;
  worldId: WorldId;
  /** 1-based order within its world (1..4) */
  order: number;
  title: string;
  /** Core DSA concept tag */
  concept: string;
  /** 1-line mission brief */
  brief: string;
  /** Concise goal summary shown in the HUD */
  goalSummary: string;
  initialState: TState;
  par: ParThresholds;
  pseudocode: string[];
  starterCode: string;
  referenceSolution: string;
  /** Conceptual takeaway shown on completion */
  insight: string;
  /** Optional expanded Big-O intuition explanation */
  bigOIntuition?: string;
  /** Optional progressive hints revealed step-by-step in HUD */
  hints?: string[];
  strictNoLeaks?: boolean;
  strictNoOverflows?: boolean;
  maxCyclesBudget?: number;
  /** Level objective discriminator used by each world engine's evaluator */
  objectiveKind?: string;
  /** Optional level-specific metadata (e.g., windowSize, targetSum, expectedCost) */
  meta?: Record<string, unknown>;
}

export interface SandboxPreset {
  id: string;
  name: string;
  worldId: WorldId;
  createdAt: number;
  state: AnyWorldState;
}

export type CodeErrorType = 'SYNTAX' | 'RUNTIME' | 'TIMEOUT' | 'OP_LIMIT';

export interface CodeExecutionResult<TState extends AnyWorldState = AnyWorldState> {
  ok: boolean;
  events: SimEvent<TState>[];
  finalState: TState;
  metrics: SimMetrics;
  score?: ScoreReport;
  logs: string[];
  error?: string;
  errorType?: CodeErrorType;
  durationMs: number;
}

export interface TimelineState<TState = AnyWorldState> {
  initialState: TState;
  events: SimEvent<TState>[];
  /** -1 indicates initialState prior to event 0 */
  cursor: number;
  isPlaying: boolean;
  speed: PlaybackSpeed;
}
