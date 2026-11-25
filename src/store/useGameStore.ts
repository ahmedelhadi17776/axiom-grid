import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AnyWorldState,
  ArraysWorldState,
  LevelDefinition,
  LinkedListWorldState,
  PathfindingAlgorithm,
  PathfindingWorldState,
  PlaybackSpeed,
  Rank,
  SandboxPreset,
  ScoreReport,
  SimEvent,
  SimMetrics,
  StacksQueuesWorldState,
  TimelineState,
  TreesWorldState,
  TreeTraversalOrder,
  WorldId,
} from '../engine/types';
import { compareRanks, createEmptyMetrics } from '../engine/scorer';
import {
  createTimeline,
  getActiveEvent,
  getCumulativeMetrics,
  getCurrentState,
  resetTimeline,
  seekTimeline as seekTimelineState,
  setTimelinePlaying,
  setTimelineSpeed,
  stepBack as timelineStepBack,
  stepForward as timelineStepForward,
} from '../engine/timeline';
import {
  applyDirectAction,
  cloneWorldState,
  createArraysSession,
  createPathfindingSession,
  createTreesSession,
  evaluateLevel,
  recomputeTreeLayoutAndMetrics,
} from '../engine/worlds/index';
import {
  ALL_LEVELS,
  LEVELS_BY_WORLD,
  SANDBOX_DEFAULTS,
  getLevelById,
} from '../levels/index';
import { runPlayerCode } from '../sandbox/codeRunner';
import { soundEngine } from '../audio/soundEngine';
import type { DirectAction } from '../scene/IsometricCanvas';

export type ScreenId = 'title' | 'hub' | 'play' | 'sandbox';
export type GraphicsQuality = 'high' | 'eco';
export type PathPaintTool = 'wall' | 'weight' | 'open' | 'start' | 'goal';

export interface LevelProgress {
  stars: 0 | 1 | 2 | 3;
  rank: Rank | null;
  bestCycles: number;
  bestAuxMemory: number;
}

export interface PathComparisonRow {
  algorithm: PathfindingAlgorithm;
  pathFound: boolean;
  pathCost: number;
  visitedCount: number;
  peakFrontier: number;
}

export interface StatusToast {
  message: string;
  tone: 'info' | 'error' | 'success';
}

export function playAudioForEvent(event: SimEvent | null): void {
  if (!event) return;
  switch (event.type) {
    case 'SWAP':
    case 'WRITE':
    case 'ROTATE_LEFT':
    case 'ROTATE_RIGHT':
      soundEngine.playSwap(event.pitchHint ?? 0.5);
      break;
    case 'LINK':
    case 'UNLINK':
    case 'INSERT_NODE':
      soundEngine.playLink();
      break;
    case 'PROBE':
      soundEngine.playStep(event.pitchHint ?? 0.65);
      break;
    case 'DELETE_NODE':
      soundEngine.playStep(event.pitchHint ?? 0.3);
      break;
    case 'MEMORY_LEAK':
    case 'NULL_DEREF':
    case 'OVERFLOW':
    case 'UNDERFLOW':
    case 'BOUNDS_FAULT':
    case 'INVARIANT_FAULT':
    case 'NO_PATH':
    case 'FAIL':
      soundEngine.playError();
      break;
    case 'SUCCESS':
    case 'PATH_FOUND':
      soundEngine.playVictory();
      break;
    case 'INIT':
      break;
    default:
      soundEngine.playStep(event.pitchHint ?? 0.5);
      break;
  }
}

const DEFAULT_LEVEL: LevelDefinition = ALL_LEVELS[0];

const SANDBOX_STARTER_CODE: Record<WorldId, string> = {
  arrays: `// Sandbox Arrays API: api.length, api.get(i), api.compare(i, j), api.swap(i, j), api.probe(i)
for (let i = 0; i < api.length - 1; i++) {
  for (let j = 0; j < api.length - i - 1; j++) {
    if (api.compare(j, j + 1) > 0) {
      api.swap(j, j + 1);
    }
  }
}
`,
  'linked-lists': `// Sandbox Linked Lists API: api.head(), api.getNode(id), api.link(fromId, toId), api.setHead(id)
const cycle = api.detectCycle();
console.log('Cycle detected:', cycle.hasCycle);
`,
  'stacks-queues': `// Sandbox Stacks & Queues API: api.hasInput(), api.intake(buf), api.transfer(a, b), api.emit(buf)
while (api.hasInput()) {
  api.intake('stackA');
}
while (api.size('stackA') > 0) {
  api.emit('stackA');
}
`,
  pathfinding: `// Sandbox Pathfinding API: api.setAlgorithm('bfs'|'dfs'|'dijkstra'|'greedy'|'astar'|'bidirectional'), api.runSearch()
api.setAlgorithm('astar');
const res = api.runSearch();
console.log('Path cost:', res.pathCost, 'Visited:', res.visitedCount);
`,
  trees: `// Sandbox Trees API: api.root(), api.getNode(id), api.insert(val), api.deleteNode(id), api.rotateLeft(id), api.runTraversal(order)
api.insert(42);
const sorted = api.runTraversal('inorder');
console.log('In-order harvest:', sorted.join(', '));
`,
};

function createSyntheticSandboxLevel(
  worldId: WorldId,
  state: AnyWorldState
): LevelDefinition {
  return {
    id: `sandbox-${worldId}`,
    code: 'SBX',
    worldId,
    order: 0,
    title: 'Sandbox Experiment',
    concept: 'Free Exploration',
    brief: 'Experiment freely with algorithms and data structures.',
    goalSummary: 'Open-ended sandbox lab',
    initialState: cloneWorldState(state),
    par: {
      sRankCycles: 999,
      threeStarCycles: 999,
      twoStarCycles: 999,
      maxAuxMemory: 999,
      targetBigO: 'Sandbox',
    },
    pseudocode: [],
    starterCode: SANDBOX_STARTER_CODE[worldId],
    referenceSolution: SANDBOX_STARTER_CODE[worldId],
    insight: 'Sandbox simulation complete.',
  };
}

