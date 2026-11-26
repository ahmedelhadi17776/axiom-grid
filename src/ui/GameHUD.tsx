import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Award,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Cpu,
  FileCode2,
  GitMerge,
  Layers,
  Lightbulb,
  Music,
  Pause,
  Play,
  Plus,
  Radar,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Search,
  SkipBack,
  SkipForward,
  Sparkles,
  Star,
  StepBack,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useGameStore, type PathPaintTool } from '../store/useGameStore';
import { getLevelById, getNextLevel } from '../levels/index';
import { getActiveEvent, getCurrentState } from '../engine/timeline';
import type {
  PathfindingAlgorithm,
  PlaybackSpeed,
  TreeTraversalOrder,
} from '../engine/types';

const SPEEDS: PlaybackSpeed[] = [0.5, 1, 2, 4];

const PATHFINDING_ALGOS: Array<{ id: PathfindingAlgorithm; label: string }> = [
  { id: 'bfs', label: 'BFS' },
  { id: 'dfs', label: 'DFS' },
  { id: 'dijkstra', label: 'DIJK' },
  { id: 'greedy', label: 'GREEDY' },
  { id: 'astar', label: 'A*' },
  { id: 'bidirectional', label: 'BIDIR' },
];

const TREE_TRAVERSALS: Array<{ id: TreeTraversalOrder; label: string }> = [
  { id: 'preorder', label: 'PRE' },
  { id: 'inorder', label: 'IN' },
  { id: 'postorder', label: 'POST' },
  { id: 'levelorder', label: 'LEVEL' },
];

export const GameHUD: React.FC = () => {
  const activeLevelId = useGameStore((s) => s.activeLevelId);
  const timeline = useGameStore((s) => s.timeline);
  const metrics = useGameStore((s) => s.metrics);
  const codeDrawerOpen = useGameStore((s) => s.codeDrawerOpen);
  const pseudocodeOpen = useGameStore((s) => s.pseudocodeOpen);
  const hintStep = useGameStore((s) => s.hintStep);
  const audioMuted = useGameStore((s) => s.audioMuted);
  const ambientEnabled = useGameStore((s) => s.ambientEnabled);
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);
  const pathPaintTool = useGameStore((s) => s.pathPaintTool);
  const statusToast = useGameStore((s) => s.statusToast);
  const scoreReport = useGameStore((s) => s.scoreReport);
  const victoryDismissed = useGameStore((s) => s.victoryDismissed);

  const goToHub = useGameStore((s) => s.goToHub);
  const startLevel = useGameStore((s) => s.startLevel);
  const reopenVictoryModal = useGameStore((s) => s.reopenVictoryModal);
  const resetLevel = useGameStore((s) => s.resetLevel);
  const validateCurrentLevel = useGameStore((s) => s.validateCurrentLevel);
  const setCodeDrawerOpen = useGameStore((s) => s.setCodeDrawerOpen);
  const setPseudocodeOpen = useGameStore((s) => s.setPseudocodeOpen);
  const revealNextHint = useGameStore((s) => s.revealNextHint);
  const hideHints = useGameStore((s) => s.hideHints);
  const triggerResetCamera = useGameStore((s) => s.triggerResetCamera);
  const toggleAudioMute = useGameStore((s) => s.toggleAudioMute);
  const toggleAmbient = useGameStore((s) => s.toggleAmbient);
  const toggleGraphicsQuality = useGameStore((s) => s.toggleGraphicsQuality);
  const playTimeline = useGameStore((s) => s.playTimeline);
  const pauseTimeline = useGameStore((s) => s.pauseTimeline);
  const stepForward = useGameStore((s) => s.stepForward);
  const stepBack = useGameStore((s) => s.stepBack);
  const seekTimeline = useGameStore((s) => s.seekTimeline);
  const rewindTimeline = useGameStore((s) => s.rewindTimeline);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const handleDirectAction = useGameStore((s) => s.handleDirectAction);
  const runPathfindingSearch = useGameStore((s) => s.runPathfindingSearch);
  const setPathPaintTool = useGameStore((s) => s.setPathPaintTool);
  const clearToast = useGameStore((s) => s.clearToast);

  const level = getLevelById(activeLevelId);
  if (!level) return null;

  const nextLevel = getNextLevel(activeLevelId);
  const showWonBanner = Boolean(scoreReport?.passed && victoryDismissed);
  const currentState = getCurrentState(timeline);
  const activeEvent = getActiveEvent(timeline);
  const totalEvents = timeline.events.length;
  const hints = level.hints ?? [];
  const totalHints = hints.length;

  // Color-code cycles meter against S-Rank & 3-Star Par
  const cycleColor =
    metrics.cycles <= level.par.sRankCycles
      ? 'text-neon-cyan'
      : metrics.cycles <= level.par.threeStarCycles
        ? 'text-neon-amber'
        : 'text-neon-crimson';

  const memColor =
    metrics.auxMemory <= level.par.maxAuxMemory
      ? 'text-neon-violet'
      : 'text-neon-crimson';

  const handleHintButtonClick = () => {
    if (totalHints === 0) return;
    if (hintStep >= totalHints) {
      hideHints();
    } else {
      revealNextHint();
    }
  };

  const renderWorldQuickControls = () => {
    if (currentState.world === 'arrays') {
      if (currentState.searchTarget !== undefined) {
        const found = currentState.foundIndex !== null && currentState.foundIndex !== undefined;
        return (
          <div className="flex items-center gap-2 rounded-lg border border-sky-400/35 bg-sky-500/12 px-3 py-1.5 text-xs font-mono text-sky-100">
            <span className="font-bold text-neon-cyan">
              TARGET: {currentState.searchTarget}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-300">
              {found ? 'Target locked!' : 'Click slots to PROBE'}
            </span>
          </div>
        );
      }

      if (currentState.window) {
        const [left, right] = currentState.window;
        const maxIdx = currentState.slots.length - 1;
        return (
          <div className="flex items-center gap-1.5">
            <button
              disabled={left <= 0}
              onClick={() =>
                handleDirectAction({
                  world: 'arrays',
                  type: 'SET_WINDOW',
                  payload: { left: left - 1, right: right - 1 },
                })
              }
              className="flex items-center gap-1 rounded-lg border border-sky-400/35 bg-sky-500/12 px-2.5 py-1.5 text-[11px] font-mono text-sky-100 transition hover:bg-sky-500/22 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>SLIDE L</span>
            </button>
            <span className="rounded-md border border-slate-700/60 bg-surface/80 px-2.5 py-1 text-[11px] font-mono text-slate-200">
              [{left}..{right}]
            </span>
            <button
              disabled={right >= maxIdx}
              onClick={() =>
                handleDirectAction({
                  world: 'arrays',
                  type: 'SET_WINDOW',
                  payload: { left: left + 1, right: right + 1 },
                })
              }
              className="flex items-center gap-1 rounded-lg border border-sky-400/35 bg-sky-500/12 px-2.5 py-1.5 text-[11px] font-mono text-sky-100 transition hover:bg-sky-500/22 disabled:opacity-40"
            >
              <span>SLIDE R</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      }
      return (
        <span className="hidden text-xs font-mono text-slate-400 xl:inline">
          Click two 3D blocks to <span className="text-neon-cyan">SWAP</span>
        </span>
      );
    }

    if (currentState.world === 'linked-lists') {
      const hasProbe = Boolean(
        currentState.hasCycle ||
          currentState.cursors.slow !== undefined ||
          level.objectiveKind === 'sever-cycle'
      );
      return (
        <div className="flex items-center gap-2">
          {hasProbe && (
            <button
              onClick={() =>
                handleDirectAction({
                  world: 'linked-lists',
                  type: 'STEP_PROBE',
                })
              }
              className="glow-violet flex items-center gap-1.5 rounded-lg border border-violet-400/45 bg-violet-500/16 px-3 py-1.5 text-[11px] font-mono font-semibold text-violet-100 transition hover:bg-violet-500/26"
            >
              <Radar className="h-3.5 w-3.5 text-neon-violet" />
              <span>STEP PROBE (1x/2x)</span>
            </button>
          )}
          <span className="hidden text-xs font-mono text-slate-400 xl:inline">
            Click node → target or <span className="text-neon-cyan">NULL</span> to rewire • Alt+Click for HEAD
          </span>
        </div>
      );
    }

    if (currentState.world === 'stacks-queues') {
      const buffers = Object.values(currentState.buffers);
      return (
        <div className="flex flex-wrap items-center gap-1.5">
          {buffers.map((buf) => (
            <div
              key={buf.id}
              className="flex items-center gap-1 rounded-lg border border-slate-700/60 bg-surface/80 px-2 py-1"
            >
              <span className="px-1 text-[11px] font-mono font-semibold text-sky-200">
                {buf.label}
              </span>
              <button
                disabled={currentState.inputStream.length === 0}
                onClick={() =>
                  handleDirectAction({
                    world: 'stacks-queues',
                    type: 'INTAKE',
                    payload: { bufferId: buf.id },
                  })
                }
                className="rounded-md bg-sky-500/18 px-2 py-0.5 text-[11px] font-mono text-sky-100 transition hover:bg-sky-500/30 disabled:opacity-35"
              >
                IN
              </button>
              <button
                disabled={buf.items.length === 0}
                onClick={() =>
                  handleDirectAction({
                    world: 'stacks-queues',
                    type: 'EMIT',
                    payload: { bufferId: buf.id },
                  })
                }
                className="rounded-md bg-emerald-500/18 px-2 py-0.5 text-[11px] font-mono text-emerald-100 transition hover:bg-emerald-500/30 disabled:opacity-35"
              >
                OUT
              </button>
            </div>
          ))}
          {buffers.length === 2 && (
            <div className="flex items-center gap-1">
              <button
                disabled={buffers[0].items.length === 0}
                onClick={() =>
                  handleDirectAction({
                    world: 'stacks-queues',
                    type: 'TRANSFER',
                    payload: { fromId: buffers[0].id, toId: buffers[1].id },
                  })
                }
                className="rounded-lg border border-violet-400/40 bg-violet-500/14 px-2.5 py-1.5 text-[11px] font-mono text-violet-200 transition hover:bg-violet-500/24 disabled:opacity-35"
              >
                {buffers[0].label} → {buffers[1].label}
              </button>
              <button
                disabled={buffers[1].items.length === 0}
                onClick={() =>
                  handleDirectAction({
                    world: 'stacks-queues',
                    type: 'TRANSFER',
                    payload: { fromId: buffers[1].id, toId: buffers[0].id },
                  })
                }
                className="rounded-lg border border-violet-400/40 bg-violet-500/14 px-2.5 py-1.5 text-[11px] font-mono text-violet-200 transition hover:bg-violet-500/24 disabled:opacity-35"
              >
                {buffers[1].label} → {buffers[0].label}
              </button>
            </div>
          )}
        </div>
      );
    }

    if (currentState.world === 'pathfinding') {
      const tools: Array<{ id: PathPaintTool; label: string }> = [
        { id: 'wall', label: 'Wall' },
        { id: 'weight', label: 'Weight' },
        { id: 'open', label: 'Open' },
      ];
      return (
        <div className="flex flex-wrap items-center gap-2">
          {/* 6-Algorithm Selector */}
          <div className="flex flex-wrap items-center rounded-lg border border-slate-700/60 bg-surface/85 p-0.5">
            {PATHFINDING_ALGOS.map((algo) => {
              const active = currentState.algorithm === algo.id;
              return (
                <button
                  key={algo.id}
                  onClick={() =>
                    handleDirectAction({
                      world: 'pathfinding',
                      type: 'SET_ALGORITHM',
                      payload: { algorithm: algo.id },
                    })
                  }
                  className={`rounded-md px-2 py-1 text-[11px] font-mono font-semibold uppercase transition ${
                    active
                      ? 'bg-sky-500/25 text-sky-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {algo.label}
                </button>
              );
            })}
          </div>

          {/* Paint Tools */}
          <div className="hidden items-center rounded-lg border border-slate-700/60 bg-surface/85 p-0.5 sm:flex">
            {tools.map((t) => (
              <button
                key={t.id}
                onClick={() => setPathPaintTool(t.id)}
                className={`rounded-md px-2 py-1 text-[11px] font-mono transition ${
                  pathPaintTool === t.id
                    ? 'bg-amber-500/22 text-amber-200'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* RUN WAVE Button */}
          <button
            onClick={() => runPathfindingSearch(currentState.algorithm)}
            className="glow-emerald flex items-center gap-1.5 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3.5 py-1.5 text-xs font-mono font-bold text-emerald-100 transition hover:bg-emerald-500/30"
          >
            <Radar className="h-3.5 w-3.5 text-neon-emerald" />
            <span>RUN WAVE</span>
          </button>
        </div>
      );
    }

    if (currentState.world === 'trees') {
      const selectedNode = currentState.selectedNodeId
        ? currentState.nodes[currentState.selectedNodeId]
        : null;

      if (currentState.mode === 'search') {
        const found = Boolean(currentState.foundNodeId);
        return (
          <div className="flex items-center gap-2 rounded-lg border border-teal-400/35 bg-teal-500/12 px-3 py-1.5 text-xs font-mono text-teal-100">
            <span className="font-bold text-neon-teal">
              TARGET: {currentState.searchTarget}
            </span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-300">
              {found ? 'Canopy node found!' : 'Click canopy nodes to probe'}
            </span>
          </div>
        );
      }

      if (currentState.mode === 'insert') {
        const nextKey = currentState.pendingQueue[0];
        return (
          <div className="flex items-center gap-2 rounded-lg border border-teal-400/35 bg-teal-500/12 px-3 py-1.5 text-xs font-mono text-teal-100">
            {nextKey !== undefined ? (
              <>
                <span className="font-bold text-neon-teal">NEXT KEY: {nextKey}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">
                  Click glowing L / R socket
                  {currentState.pendingQueue.length > 1
                    ? ` (${currentState.pendingQueue.length} left)`
                    : ''}
                </span>
              </>
            ) : (
              <span className="font-semibold text-neon-emerald">
                All keys docked!
              </span>
            )}
          </div>
        );
      }

      if (currentState.mode === 'traverse') {
        return (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-slate-700/60 bg-surface/85 p-0.5">
              {TREE_TRAVERSALS.map((tr) => (
                <button
                  key={tr.id}
                  onClick={() =>
                    handleDirectAction({
                      world: 'trees',
                      type: 'RUN_TRAVERSAL',
                      payload: { order: tr.id },
                    })
                  }
                  className="rounded-md px-2.5 py-1 text-[11px] font-mono font-semibold text-teal-200 transition hover:bg-teal-500/22 hover:text-teal-100"
                >
                  {tr.label}
                </button>
              ))}
            </div>
            <span className="hidden text-xs font-mono text-slate-400 lg:inline">
              or click nodes in order
            </span>
          </div>
        );
      }

      if (currentState.mode === 'delete') {
        return (
          <div className="flex items-center gap-2">
            <span className="rounded-lg border border-slate-700/60 bg-surface/80 px-2.5 py-1.5 text-xs font-mono text-slate-300">
              {selectedNode ? (
                <>
                  NODE: <strong className="text-neon-teal">{selectedNode.value}</strong>
                </>
              ) : (
                'Select a node in 3D'
              )}
            </span>
            <button
              disabled={!selectedNode}
              onClick={() => {
                if (!selectedNode) return;
                handleDirectAction({
                  world: 'trees',
                  type: 'DELETE_NODE',
                  payload: { id: selectedNode.id },
                });
              }}
              className="flex items-center gap-1.5 rounded-lg border border-rose-400/45 bg-rose-500/15 px-3 py-1.5 text-xs font-mono font-semibold text-rose-200 transition hover:bg-rose-500/25 disabled:opacity-40"
            >
              <Trash2 className="h-3.5 w-3.5 text-neon-crimson" />
              <span>DELETE SELECTED</span>
            </button>
          </div>
        );
      }

      if (currentState.mode === 'balance') {
        const bf = selectedNode?.balanceFactor ?? 0;
        return (
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-lg border border-slate-700/60 bg-surface/80 px-2.5 py-1.5 text-xs font-mono text-slate-300">
              {selectedNode ? (
                <>
                  NODE: <strong className="text-neon-teal">{selectedNode.value}</strong>{' '}
                  <span className={Math.abs(bf) > 1 ? 'text-neon-crimson' : 'text-neon-emerald'}>
                    (BF {bf > 0 ? `+${bf}` : bf})
                  </span>
                </>
              ) : (
                'Click a node to rotate'
              )}
            </span>
            <button
              disabled={!selectedNode}
              onClick={() => {
                if (!selectedNode) return;
                handleDirectAction({
                  world: 'trees',
                  type: 'ROTATE_LEFT',
                  payload: { id: selectedNode.id },
                });
              }}
              className="flex items-center gap-1 rounded-lg border border-teal-400/40 bg-teal-500/15 px-2.5 py-1.5 text-xs font-mono font-semibold text-teal-100 transition hover:bg-teal-500/25 disabled:opacity-40"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>ROTATE L</span>
            </button>
            <button
              disabled={!selectedNode}
              onClick={() => {
                if (!selectedNode) return;
                handleDirectAction({
                  world: 'trees',
                  type: 'ROTATE_RIGHT',
                  payload: { id: selectedNode.id },
                });
              }}
              className="flex items-center gap-1 rounded-lg border border-violet-400/40 bg-violet-500/15 px-2.5 py-1.5 text-xs font-mono font-semibold text-violet-100 transition hover:bg-violet-500/25 disabled:opacity-40"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span>ROTATE R</span>
            </button>
          </div>
        );
      }
    }

    if (currentState.world === 'dp') {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-indigo-400/35 bg-indigo-500/12 px-2.5 py-1.5 text-xs font-mono text-indigo-100">
            <span className="font-bold text-neon-indigo">
              TARGET: {currentState.targetAnswer}
            </span>
            {currentState.naiveRecursionOps !== undefined && (
              <>
                <span className="text-slate-500">•</span>
                <span className="text-[11px] text-slate-300">
                  NAIVE O(2^n): <strong className="text-amber-200">{currentState.naiveRecursionOps}</strong>
                </span>
              </>
            )}
          </div>
          <span className="hidden text-xs font-mono text-slate-400 xl:inline">
            Click glowing indigo cells to compute
          </span>
          <button
            onClick={() =>
              handleDirectAction({
                world: 'dp',
                type: 'TRACE_OPTIMAL',
              })
            }
            className="glow-indigo flex items-center gap-1.5 rounded-lg border border-indigo-400/45 bg-indigo-500/18 px-3 py-1.5 text-xs font-mono font-semibold text-indigo-100 transition hover:bg-indigo-500/28"
          >
            <GitMerge className="h-3.5 w-3.5 text-neon-indigo" />
            <span>TRACE OPTIMAL</span>
          </button>
        </div>
      );
    }

    if (currentState.world === 'hash-table') {
      const nextPending = currentState.pendingKeys[0];
      const occupiedCount = currentState.buckets.reduce(
        (acc, b) => acc + (b.entry ? 1 : 0) + b.chain.length,
        0
      );
      const loadPct = Math.round((occupiedCount / Math.max(1, currentState.capacity)) * 100);
      const isOverloaded = occupiedCount / Math.max(1, currentState.capacity) > currentState.loadFactorThreshold;

      // For tombstone mode: find occupied non-target keys so player can delete with tombstone
      const deletableEntries =
        currentState.mode === 'tombstone'
          ? currentState.buckets
              .filter((b) => b.entry && b.entry.key !== currentState.searchTarget)
              .map((b) => b.entry!)
          : [];

      // For two-sum mode: check which array values aren't stored yet, and whether a complement pair is stored
      const storedKeys = new Set<number>();
      for (const b of currentState.buckets) {
        if (b.entry) storedKeys.add(b.entry.key);
        for (const e of b.chain) storedKeys.add(e.key);
      }
      const nextTwoSumKey =
        currentState.mode === 'two-sum' && currentState.twoSumArray
          ? currentState.twoSumArray.find((num) => !storedKeys.has(num))
          : undefined;

      let readyPair: [number, number] | null = null;
      if (
        currentState.mode === 'two-sum' &&
        currentState.twoSumTarget !== undefined &&
        !currentState.foundPair
      ) {
        for (const k of storedKeys) {
          const comp = currentState.twoSumTarget - k;
          if (comp !== k && storedKeys.has(comp)) {
            readyPair = [k, comp];
            break;
          }
        }
      }

      return (
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Load & Next Key Status */}
          <div className="flex items-center gap-2 rounded-lg border border-orange-400/35 bg-orange-500/12 px-2.5 py-1.5 text-xs font-mono text-orange-100">
            {nextPending ? (
              <span>
                NEXT: <strong className="text-neon-orange">{nextPending.key}</strong> → h=
                {((nextPending.key % currentState.capacity) + currentState.capacity) %
                  currentState.capacity}
              </span>
            ) : (
              <span>
                LOAD:{' '}
                <strong className={isOverloaded ? 'text-neon-crimson' : 'text-neon-orange'}>
                  {loadPct}%
                </strong>
              </span>
            )}
          </div>

          {nextPending && (
            <button
              onClick={() =>
                handleDirectAction({
                  world: 'hash-table',
                  type: 'INSERT',
                  payload: { key: nextPending.key, value: nextPending.value },
                })
              }
              className="flex items-center gap-1 rounded-lg border border-orange-400/45 bg-orange-500/18 px-2.5 py-1.5 text-[11px] font-mono font-semibold text-orange-100 transition hover:bg-orange-500/28"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>INSERT {nextPending.key}</span>
            </button>
          )}

          {currentState.mode === 'tombstone' &&
            deletableEntries.slice(0, 2).map((entry) => (
              <button
                key={entry.key}
                onClick={() =>
                  handleDirectAction({
                    world: 'hash-table',
                    type: 'REMOVE',
                    payload: { key: entry.key, useTombstone: true },
                  })
                }
                className="flex items-center gap-1 rounded-lg border border-amber-400/40 bg-amber-500/14 px-2.5 py-1.5 text-[11px] font-mono font-semibold text-amber-200 transition hover:bg-amber-500/24"
              >
                <Trash2 className="h-3 w-3" />
                <span>DEL {entry.key} (TOMB)</span>
              </button>
            ))}

          {currentState.searchTarget !== undefined && (
            <button
              onClick={() =>
                handleDirectAction({
                  world: 'hash-table',
                  type: 'LOOKUP',
                  payload: { key: currentState.searchTarget },
                })
              }
              className="flex items-center gap-1 rounded-lg border border-sky-400/45 bg-sky-500/16 px-2.5 py-1.5 text-[11px] font-mono font-semibold text-sky-100 transition hover:bg-sky-500/26"
            >
              <Search className="h-3.5 w-3.5 text-neon-cyan" />
              <span>LOOKUP {currentState.searchTarget}</span>
            </button>
          )}

          {(currentState.mode === 'rehash' || isOverloaded) && (
            <button
              onClick={() =>
                handleDirectAction({
                  world: 'hash-table',
                  type: 'REHASH',
                })
              }
              className="glow-orange flex items-center gap-1 rounded-lg border border-orange-400/50 bg-orange-500/20 px-2.5 py-1.5 text-[11px] font-mono font-bold text-orange-100 transition hover:bg-orange-500/30"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>REHASH 2x</span>
            </button>
          )}

          {currentState.mode === 'two-sum' && (
            <>
              {nextTwoSumKey !== undefined && !readyPair && (
                <button
                  onClick={() =>
                    handleDirectAction({
                      world: 'hash-table',
                      type: 'INSERT',
                      payload: { key: nextTwoSumKey, value: String(nextTwoSumKey) },
                    })
                  }
                  className="flex items-center gap-1 rounded-lg border border-orange-400/45 bg-orange-500/18 px-2.5 py-1.5 text-[11px] font-mono font-semibold text-orange-100 transition hover:bg-orange-500/28"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>HASH {nextTwoSumKey}</span>
                </button>
              )}
              {readyPair && (
                <button
                  onClick={() =>
                    handleDirectAction({
                      world: 'hash-table',
                      type: 'MARK_PAIR',
                      payload: { a: readyPair![0], b: readyPair![1] },
                    })
                  }
                  className="glow-emerald flex items-center gap-1 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 text-[11px] font-mono font-bold text-emerald-100 transition hover:bg-emerald-500/30"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-neon-emerald" />
                  <span>
                    SOLVE PAIR ({readyPair[0]}+{readyPair[1]})
                  </span>
                </button>
              )}
            </>
          )}
        </div>
      );
    }

    if (currentState.world === 'heap') {
      const nextVal = currentState.pendingQueue[0];
      const hasSelected =
        currentState.selectedIndex !== null &&
        currentState.selectedIndex >= 0 &&
        currentState.selectedIndex < currentState.items.length;

      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-lg border border-pink-400/35 bg-pink-500/12 px-2.5 py-1.5 text-[11px] font-mono font-bold text-neon-rose">
            {currentState.mode === 'median'
              ? 'TWIN SPIRES'
              : currentState.kind === 'min'
                ? 'MIN-HEAP'
                : 'MAX-HEAP'}
          </span>

          {currentState.mode === 'median' ? (
            <button
              disabled={nextVal === undefined}
              onClick={() =>
                handleDirectAction({
                  world: 'heap',
                  type: 'INSERT_DUAL',
                })
              }
              className="glow-rose flex items-center gap-1.5 rounded-lg border border-pink-400/50 bg-pink-500/20 px-3 py-1.5 text-xs font-mono font-bold text-pink-100 transition hover:bg-pink-500/30 disabled:opacity-40"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>
                {nextVal !== undefined
                  ? `FEED ${nextVal} → TWIN SPIRES`
                  : 'ALL FED'}
              </span>
            </button>
          ) : (
            <>
              {nextVal !== undefined && (
                <>
                  <button
                    onClick={() =>
                      handleDirectAction({
                        world: 'heap',
                        type: 'INSERT',
                      })
                    }
                    className="flex items-center gap-1 rounded-lg border border-pink-400/45 bg-pink-500/18 px-2.5 py-1.5 text-[11px] font-mono font-semibold text-pink-100 transition hover:bg-pink-500/28"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>INSERT {nextVal}</span>
                  </button>
                  <button
                    onClick={() =>
                      handleDirectAction({
                        world: 'heap',
                        type: 'PUSH_RAW',
                      })
                    }
                    className="rounded-lg border border-slate-700/60 bg-surface/85 px-2 py-1.5 text-[11px] font-mono text-slate-300 transition hover:border-pink-400/40 hover:text-pink-200"
                  >
                    PUSH RAW
                  </button>
                </>
              )}

              <button
                disabled={currentState.items.length === 0}
                onClick={() =>
                  handleDirectAction({
                    world: 'heap',
                    type: 'EXTRACT_ROOT',
                  })
                }
                className="flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-mono font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-35"
              >
                <ArrowUp className="h-3.5 w-3.5 text-neon-emerald" />
                <span>EXTRACT ROOT</span>
              </button>

              {hasSelected && (
                <>
                  <button
                    onClick={() =>
                      handleDirectAction({
                        world: 'heap',
                        type: 'SIFT_UP',
                        payload: { index: currentState.selectedIndex },
                      })
                    }
                    className="flex items-center gap-1 rounded-lg border border-sky-400/40 bg-sky-500/15 px-2 py-1.5 text-[11px] font-mono text-sky-100 transition hover:bg-sky-500/25"
                  >
                    <ArrowUp className="h-3 w-3" />
                    <span>SIFT UP</span>
                  </button>
                  <button
                    onClick={() =>
                      handleDirectAction({
                        world: 'heap',
                        type: 'SIFT_DOWN',
                        payload: { index: currentState.selectedIndex },
                      })
                    }
                    className="flex items-center gap-1 rounded-lg border border-violet-400/40 bg-violet-500/15 px-2 py-1.5 text-[11px] font-mono text-violet-100 transition hover:bg-violet-500/25"
                  >
                    <ArrowDown className="h-3 w-3" />
                    <span>SIFT DOWN</span>
                  </button>
                </>
              )}

              {(currentState.mode === 'heapify' || currentState.mode === 'heapsort') && (
                <button
                  onClick={() =>
                    handleDirectAction({
                      world: 'heap',
                      type: 'HEAPIFY',
                    })
                  }
                  className="glow-rose flex items-center gap-1 rounded-lg border border-pink-400/50 bg-pink-500/20 px-2.5 py-1.5 text-[11px] font-mono font-bold text-pink-100 transition hover:bg-pink-500/30"
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>HEAPIFY</span>
                </button>
              )}
            </>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3">
        {/* TOP BAR */}
        <header className="glass-panel pointer-events-auto flex flex-wrap items-center justify-between gap-2 rounded-2xl px-3.5 py-2">
          {/* Left: Back + Level Pill + Goal */}
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              onClick={goToHub}
              title="Back to World Hub"
              className="flex items-center gap-1 rounded-lg border border-slate-700/60 bg-surface/80 px-2.5 py-1.5 text-xs font-mono text-slate-300 transition hover:border-sky-400/45 hover:text-sky-200"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">HUB</span>
            </button>

            <div className="flex items-center gap-2 rounded-lg border border-sky-400/30 bg-sky-500/10 px-2.5 py-1">
              <span className="text-xs font-mono font-bold text-neon-cyan">
                {level.code}
              </span>
              <span className="text-xs font-semibold tracking-wide text-slate-100 uppercase">
                {level.title}
              </span>
            </div>

            <span className="hidden max-w-md truncate text-xs text-slate-300 lg:inline">
              {level.goalSummary}
            </span>
          </div>

          {/* Center/Right: Telemetry Meters & Quick Toggles */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Cycles / Par Meter */}
            <div className="flex items-center gap-2 rounded-lg border border-slate-700/60 bg-surface/80 px-2.5 py-1 font-mono text-xs">
              <Cpu className="h-3.5 w-3.5 text-slate-400" />
              <span className={`font-bold ${cycleColor}`}>{metrics.cycles}</span>
              <span className="text-[11px] text-slate-400">
                / S:{level.par.sRankCycles}
              </span>
            </div>

            {/* Aux Memory Meter */}
            <div className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-surface/80 px-2.5 py-1 font-mono text-xs">
              <span className="text-[11px] text-slate-400">MEM</span>
              <span className={`font-bold ${memColor}`}>{metrics.auxMemory}</span>
              <span className="text-[11px] text-slate-400">
                /{level.par.maxAuxMemory}
              </span>
            </div>

            {/* Big-O Target Badge */}
            <span className="hidden rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-mono font-semibold text-amber-200 md:inline">
              {level.par.targetBigO}
            </span>

            {/* Camera / Graphics / Audio */}
            <div className="flex items-center gap-1 border-l border-slate-700/60 pl-2">
              <button
                onClick={triggerResetCamera}
                title="Reset Isometric Camera"
                className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-800/80 hover:text-sky-300"
              >
                <Camera className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={toggleGraphicsQuality}
                title={`Graphics: ${graphicsQuality.toUpperCase()}`}
                className={`rounded-lg px-2 py-1 text-[11px] font-mono transition ${
                  graphicsQuality === 'high'
                    ? 'bg-sky-500/15 text-sky-200'
                    : 'bg-slate-800/80 text-slate-400'
                }`}
              >
                <Sparkles className="mr-1 inline h-3 w-3" />
                {graphicsQuality === 'high' ? 'HI' : 'ECO'}
              </button>
              <button
                onClick={toggleAmbient}
                title="Toggle Ambient Pad"
                className={`rounded-lg p-1.5 transition ${
                  ambientEnabled && !audioMuted
                    ? 'bg-violet-500/18 text-violet-200'
                    : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
                }`}
              >
                <Music className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={toggleAudioMute}
                title={audioMuted ? 'Unmute Audio' : 'Mute Audio'}
                className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-800/80"
              >
                {audioMuted ? (
                  <VolumeX className="h-3.5 w-3.5 text-neon-crimson" />
                ) : (
                  <Volume2 className="h-3.5 w-3.5 text-neon-cyan" />
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Spacer */}
        <div className="flex-1" />

        {/* BOTTOM CONTROL DOCK */}
        <footer className="glass-panel pointer-events-auto flex flex-col gap-2 rounded-2xl px-3.5 py-2.5">
          {/* Row 1: Panel Toggles + World Quick Actions + Reset/Validate */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Left: Pseudocode + Progressive Hint */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPseudocodeOpen(!pseudocodeOpen)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-mono transition ${
                  pseudocodeOpen
                    ? 'border-sky-400/50 bg-sky-500/16 text-sky-100'
                    : 'border-slate-700/60 bg-surface/80 text-slate-300 hover:border-sky-400/40'
                }`}
              >
                <FileCode2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">PSEUDOCODE</span>
              </button>

              {totalHints > 0 && (
                <button
                  onClick={handleHintButtonClick}
                  title="Reveal Progressive Conceptual Hint"
                  className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-mono transition ${
                    hintStep > 0
                      ? 'border-amber-400/50 bg-amber-500/18 text-amber-100'
                      : 'border-slate-700/60 bg-surface/80 text-slate-300 hover:border-amber-400/40 hover:text-amber-200'
                  }`}
                >
                  <Lightbulb className="h-3.5 w-3.5 text-neon-amber" />
                  <span className="hidden sm:inline">HINT</span>
                  <span className="rounded bg-void/60 px-1.5 py-0.5 text-[10px] font-bold text-amber-200">
                    {hintStep}/{totalHints}
                  </span>
                </button>
              )}
            </div>

            {/* Center: World-Specific Tactile Controls */}
            <div className="flex items-center justify-center">
              {renderWorldQuickControls()}
            </div>

            {/* Right: Reset + Check/Validate + Code Drawer Toggle */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={resetLevel}
                title="Reset Level"
                className="flex items-center gap-1 rounded-lg border border-slate-700/60 bg-surface/80 px-2.5 py-1.5 text-xs font-mono text-slate-300 transition hover:border-amber-400/45 hover:text-amber-200"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden md:inline">RESET</span>
              </button>

              <button
                onClick={validateCurrentLevel}
                title="Check / Validate Solution"
                className="flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-500/14 px-2.5 py-1.5 text-xs font-mono font-semibold text-emerald-200 transition hover:bg-emerald-500/24"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-neon-emerald" />
                <span className="hidden md:inline">CHECK</span>
              </button>

              <button
                onClick={() => setCodeDrawerOpen(!codeDrawerOpen)}
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-mono transition ${
                  codeDrawerOpen
                    ? 'border-emerald-400/50 bg-emerald-500/18 text-emerald-100'
                    : 'border-slate-700/60 bg-surface/80 text-slate-300 hover:border-emerald-400/40'
                }`}
              >
                <Code2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">JS CODE</span>
              </button>
            </div>
          </div>

          {/* Row 2: Universal Playback Scrubber & Telemetry Event Pill */}
          <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-700/50 pt-2">
            <div className="flex items-center gap-1">
              <button
                onClick={rewindTimeline}
                disabled={totalEvents === 0}
                title="Rewind"
                className="rounded-md p-1.5 text-slate-300 transition hover:bg-slate-800/80 hover:text-sky-300 disabled:opacity-35"
              >
                <SkipBack className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={stepBack}
                disabled={timeline.cursor <= -1}
                title="Step Back"
                className="rounded-md p-1.5 text-slate-300 transition hover:bg-slate-800/80 hover:text-sky-300 disabled:opacity-35"
              >
                <StepBack className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={timeline.isPlaying ? pauseTimeline : playTimeline}
                disabled={totalEvents === 0}
                title={timeline.isPlaying ? 'Pause' : 'Play'}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-sky-400/45 bg-sky-500/18 text-sky-200 transition hover:bg-sky-500/28 disabled:opacity-35"
              >
                {timeline.isPlaying ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-sky-300" />
                )}
              </button>
              <button
                onClick={stepForward}
                disabled={timeline.cursor >= totalEvents - 1}
                title="Step Forward"
                className="rounded-md p-1.5 text-slate-300 transition hover:bg-slate-800/80 hover:text-sky-300 disabled:opacity-35"
              >
                <SkipForward className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Interactive Range Scrubber */}
            <div className="flex min-w-[120px] flex-1 items-center gap-2">
              <input
                type="range"
                min={-1}
                max={Math.max(-1, totalEvents - 1)}
                value={timeline.cursor}
                disabled={totalEvents === 0}
                onChange={(e) => seekTimeline(Number(e.target.value))}
                className="h-1.5 w-full cursor-pointer accent-neon-cyan"
              />
              <span className="w-12 shrink-0 text-right font-mono text-[11px] text-slate-400">
                {timeline.cursor + 1}/{totalEvents}
              </span>
            </div>

            {/* Speed Selector */}
            <div className="flex items-center rounded-md border border-slate-700/60 bg-surface/80 p-0.5">
              {SPEEDS.map((spd) => (
                <button
                  key={spd}
                  onClick={() => setSpeed(spd)}
                  className={`rounded px-1.5 py-0.5 font-mono text-[11px] transition ${
                    timeline.speed === spd
                      ? 'bg-sky-500/25 font-bold text-sky-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {spd}x
                </button>
              ))}
            </div>

            {/* Live Telemetry Event Pill */}
            <div className="hidden max-w-xs truncate rounded-full border border-slate-700/60 bg-surface/80 px-3 py-1 font-mono text-[11px] text-sky-200 md:block">
              {activeEvent
                ? `[${activeEvent.type}] ${activeEvent.label}`
                : 'READY // Direct 3D or JS Code'}
            </div>
          </div>
        </footer>
      </div>

      {/* FLOATING COLLAPSIBLE PROGRESSIVE HINT CARD */}
      <AnimatePresence>
        {hintStep > 0 && totalHints > 0 && (
          <motion.div
            initial={{ y: 14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 14, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="glass-panel pointer-events-auto fixed bottom-[118px] left-1/2 z-30 w-[92vw] max-w-lg -translate-x-1/2 rounded-2xl border-amber-400/35 p-4 shadow-xl"
          >
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4 text-neon-amber" />
                <span className="text-xs font-mono font-bold tracking-wider text-amber-200">
                  HINT {hintStep} / {totalHints}
                </span>
              </div>
              <button
                onClick={hideHints}
                title="Dismiss Hints"
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-800/80 hover:text-slate-100"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <ol className="space-y-2 text-xs leading-relaxed text-slate-200">
              {hints.slice(0, hintStep).map((hintText, idx) => (
                <li
                  key={idx}
                  className="flex items-start gap-2 rounded-lg border border-slate-700/50 bg-surface/70 px-3 py-2"
                >
                  <span className="shrink-0 font-mono text-[11px] font-bold text-neon-amber">
                    #{idx + 1}
                  </span>
                  <span>{hintText}</span>
                </li>
              ))}
            </ol>

            <div className="mt-3 flex items-center justify-end gap-2">
              {hintStep < totalHints && (
                <button
                  onClick={revealNextHint}
                  className="rounded-lg border border-amber-400/45 bg-amber-500/18 px-3 py-1.5 text-xs font-mono font-semibold text-amber-100 transition hover:bg-amber-500/28"
                >
                  Next Hint ({hintStep + 1}/{totalHints})
                </button>
              )}
              <button
                onClick={hideHints}
                className="rounded-lg border border-slate-700/60 bg-surface/80 px-3 py-1.5 text-xs font-mono text-slate-300 transition hover:border-slate-500/70 hover:text-slate-100"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING VICTORY INSPECTION BANNER (when VictoryModal is dismissed in won state) */}
      <AnimatePresence>
        {showWonBanner && scoreReport && (
          <motion.div
            initial={{ y: -14, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -14, opacity: 0 }}
            className="glass-panel glow-emerald pointer-events-auto fixed left-1/2 top-[70px] z-30 flex max-w-[94vw] -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-full border-emerald-400/45 bg-emerald-950/80 px-3.5 py-1.5 text-xs font-mono shadow-lg backdrop-blur-md"
          >
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1 font-bold tracking-wider text-neon-emerald">
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>CIRCUIT VERIFIED</span>
              </span>

              {scoreReport.rank && (
                <span className="rounded-md border border-emerald-400/45 bg-emerald-500/18 px-1.5 py-0.5 text-[11px] font-black text-emerald-100">
                  RANK {scoreReport.rank}
                </span>
              )}

              <div className="flex items-center gap-0.5">
                {[1, 2, 3].map((n) => (
                  <Star
                    key={n}
                    className={`h-3.5 w-3.5 ${
                      scoreReport.stars >= n
                        ? 'fill-neon-amber text-neon-amber'
                        : 'text-slate-600'
                    }`}
                  />
                ))}
              </div>
            </div>

            <div className="hidden h-4 w-px bg-emerald-500/30 sm:block" />

            <div className="flex items-center gap-1.5">
              {totalEvents > 0 && (
                <button
                  onClick={() => {
                    rewindTimeline();
                    playTimeline();
                  }}
                  className="flex items-center gap-1 rounded-full border border-sky-400/45 bg-sky-500/15 px-2.5 py-1 text-[11px] font-semibold text-sky-100 transition hover:bg-sky-500/25"
                >
                  <Play className="h-3 w-3 fill-sky-300 text-sky-300" />
                  <span>REPLAY</span>
                </button>
              )}

              <button
                onClick={reopenVictoryModal}
                className="flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-500/25"
              >
                <Award className="h-3 w-3 text-neon-emerald" />
                <span>RESULTS</span>
              </button>

              {nextLevel && (
                <button
                  onClick={() => startLevel(nextLevel.id)}
                  className="flex items-center gap-1 rounded-full border border-emerald-300/60 bg-emerald-500/25 px-3 py-1 text-[11px] font-bold text-slate-50 transition hover:bg-emerald-400/35"
                >
                  <span>NEXT: {nextLevel.code}</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FLOATING STATUS TOAST (Root stacking context z-40 above side panels) */}
      <AnimatePresence>
        {statusToast && (
          <motion.div
            initial={{ y: -12, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -12, opacity: 0 }}
            className={`pointer-events-auto fixed left-1/2 ${
              showWonBanner ? 'top-[124px]' : 'top-[74px]'
            } z-40 flex max-w-xl -translate-x-1/2 items-center gap-2.5 rounded-full border px-4 py-1.5 text-xs font-mono shadow-lg backdrop-blur-md ${
              statusToast.tone === 'error'
                ? 'border-rose-400/50 bg-rose-950/90 text-rose-100'
                : statusToast.tone === 'success'
                  ? 'border-emerald-400/50 bg-emerald-950/90 text-emerald-100'
                  : 'border-sky-400/45 bg-surface/95 text-sky-100'
            }`}
          >
            <span className="truncate">{statusToast.message}</span>
            <button onClick={clearToast} className="shrink-0 opacity-75 hover:opacity-100">
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