function mergeProgress(
  existing: LevelProgress | undefined,
  report: ScoreReport
): LevelProgress {
  if (!existing) {
    return {
      stars: report.stars,
      rank: report.rank,
      bestCycles: report.metrics.cycles,
      bestAuxMemory: report.metrics.auxMemory,
    };
  }
  const betterStars = Math.max(existing.stars, report.stars) as 0 | 1 | 2 | 3;
  const betterRank =
    compareRanks(report.rank, existing.rank) > 0 ? report.rank : existing.rank;
  return {
    stars: betterStars,
    rank: betterRank,
    bestCycles: Math.min(existing.bestCycles, report.metrics.cycles),
    bestAuxMemory: Math.min(existing.bestAuxMemory, report.metrics.auxMemory),
  };
}

function createRandomArrayState(size: number): ArraysWorldState {
  const clamped = Math.max(4, Math.min(10, size));
  const used = new Set<number>();
  const values: number[] = [];
  while (values.length < clamped) {
    const v = 10 + Math.floor(Math.random() * 85);
    if (!used.has(v)) {
      used.add(v);
      values.push(v);
    }
  }
  return {
    world: 'arrays',
    slots: values.map((value, idx) => ({
      id: `slot-${idx}`,
      value,
      state: 'idle',
    })),
    pointers: { i: 0, j: clamped - 1 },
  };
}

function createRandomPathfindingState(
  base: PathfindingWorldState
): PathfindingWorldState {
  const next = cloneWorldState(base);
  const [sx, sy] = next.start;
  const [gx, gy] = next.goal;
  next.cells = next.cells.map((cell) => {
    const cleaned = {
      ...cell,
      visited: false,
      inFrontier: false,
      inPath: false,
      distance: undefined,
    };
    if ((cell.x === sx && cell.y === sy) || (cell.x === gx && cell.y === gy)) {
      return cleaned;
    }
    const r = Math.random();
    if (r < 0.22) {
      return { ...cleaned, type: 'wall', weight: Infinity };
    }
    if (r < 0.42) {
      return { ...cleaned, type: 'weighted', weight: 3 + Math.floor(Math.random() * 3) };
    }
    return { ...cleaned, type: 'open', weight: 1 };
  });
  next.pathCost = 0;
  next.visitedCount = 0;
  next.peakFrontier = 0;
  next.pathFound = false;
  return next;
}

const PACKET_COLORS = ['#38BDF8', '#FBBF24', '#34D399', '#A78BFA', '#FB7185', '#2DD4BF'];

function createRandomTreesState(): TreesWorldState {
  const count = 6 + Math.floor(Math.random() * 2); // 6–7 nodes
  const used = new Set<number>();
  const values: number[] = [];
  while (values.length < count) {
    const v = 12 + Math.floor(Math.random() * 83);
    if (!used.has(v)) {
      used.add(v);
      values.push(v);
    }
  }
  const emptyState: TreesWorldState = {
    world: 'trees',
    mode: 'sandbox',
    nodes: {},
    rootId: null,
    selectedNodeId: null,
    pendingQueue: [],
    visitedSequence: [],
    showBalanceFactors: true,
    invariantViolations: 0,
  };
  const session = createTreesSession(emptyState);
  for (const val of values) {
    session.insert(val);
  }
  const nextState = session.getState();
  for (const node of Object.values(nextState.nodes)) {
    node.highlighted = false;
    node.visitedOrder = undefined;
  }
  recomputeTreeLayoutAndMetrics(nextState);
  return nextState;
}

export interface GameStoreState {
  // Navigation
  screen: ScreenId;
  activeWorldId: WorldId;
  activeLevelId: string;

  // Persisted progress
  progress: Record<string, LevelProgress>;
  unlockAll: boolean;

  // Settings
  audioMuted: boolean;
  ambientEnabled: boolean;
  graphicsQuality: GraphicsQuality;
  reducedMotion: boolean;

  // Active simulation & timeline
  timeline: TimelineState<AnyWorldState>;
  metrics: SimMetrics;
  scoreReport: ScoreReport | null;
  pendingScoreReport: ScoreReport | null;
  victoryDismissed: boolean;
  activeCode: string;
  codeLogs: string[];
  codeError: string | null;
  isRunningCode: boolean;
  codeDrawerOpen: boolean;
  pseudocodeOpen: boolean;
  hintStep: number;
  resetCameraSignal: number;
  pathPaintTool: PathPaintTool;
  statusToast: StatusToast | null;

  // Sandbox
  sandboxWorld: WorldId;
  sandboxState: AnyWorldState;
  sandboxPresets: SandboxPreset[];
  pathComparison: PathComparisonRow[] | null;

  // Actions
  goToTitle: () => void;
  goToHub: () => void;
  startLevel: (levelId: string) => void;
  enterSandbox: (worldId?: WorldId) => void;
  setSandboxWorld: (worldId: WorldId) => void;
  handleDirectAction: (action: DirectAction) => void;
  runCode: () => Promise<void>;
  validateCurrentLevel: () => void;
  runPathfindingSearch: (algo?: PathfindingAlgorithm) => void;
  comparePathfindingAlgorithms: () => void;
  playTimeline: () => void;
  pauseTimeline: () => void;
  stepForward: () => void;
  stepBack: () => void;
  seekTimeline: (index: number) => void;
  rewindTimeline: () => void;
  setSpeed: (speed: PlaybackSpeed) => void;
  resetLevel: () => void;
  setActiveCode: (code: string) => void;
  resetStarterCode: () => void;
  loadReferenceSolution: () => void;
  setCodeDrawerOpen: (open: boolean) => void;
  setPseudocodeOpen: (open: boolean) => void;
  revealNextHint: () => void;
  hideHints: () => void;
  triggerResetCamera: () => void;
  setPathPaintTool: (tool: PathPaintTool) => void;
  dismissVictoryModal: () => void;
  reopenVictoryModal: () => void;
  clearToast: () => void;
  toggleAudioMute: () => void;
  toggleAmbient: () => void;
  toggleGraphicsQuality: () => void;
  toggleReducedMotion: () => void;
  toggleUnlockAll: () => void;
  saveSandboxPreset: (name: string) => void;
  loadSandboxPreset: (preset: SandboxPreset) => void;
  deleteSandboxPreset: (id: string) => void;
  randomizeSandbox: () => void;
  resetSandbox: () => void;
  setSandboxArraySize: (size: number) => void;
  runSandboxSortDemo: (algo: 'bubble' | 'insertion' | 'quick') => void;
  sandboxAddLinkedNode: () => void;
  sandboxToggleLinkedCycle: () => void;
  sandboxAddPacket: () => void;
  sandboxInsertTreeKey: (value?: number) => void;
  sandboxRunTreeTraversal: (order: TreeTraversalOrder) => void;
  sandboxAutoBalanceTree: () => void;
  isLevelUnlocked: (levelId: string) => boolean;
}

export const useGameStore = create<GameStoreState>()(
  persist(
    (set, get) => ({
      screen: 'title',
      activeWorldId: DEFAULT_LEVEL.worldId,
      activeLevelId: DEFAULT_LEVEL.id,

      progress: {},
      unlockAll: false,

      audioMuted: false,
      ambientEnabled: false,
      graphicsQuality: 'high',
      reducedMotion: false,

      timeline: createTimeline<AnyWorldState>(cloneWorldState(DEFAULT_LEVEL.initialState)),
      metrics: createEmptyMetrics(),
      scoreReport: null,
      pendingScoreReport: null,
      victoryDismissed: false,
      activeCode: DEFAULT_LEVEL.starterCode,
      codeLogs: [],
      codeError: null,
      isRunningCode: false,
      codeDrawerOpen: false,
      pseudocodeOpen: true,
      hintStep: 0,
      resetCameraSignal: 0,
      pathPaintTool: 'wall',
      statusToast: null,

      sandboxWorld: 'arrays',
      sandboxState: cloneWorldState(SANDBOX_DEFAULTS.arrays),
      sandboxPresets: [],
      pathComparison: null,

      goToTitle: () => {
        soundEngine.playSelect();
        set((s) => ({
          screen: 'title',
          timeline: setTimelinePlaying(s.timeline, false),
          scoreReport: null,
          pendingScoreReport: null,
          hintStep: 0,
          statusToast: null,
        }));
      },

      goToHub: () => {
        soundEngine.playSelect();
        set((s) => ({
          screen: 'hub',
          timeline: setTimelinePlaying(s.timeline, false),
          scoreReport: null,
          pendingScoreReport: null,
          hintStep: 0,
          statusToast: null,
        }));
      },

      startLevel: (levelId: string) => {
        const level = getLevelById(levelId);
        if (!level) return;
        soundEngine.playSelect();
        const initial = cloneWorldState(level.initialState);
        set((s) => ({
          screen: 'play',
          activeWorldId: level.worldId,
          activeLevelId: level.id,
          timeline: createTimeline<AnyWorldState>(initial, [], {
            speed: s.timeline.speed,
          }),
          metrics: createEmptyMetrics(),
          scoreReport: null,
          pendingScoreReport: null,
          victoryDismissed: false,
          activeCode: level.starterCode,
          codeLogs: [],
          codeError: null,
          isRunningCode: false,
          hintStep: 0,
          pathComparison: null,
          statusToast: null,
          resetCameraSignal: s.resetCameraSignal + 1,
        }));
      },

      enterSandbox: (worldId?: WorldId) => {
        soundEngine.playSelect();
        const targetWorld = worldId ?? get().sandboxWorld;
        const initial = cloneWorldState(SANDBOX_DEFAULTS[targetWorld]);
        set((s) => ({
          screen: 'sandbox',
          sandboxWorld: targetWorld,
          activeWorldId: targetWorld,
          sandboxState: initial,
          timeline: createTimeline<AnyWorldState>(initial, [], {
            speed: s.timeline.speed,
          }),
          metrics: createEmptyMetrics(),
          scoreReport: null,
          pendingScoreReport: null,
          victoryDismissed: false,
          activeCode: SANDBOX_STARTER_CODE[targetWorld],
          codeLogs: [],
          codeError: null,
          isRunningCode: false,
          pathComparison: null,
          statusToast: null,
          resetCameraSignal: s.resetCameraSignal + 1,
        }));
      },

      setSandboxWorld: (worldId: WorldId) => {
        soundEngine.playSelect();
        const initial = cloneWorldState(SANDBOX_DEFAULTS[worldId]);
        set((s) => ({
          sandboxWorld: worldId,
          activeWorldId: worldId,
          sandboxState: initial,
          timeline: createTimeline<AnyWorldState>(initial, [], {
            speed: s.timeline.speed,
          }),
          metrics: createEmptyMetrics(),
          activeCode: SANDBOX_STARTER_CODE[worldId],
          codeLogs: [],
          codeError: null,
          pathComparison: null,
          statusToast: null,
          resetCameraSignal: s.resetCameraSignal + 1,
        }));
      },

      handleDirectAction: (action: DirectAction) => {
        const state = get();
        const currentWorldState = getCurrentState(state.timeline);
        const result = applyDirectAction(currentWorldState, action, state.metrics);

        const truncatedEvents =
          state.timeline.cursor < state.timeline.events.length - 1
            ? state.timeline.events.slice(0, state.timeline.cursor + 1)
            : state.timeline.events;

        let nextTimeline: TimelineState<AnyWorldState>;
        if (result.events.length === 0) {
          if (action.world === 'pathfinding' || truncatedEvents.length === 0) {
            nextTimeline = createTimeline<AnyWorldState>(
              cloneWorldState(result.state),
              [],
              { speed: state.timeline.speed }
            );
          } else {
            const updatedEvents = [...truncatedEvents];
            const lastIdx = updatedEvents.length - 1;
            updatedEvents[lastIdx] = {
              ...updatedEvents[lastIdx],
              snapshot: cloneWorldState(result.state),
            };
            nextTimeline = {
              ...state.timeline,
              events: updatedEvents,
              cursor: lastIdx,
              isPlaying: false,
            };
          }
        } else {
          const nextEvents = [...truncatedEvents, ...result.events];
          nextTimeline = {
            ...state.timeline,
            events: nextEvents,
            cursor: nextEvents.length - 1,
            isPlaying: false,
          };
        }

        const lastEvent =
          result.events.length > 0 ? result.events[result.events.length - 1] : null;
        playAudioForEvent(lastEvent);

        if (state.screen === 'sandbox') {
          set({
            timeline: nextTimeline,
            metrics: result.metrics,
            sandboxState: cloneWorldState(result.state),
            pathComparison: action.world === 'pathfinding' ? null : state.pathComparison,
          });
          return;
        }

        const level = getLevelById(state.activeLevelId);
        if (!level) {
          set({ timeline: nextTimeline, metrics: result.metrics });
          return;
        }

        const report = evaluateLevel(level, result.state, result.metrics);

        if (report.passed) {
          soundEngine.playVictory();
          const nextProgress = {
            ...state.progress,
            [level.id]: mergeProgress(state.progress[level.id], report),
          };
          set({
            timeline: nextTimeline,
            metrics: result.metrics,
            scoreReport: report,
            pendingScoreReport: null,
            victoryDismissed: false,
            progress: nextProgress,
            statusToast: null,
          });
        } else {
          let toast: StatusToast | null = state.statusToast;
          if (
            lastEvent &&
            (lastEvent.type === 'MEMORY_LEAK' ||
              lastEvent.type === 'NULL_DEREF' ||
              lastEvent.type === 'OVERFLOW' ||
              lastEvent.type === 'UNDERFLOW' ||
              lastEvent.type === 'BOUNDS_FAULT' ||
              lastEvent.type === 'INVARIANT_FAULT')
          ) {
            toast = { message: lastEvent.label, tone: 'error' };
          }
          set({
            timeline: nextTimeline,
            metrics: result.metrics,
            statusToast: toast,
          });
        }
      },

      runCode: async () => {
        const state = get();
        if (state.isRunningCode) return;
        soundEngine.playSelect();

        const isSandbox = state.screen === 'sandbox';
        const level = isSandbox
          ? createSyntheticSandboxLevel(state.sandboxWorld, state.sandboxState)
          : getLevelById(state.activeLevelId);

        if (!level) return;

        set({
          isRunningCode: true,
          codeError: null,
          codeLogs: [],
          scoreReport: null,
          pendingScoreReport: null,
          statusToast: null,
        });

        try {
          const result = await runPlayerCode(level, state.activeCode);

          if (!result.ok) {
            soundEngine.playError();
            const prefix =
              result.errorType === 'TIMEOUT'
                ? '[TIMEOUT] '
                : result.errorType === 'OP_LIMIT'
                  ? '[THERMAL OVERLOAD] '
                  : result.errorType === 'SYNTAX'
                    ? '[SYNTAX ERROR] '
                    : '[RUNTIME ERROR] ';
            set({
              isRunningCode: false,
              codeLogs: result.logs,
              codeError: `${prefix}${result.error ?? 'Execution failed.'}`,
            });
            return;
          }

          const baseState = cloneWorldState(level.initialState);
          const hasEvents = result.events.length > 0;
          const nextTimeline = createTimeline<AnyWorldState>(
            baseState,
            result.events,
            {
              speed: state.timeline.speed,
              isPlaying: hasEvents,
              startCursor: hasEvents ? -1 : -1,
            }
          );

          const report = isSandbox
            ? null
            : (result.score ?? evaluateLevel(level, result.finalState, result.metrics));

          if (!hasEvents && report && !isSandbox) {
            if (report.passed) {
              soundEngine.playVictory();
              set((s) => ({
                isRunningCode: false,
                timeline: nextTimeline,
                metrics: result.metrics,
                codeLogs: result.logs,
                codeError: null,
                scoreReport: report,
                victoryDismissed: false,
                progress: {
                  ...s.progress,
                  [level.id]: mergeProgress(s.progress[level.id], report),
                },
              }));
            } else {
              soundEngine.playError();
              set({
                isRunningCode: false,
                timeline: nextTimeline,
                metrics: result.metrics,
                codeLogs: result.logs,
                codeError: null,
                statusToast: {
                  message: report.failureReason ?? 'Objective not yet satisfied.',
                  tone: 'error',
                },
              });
            }
            return;
          }

          set({
            isRunningCode: false,
            timeline: nextTimeline,
            metrics: createEmptyMetrics(),
            codeLogs: result.logs,
            codeError: null,
            pendingScoreReport: report,
            sandboxState: isSandbox ? cloneWorldState(result.finalState) : state.sandboxState,
          });
        } catch (err) {
          soundEngine.playError();
          set({
            isRunningCode: false,
            codeError:
              err instanceof Error ? err.message : 'Unexpected code execution failure.',
          });
        }
      },

      validateCurrentLevel: () => {
        const state = get();
        if (state.screen !== 'play') return;
        const level = getLevelById(state.activeLevelId);
        if (!level) return;

        const currentState = getCurrentState(state.timeline);
        const report = evaluateLevel(level, currentState, state.metrics);

        if (report.passed) {
          soundEngine.playVictory();
          set({
            scoreReport: report,
            pendingScoreReport: null,
            victoryDismissed: false,
            progress: {
              ...state.progress,
              [level.id]: mergeProgress(state.progress[level.id], report),
            },
            statusToast: null,
          });
        } else {
          soundEngine.playError();
          set({
            statusToast: {
              message: report.failureReason ?? 'Objective criteria not yet met.',
              tone: 'error',
            },
          });
        }
      },

      runPathfindingSearch: (algo?: PathfindingAlgorithm) => {
        const state = get();
        const current = getCurrentState(state.timeline);
        if (current.world !== 'pathfinding') return;

        soundEngine.playSelect();
        const cleanStart = cloneWorldState(current);
        cleanStart.cells = cleanStart.cells.map((c) => ({
          ...c,
          visited: false,
          inFrontier: false,
          inPath: false,
          distance: undefined,
        }));
        if (algo) {
          cleanStart.algorithm = algo;
        }

        const session = createPathfindingSession(cleanStart);
        if (algo) session.setAlgorithm(algo);
        session.runSearch();

        const events = session.getEvents();
        const finalState = session.getState();
        const finalMetrics = session.getMetrics();

        const nextTimeline = createTimeline<AnyWorldState>(cleanStart, events, {
          speed: state.timeline.speed,
          isPlaying: events.length > 0,
          startCursor: -1,
        });

        let pendingReport: ScoreReport | null = null;
        if (state.screen === 'play') {
          const level = getLevelById(state.activeLevelId);
          if (level) {
            pendingReport = evaluateLevel(level, finalState, finalMetrics);
          }
        }

        set({
          timeline: nextTimeline,
          metrics: createEmptyMetrics(),
          pendingScoreReport: pendingReport,
          scoreReport: null,
          statusToast: null,
          sandboxState:
            state.screen === 'sandbox' ? cloneWorldState(cleanStart) : state.sandboxState,
        });
      },

      comparePathfindingAlgorithms: () => {
        const state = get();
        const current = getCurrentState(state.timeline);
        if (current.world !== 'pathfinding') return;

        soundEngine.playSelect();
        const session = createPathfindingSession(cloneWorldState(current));
        const comparison = session.compareAllAlgorithms();
        set({ pathComparison: comparison });
      },

      playTimeline: () => {
        soundEngine.playSelect();
        set((s) => {
          const atEnd =
            s.timeline.events.length > 0 &&
            s.timeline.cursor >= s.timeline.events.length - 1;
          const baseTimeline = atEnd ? resetTimeline(s.timeline) : s.timeline;
          return {
            timeline: setTimelinePlaying(baseTimeline, true),
            ...(atEnd ? { metrics: createEmptyMetrics() } : {}),
          };
        });
      },

      pauseTimeline: () => {
        set((s) => ({
          timeline: setTimelinePlaying(s.timeline, false),
        }));
      },

      stepForward: () => {
        const state = get();
        const prevCursor = state.timeline.cursor;
        const nextTimeline = timelineStepForward(state.timeline);
        if (nextTimeline.cursor === prevCursor && nextTimeline.isPlaying === state.timeline.isPlaying) {
          return;
        }

        const activeEvent = getActiveEvent(nextTimeline);
        const nextMetrics = getCumulativeMetrics(nextTimeline);
        playAudioForEvent(activeEvent);

        const reachedEnd =
          nextTimeline.events.length > 0 &&
          nextTimeline.cursor >= nextTimeline.events.length - 1;

        if (reachedEnd && state.pendingScoreReport && state.screen === 'play') {
          const report = state.pendingScoreReport;
          const level = getLevelById(state.activeLevelId);
          if (report.passed && level) {
            soundEngine.playVictory();
            set({
              timeline: nextTimeline,
              metrics: nextMetrics,
              scoreReport: report,
              pendingScoreReport: null,
              victoryDismissed: false,
              progress: {
                ...state.progress,
                [level.id]: mergeProgress(state.progress[level.id], report),
              },
              statusToast: null,
            });
            return;
          } else {
            soundEngine.playError();
            set({
              timeline: nextTimeline,
              metrics: nextMetrics,
              pendingScoreReport: null,
              statusToast: {
                message: report.failureReason ?? 'Objective not satisfied.',
                tone: 'error',
              },
            });
            return;
          }
        }

        set({
          timeline: nextTimeline,
          metrics: nextMetrics,
        });
      },

      stepBack: () => {
        set((s) => {
          const nextTimeline = timelineStepBack(s.timeline);
          return {
            timeline: nextTimeline,
            metrics: getCumulativeMetrics(nextTimeline),
          };
        });
      },

      seekTimeline: (index: number) => {
        set((s) => {
          const nextTimeline = seekTimelineState(s.timeline, index);
          return {
            timeline: nextTimeline,
            metrics: getCumulativeMetrics(nextTimeline),
          };
        });
      },

      rewindTimeline: () => {
        soundEngine.playSelect();
        set((s) => {
          const nextTimeline = resetTimeline(s.timeline);
          return {
            timeline: nextTimeline,
            metrics: createEmptyMetrics(),
          };
        });
      },

      setSpeed: (speed: PlaybackSpeed) => {
        soundEngine.playSelect();
        set((s) => ({
          timeline: setTimelineSpeed(s.timeline, speed),
        }));
      },

      resetLevel: () => {
        const state = get();
        soundEngine.playSelect();
        if (state.screen === 'sandbox') {
          state.resetSandbox();
          return;
        }
        const level = getLevelById(state.activeLevelId);
        if (!level) return;
        const initial = cloneWorldState(level.initialState);
        set({
          timeline: createTimeline<AnyWorldState>(initial, [], {
            speed: state.timeline.speed,
          }),
          metrics: createEmptyMetrics(),
          scoreReport: null,
          pendingScoreReport: null,
          victoryDismissed: false,
          codeError: null,
          codeLogs: [],
          hintStep: 0,
          statusToast: null,
        });
      },

      setActiveCode: (code: string) => set({ activeCode: code }),

      resetStarterCode: () => {
        soundEngine.playSelect();
        const state = get();
        if (state.screen === 'sandbox') {
          set({
            activeCode: SANDBOX_STARTER_CODE[state.sandboxWorld],
            codeError: null,
            codeLogs: [],
          });
          return;
        }
        const level = getLevelById(state.activeLevelId);
        if (!level) return;
        set({
          activeCode: level.starterCode,
          codeError: null,
          codeLogs: [],
        });
      },

      loadReferenceSolution: () => {
        soundEngine.playSelect();
        const state = get();
        const level = getLevelById(state.activeLevelId);
        if (!level) return;
        set({
          activeCode: level.referenceSolution,
          codeDrawerOpen: true,
          codeError: null,
          statusToast: {
            message: 'Reference solution loaded into Code Drawer. Click Run Code to watch!',
            tone: 'info',
          },
        });
      },

      setCodeDrawerOpen: (open: boolean) => {
        soundEngine.playSelect();
        set({ codeDrawerOpen: open });
      },

      setPseudocodeOpen: (open: boolean) => {
        soundEngine.playSelect();
        set({ pseudocodeOpen: open });
      },

      revealNextHint: () => {
        const state = get();
        const level = getLevelById(state.activeLevelId);
        const maxHints = level?.hints?.length ?? 0;
        if (maxHints === 0) return;
        soundEngine.playSelect();
        set((s) => ({
          hintStep: Math.min(maxHints, s.hintStep + 1),
        }));
      },

      hideHints: () => {
        soundEngine.playSelect();
        set({ hintStep: 0 });
      },

      triggerResetCamera: () => {
        soundEngine.playSelect();
        set((s) => ({ resetCameraSignal: s.resetCameraSignal + 1 }));
      },

      setPathPaintTool: (tool: PathPaintTool) => {
        soundEngine.playSelect();
        set({ pathPaintTool: tool });
      },

      dismissVictoryModal: () => {
        soundEngine.playSelect();
        set({ victoryDismissed: true });
      },

      reopenVictoryModal: () => {
        soundEngine.playSelect();
        set({ victoryDismissed: false });
      },

      clearToast: () => set({ statusToast: null }),

      toggleAudioMute: () => {
        set((s) => {
          const next = !s.audioMuted;
          soundEngine.setMuted(next);
          if (!next) soundEngine.playSelect();
          return { audioMuted: next };
        });
      },

      toggleAmbient: () => {
        set((s) => {
          const next = !s.ambientEnabled;
          soundEngine.setAmbientEnabled(next);
          soundEngine.playSelect();
          return { ambientEnabled: next };
        });
      },

      toggleGraphicsQuality: () => {
        soundEngine.playSelect();
        set((s) => ({
          graphicsQuality: s.graphicsQuality === 'high' ? 'eco' : 'high',
        }));
      },

      toggleReducedMotion: () => {
        soundEngine.playSelect();
        set((s) => ({ reducedMotion: !s.reducedMotion }));
      },

      toggleUnlockAll: () => {
        soundEngine.playSelect();
        set((s) => ({ unlockAll: !s.unlockAll }));
      },

      saveSandboxPreset: (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        soundEngine.playSelect();
        const state = get();
        const current = cloneWorldState(getCurrentState(state.timeline));
        const preset: SandboxPreset = {
          id: `custom-${Date.now()}`,
          name: trimmed,
          worldId: state.sandboxWorld,
          createdAt: Date.now(),
          state: current,
        };
        set((s) => ({
          sandboxPresets: [preset, ...s.sandboxPresets],
          statusToast: { message: `Saved preset "${trimmed}"`, tone: 'success' },
        }));
      },

      loadSandboxPreset: (preset: SandboxPreset) => {
        soundEngine.playSelect();
        const cloned = cloneWorldState(preset.state);
        set((s) => ({
          sandboxWorld: preset.worldId,
          activeWorldId: preset.worldId,
          sandboxState: cloned,
          timeline: createTimeline<AnyWorldState>(cloned, [], {
            speed: s.timeline.speed,
          }),
          metrics: createEmptyMetrics(),
          pathComparison: null,
          activeCode: SANDBOX_STARTER_CODE[preset.worldId],
          statusToast: { message: `Loaded preset "${preset.name}"`, tone: 'info' },
          resetCameraSignal: s.resetCameraSignal + 1,
        }));
      },

      deleteSandboxPreset: (id: string) => {
        soundEngine.playSelect();
        set((s) => ({
          sandboxPresets: s.sandboxPresets.filter((p) => p.id !== id),
        }));
      },

      randomizeSandbox: () => {
        soundEngine.playSelect();
        const state = get();
        const world = state.sandboxWorld;
        let nextState: AnyWorldState;

        if (world === 'arrays') {
          const curr = getCurrentState(state.timeline);
          const count = curr.world === 'arrays' ? curr.slots.length : 6;
          nextState = createRandomArrayState(count);
        } else if (world === 'pathfinding') {
          const curr = getCurrentState(state.timeline);
          const base =
            curr.world === 'pathfinding'
              ? curr
              : (SANDBOX_DEFAULTS.pathfinding as PathfindingWorldState);
          nextState = createRandomPathfindingState(base);
        } else if (world === 'linked-lists') {
          const count = 4 + Math.floor(Math.random() * 2);
          const nodes: LinkedListWorldState['nodes'] = {};
          for (let i = 0; i < count; i++) {
            const id = `n${i + 1}`;
            const nextId = i < count - 1 ? `n${i + 2}` : null;
            const x = -((count - 1) * 1.4) + i * 2.8;
            const z = (i % 2 === 0 ? -0.6 : 0.6);
            nodes[id] = {
              id,
              value: 10 + Math.floor(Math.random() * 89),
              nextId,
              pos: [x, 0, z],
            };
          }
          nextState = {
            world: 'linked-lists',
            nodes,
            headId: 'n1',
            cursors: { slow: 'n1', fast: 'n1' },
            hasCycle: false,
          };
        } else if (world === 'trees') {
          nextState = createRandomTreesState();
        } else {
          const base = cloneWorldState(
            SANDBOX_DEFAULTS['stacks-queues'] as StacksQueuesWorldState
          );
          const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
          const shuffled = [...labels].sort(() => Math.random() - 0.5).slice(0, 5);
          base.inputStream = shuffled.map((val, idx) => ({
            id: `pkt-${Date.now()}-${idx}`,
            value: val,
            color: PACKET_COLORS[idx % PACKET_COLORS.length],
          }));
          base.outputEmitted = [];
          Object.values(base.buffers).forEach((b) => {
            b.items = [];
            b.overflowed = false;
          });
          nextState = base;
        }

        set((s) => ({
          sandboxState: cloneWorldState(nextState),
          timeline: createTimeline<AnyWorldState>(nextState, [], {
            speed: s.timeline.speed,
          }),
          metrics: createEmptyMetrics(),
          pathComparison: null,
        }));
      },

      resetSandbox: () => {
        soundEngine.playSelect();
        const state = get();
        const fresh = cloneWorldState(SANDBOX_DEFAULTS[state.sandboxWorld]);
        set((s) => ({
          sandboxState: fresh,
          timeline: createTimeline<AnyWorldState>(fresh, [], {
            speed: s.timeline.speed,
          }),
          metrics: createEmptyMetrics(),
          pathComparison: null,
          statusToast: null,
        }));
      },

      setSandboxArraySize: (size: number) => {
        soundEngine.playSelect();
        const nextState = createRandomArrayState(size);
        set((s) => ({
          sandboxState: cloneWorldState(nextState),
          timeline: createTimeline<AnyWorldState>(nextState, [], {
            speed: s.timeline.speed,
          }),
          metrics: createEmptyMetrics(),
        }));
      },

      runSandboxSortDemo: (algo: 'bubble' | 'insertion' | 'quick') => {
        const state = get();
        const current = getCurrentState(state.timeline);
        if (current.world !== 'arrays') return;
        soundEngine.playSelect();

        const initial = cloneWorldState(current);
        initial.slots = initial.slots.map((slot) => ({ ...slot, state: 'idle' }));
        const session = createArraysSession(initial);
        const n = session.length;

        if (algo === 'bubble') {
          for (let i = 0; i < n - 1; i++) {
            for (let j = 0; j < n - i - 1; j++) {
              session.setPointer('i', j);
              session.setPointer('j', j + 1);
              if (session.compare(j, j + 1) > 0) {
                session.swap(j, j + 1);
              }
            }
            session.markSorted(n - 1 - i);
          }
          if (n > 0) session.markSorted(0);
        } else if (algo === 'insertion') {
          if (n > 0) session.markSorted(0);
          for (let i = 1; i < n; i++) {
            let j = i;
            session.setPointer('i', i);
            while (j > 0 && session.compare(j - 1, j) > 0) {
              session.setPointer('j', j - 1);
              session.swap(j - 1, j);
              j--;
            }
            session.markSorted(i);
          }
        } else {
          const quickSort = (lo: number, hi: number) => {
            if (lo >= hi) {
              if (lo === hi && lo >= 0 && lo < n) session.markSorted(lo);
              return;
            }
            let pivotIdx = lo;
            session.setPointer('pivot', hi);
            for (let j = lo; j < hi; j++) {
              session.setPointer('j', j);
              if (session.compare(j, hi) < 0) {
                if (pivotIdx !== j) session.swap(pivotIdx, j);
                pivotIdx++;
              }
            }
            if (pivotIdx !== hi) session.swap(pivotIdx, hi);
            session.markSorted(pivotIdx);
            quickSort(lo, pivotIdx - 1);
            quickSort(pivotIdx + 1, hi);
          };
          quickSort(0, n - 1);
        }

        const events = session.getEvents();
        set({
          timeline: createTimeline<AnyWorldState>(initial, events, {
            speed: state.timeline.speed,
            isPlaying: events.length > 0,
            startCursor: -1,
          }),
          metrics: createEmptyMetrics(),
        });
      },

      sandboxAddLinkedNode: () => {
        const state = get();
        const current = getCurrentState(state.timeline);
        if (current.world !== 'linked-lists') return;
        const next = cloneWorldState(current);
        const ids = Object.keys(next.nodes);
        if (ids.length >= 8) {
          soundEngine.playError();
          set({ statusToast: { message: 'Max 8 nodes in Sandbox.', tone: 'info' } });
          return;
        }
        soundEngine.playLink();
        const newId = `n${ids.length + 1}`;
        const value = 10 + Math.floor(Math.random() * 89);
        const x = -4.5 + ids.length * 1.5;
        const z = ids.length % 2 === 0 ? -1.4 : 1.4;
        next.nodes[newId] = {
          id: newId,
          value,
          nextId: null,
          pos: [x, 0, z],
        };
        set((s) => ({
          sandboxState: cloneWorldState(next),
          timeline: createTimeline<AnyWorldState>(next, [], {
            speed: s.timeline.speed,
          }),
          metrics: createEmptyMetrics(),
        }));
      },

      sandboxToggleLinkedCycle: () => {
        const state = get();
        const current = getCurrentState(state.timeline);
        if (current.world !== 'linked-lists') return;
        const next = cloneWorldState(current);
        const ids = Object.keys(next.nodes);
        if (ids.length < 2 || !next.headId) return;

        // Walk to tail or detect existing cycle
        const visited = new Set<string>();
        let curr: string | null = next.headId;
        let last: string = next.headId;
        let foundCycle = false;
        while (curr && next.nodes[curr]) {
          if (visited.has(curr)) {
            foundCycle = true;
            break;
          }
          visited.add(curr);
          last = curr;
          curr = next.nodes[curr].nextId;
        }

        if (foundCycle) {
          next.nodes[last].nextId = null;
          next.hasCycle = false;
          next.cycleSevered = true;
        } else {
          const targetId = ids.length > 2 ? ids[1] : next.headId;
          next.nodes[last].nextId = targetId;
          next.hasCycle = true;
          next.cycleSevered = false;
        }
        soundEngine.playLink();
        set((s) => ({
          sandboxState: cloneWorldState(next),
          timeline: createTimeline<AnyWorldState>(next, [], {
            speed: s.timeline.speed,
          }),
          metrics: createEmptyMetrics(),
        }));
      },

      sandboxAddPacket: () => {
        const state = get();
        const current = getCurrentState(state.timeline);
        if (current.world !== 'stacks-queues') return;
        const next = cloneWorldState(current);
        if (next.inputStream.length >= 8) {
          soundEngine.playError();
          return;
        }
        soundEngine.playSelect();
        const idx = next.inputStream.length + next.outputEmitted.length;
        const val = String.fromCharCode(65 + (idx % 26));
        next.inputStream.push({
          id: `pkt-${Date.now()}`,
          value: val,
          color: PACKET_COLORS[idx % PACKET_COLORS.length],
        });
        set((s) => ({
          sandboxState: cloneWorldState(next),
          timeline: createTimeline<AnyWorldState>(next, [], {
            speed: s.timeline.speed,
          }),
        }));
      },

      sandboxInsertTreeKey: (value?: number) => {
        const state = get();
        const current = getCurrentState(state.timeline);
        if (current.world !== 'trees') return;

        const existingValues = new Set(
          Object.values(current.nodes).map((n) => n.value)
        );
        if (existingValues.size >= 15) {
          soundEngine.playError();
          set({
            statusToast: {
              message: 'Max 15 nodes in Tree Sandbox.',
              tone: 'info',
            },
          });
          return;
        }

        let key =
          typeof value === 'number' && Number.isFinite(value)
            ? Math.round(value)
            : NaN;

        if (!Number.isFinite(key)) {
          for (let attempt = 0; attempt < 120; attempt++) {
            const candidate = 10 + Math.floor(Math.random() * 86);
            if (!existingValues.has(candidate)) {
              key = candidate;
              break;
            }
          }
        }

        if (!Number.isFinite(key) || existingValues.has(key)) {
          soundEngine.playError();
          set({
            statusToast: {
              message: `Key ${key} already exists in BST.`,
              tone: 'info',
            },
          });
          return;
        }

        soundEngine.playSelect();
        const initial = cloneWorldState(current);
        const session = createTreesSession(initial);
        session.insert(key);
        const events = session.getEvents();
        const finalState = session.getState();

        set({
          sandboxState: cloneWorldState(finalState),
          timeline: createTimeline<AnyWorldState>(initial, events, {
            speed: state.timeline.speed,
            isPlaying: events.length > 0,
            startCursor: -1,
          }),
          metrics: createEmptyMetrics(),
          statusToast: null,
        });
      },

      sandboxRunTreeTraversal: (order: TreeTraversalOrder) => {
        const state = get();
        const current = getCurrentState(state.timeline);
        if (current.world !== 'trees') return;
        if (!current.rootId) {
          soundEngine.playError();
          set({
            statusToast: { message: 'Tree is empty.', tone: 'info' },
          });
          return;
        }

        soundEngine.playSelect();
        const cleanStart = cloneWorldState(current);
        cleanStart.visitedSequence = [];
        for (const node of Object.values(cleanStart.nodes)) {
          node.visitedOrder = undefined;
          node.highlighted = false;
        }

        const session = createTreesSession(cleanStart);
        session.runTraversal(order);
        const events = session.getEvents();

        set({
          sandboxState: cloneWorldState(cleanStart),
          timeline: createTimeline<AnyWorldState>(cleanStart, events, {
            speed: state.timeline.speed,
            isPlaying: events.length > 0,
            startCursor: -1,
          }),
          metrics: createEmptyMetrics(),
          statusToast: null,
        });
      },

      sandboxAutoBalanceTree: () => {
        const state = get();
        const current = getCurrentState(state.timeline);
        if (current.world !== 'trees') return;

        soundEngine.playSelect();
        const initial = cloneWorldState(current);
        const session = createTreesSession(initial);
        session.autoBalance();
        const events = session.getEvents();
        const finalState = session.getState();

        if (events.length === 0) {
          set({
            statusToast: {
              message: 'Tree is already AVL-balanced (|BF| <= 1).',
              tone: 'info',
            },
          });
          return;
        }

        set({
          sandboxState: cloneWorldState(finalState),
          timeline: createTimeline<AnyWorldState>(initial, events, {
            speed: state.timeline.speed,
            isPlaying: true,
            startCursor: -1,
          }),
          metrics: createEmptyMetrics(),
          statusToast: null,
        });
      },

      isLevelUnlocked: (levelId: string) => {
        const state = get();
        if (state.unlockAll) return true;
        const level = getLevelById(levelId);
        if (!level) return false;
        if (level.order === 1) return true;
        const worldLevels = LEVELS_BY_WORLD[level.worldId] ?? [];
        const prev = worldLevels.find((l) => l.order === level.order - 1);
        if (!prev) return true;
        const prevProg = state.progress[prev.id];
        return Boolean(prevProg && prevProg.stars > 0);
      },
    }),
    {
      name: 'axiom-grid-v1',
      partialize: (state) => ({
        progress: state.progress,
        unlockAll: state.unlockAll,
        audioMuted: state.audioMuted,
        ambientEnabled: state.ambientEnabled,
        graphicsQuality: state.graphicsQuality,
        reducedMotion: state.reducedMotion,
        sandboxPresets: state.sandboxPresets,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          soundEngine.setMuted(state.audioMuted);
          soundEngine.setAmbientEnabled(state.ambientEnabled);
        }
      },
    }
  )
);
