import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  Camera,
  Code2,
  FlaskConical,
  GitMerge,
  Layers,
  Pause,
  Play,
  Plus,
  Radar,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Save,
  Scale,
  Shuffle,
  SkipBack,
  SkipForward,
  Sparkles,
  StepBack,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useGameStore, type PathPaintTool } from '../store/useGameStore';
import { SANDBOX_PRESETS_BUILTIN, WORLD_META } from '../levels/index';
import { getActiveEvent, getCurrentState } from '../engine/timeline';
import type {
  PathfindingAlgorithm,
  PlaybackSpeed,
  TreeTraversalOrder,
  WorldId,
} from '../engine/types';

const SPEEDS: PlaybackSpeed[] = [0.5, 1, 2, 4];

const PATHFINDING_ALGOS: Array<{ id: PathfindingAlgorithm; label: string; full: string }> = [
  { id: 'bfs', label: 'BFS', full: 'BFS' },
  { id: 'dfs', label: 'DFS', full: 'DFS' },
  { id: 'dijkstra', label: 'DIJK', full: 'Dijkstra' },
  { id: 'greedy', label: 'GREEDY', full: 'Greedy' },
  { id: 'astar', label: 'A*', full: 'A*' },
  { id: 'bidirectional', label: 'BIDIR', full: 'Bidirectional' },
];

const TREE_TRAVERSALS: Array<{ id: TreeTraversalOrder; label: string }> = [
  { id: 'preorder', label: 'PRE' },
  { id: 'inorder', label: 'IN' },
  { id: 'postorder', label: 'POST' },
  { id: 'levelorder', label: 'LEVEL' },
];

export const SandboxStudio: React.FC = () => {
  const sandboxWorld = useGameStore((s) => s.sandboxWorld);
  const sandboxPresets = useGameStore((s) => s.sandboxPresets);
  const pathComparison = useGameStore((s) => s.pathComparison);
  const timeline = useGameStore((s) => s.timeline);
  const metrics = useGameStore((s) => s.metrics);
  const codeDrawerOpen = useGameStore((s) => s.codeDrawerOpen);
  const pathPaintTool = useGameStore((s) => s.pathPaintTool);
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);
  const audioMuted = useGameStore((s) => s.audioMuted);
  const statusToast = useGameStore((s) => s.statusToast);

  const goToHub = useGameStore((s) => s.goToHub);
  const setSandboxWorld = useGameStore((s) => s.setSandboxWorld);
  const saveSandboxPreset = useGameStore((s) => s.saveSandboxPreset);
  const loadSandboxPreset = useGameStore((s) => s.loadSandboxPreset);
  const deleteSandboxPreset = useGameStore((s) => s.deleteSandboxPreset);
  const randomizeSandbox = useGameStore((s) => s.randomizeSandbox);
  const resetSandbox = useGameStore((s) => s.resetSandbox);
  const setSandboxArraySize = useGameStore((s) => s.setSandboxArraySize);
  const runSandboxSortDemo = useGameStore((s) => s.runSandboxSortDemo);
  const sandboxAddLinkedNode = useGameStore((s) => s.sandboxAddLinkedNode);
  const sandboxToggleLinkedCycle = useGameStore((s) => s.sandboxToggleLinkedCycle);
  const sandboxAddPacket = useGameStore((s) => s.sandboxAddPacket);
  const sandboxInsertTreeKey = useGameStore((s) => s.sandboxInsertTreeKey);
  const sandboxRunTreeTraversal = useGameStore((s) => s.sandboxRunTreeTraversal);
  const sandboxAutoBalanceTree = useGameStore((s) => s.sandboxAutoBalanceTree);
  const sandboxRunDPTabulation = useGameStore((s) => s.sandboxRunDPTabulation);
  const sandboxHashInsert = useGameStore((s) => s.sandboxHashInsert);
  const sandboxHashRehash = useGameStore((s) => s.sandboxHashRehash);
  const sandboxHashToggleStrategy = useGameStore((s) => s.sandboxHashToggleStrategy);
  const sandboxHeapInsert = useGameStore((s) => s.sandboxHeapInsert);
  const sandboxHeapExtract = useGameStore((s) => s.sandboxHeapExtract);
  const sandboxHeapHeapify = useGameStore((s) => s.sandboxHeapHeapify);
  const handleDirectAction = useGameStore((s) => s.handleDirectAction);
  const runPathfindingSearch = useGameStore((s) => s.runPathfindingSearch);
  const comparePathfindingAlgorithms = useGameStore((s) => s.comparePathfindingAlgorithms);
  const setPathPaintTool = useGameStore((s) => s.setPathPaintTool);
  const setCodeDrawerOpen = useGameStore((s) => s.setCodeDrawerOpen);
  const triggerResetCamera = useGameStore((s) => s.triggerResetCamera);
  const toggleGraphicsQuality = useGameStore((s) => s.toggleGraphicsQuality);
  const toggleAudioMute = useGameStore((s) => s.toggleAudioMute);
  const playTimeline = useGameStore((s) => s.playTimeline);
  const pauseTimeline = useGameStore((s) => s.pauseTimeline);
  const stepForward = useGameStore((s) => s.stepForward);
  const stepBack = useGameStore((s) => s.stepBack);
  const seekTimeline = useGameStore((s) => s.seekTimeline);
  const rewindTimeline = useGameStore((s) => s.rewindTimeline);
  const setSpeed = useGameStore((s) => s.setSpeed);
  const clearToast = useGameStore((s) => s.clearToast);

  const [presetName, setPresetName] = useState('');
  const [presetsOpen, setPresetsOpen] = useState(false);
  const [treeKeyInput, setTreeKeyInput] = useState('');
  const [hashKeyInput, setHashKeyInput] = useState('');
  const [heapValInput, setHeapValInput] = useState('');

  const currentState = getCurrentState(timeline);
  const activeEvent = getActiveEvent(timeline);
  const totalEvents = timeline.events.length;

  const builtInForWorld = SANDBOX_PRESETS_BUILTIN.filter(
    (p) => p.worldId === sandboxWorld
  );
  const customForWorld = sandboxPresets.filter((p) => p.worldId === sandboxWorld);

  const handleSavePreset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!presetName.trim()) return;
    saveSandboxPreset(presetName);
    setPresetName('');
  };

  const handleTreeInsertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = treeKeyInput.trim();
    const parsed = trimmed === '' ? undefined : Number(trimmed);
    sandboxInsertTreeKey(parsed);
    setTreeKeyInput('');
  };

  const handleHashInsertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = hashKeyInput.trim();
    const parsed = trimmed === '' ? undefined : Number(trimmed);
    sandboxHashInsert(parsed);
    setHashKeyInput('');
  };

  const handleHeapInsertSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = heapValInput.trim();
    const parsed = trimmed === '' ? undefined : Number(trimmed);
    sandboxHeapInsert(parsed);
    setHeapValInput('');
  };

  // Compute best cost and fewest visited among found benchmark rows
  const foundRows = (pathComparison ?? []).filter((r) => r.pathFound);
  const minCost =
    foundRows.length > 0 ? Math.min(...foundRows.map((r) => r.pathCost)) : null;
  const minVisited =
    foundRows.length > 0 ? Math.min(...foundRows.map((r) => r.visitedCount)) : null;

  const renderWorldTools = () => {
    if (currentState.world === 'arrays') {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-700/60 bg-surface/85 px-2.5 py-1">
            <span className="text-[11px] font-mono text-slate-300">
              SIZE: {currentState.slots.length}
            </span>
            <input
              type="range"
              min={4}
              max={10}
              value={currentState.slots.length}
              onChange={(e) => setSandboxArraySize(Number(e.target.value))}
              className="h-1 w-20 accent-neon-cyan"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-mono text-slate-400">SORT:</span>
            {(['bubble', 'insertion', 'quick'] as const).map((algo) => (
              <button
                key={algo}
                onClick={() => runSandboxSortDemo(algo)}
                className="rounded-lg border border-sky-400/35 bg-sky-500/14 px-2.5 py-1 text-[11px] font-mono font-semibold uppercase text-sky-100 transition hover:bg-sky-500/25"
              >
                {algo}
              </button>
            ))}
          </div>
        </div>
      );
    }

    if (currentState.world === 'linked-lists') {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={sandboxAddLinkedNode}
            className="flex items-center gap-1 rounded-lg border border-sky-400/35 bg-sky-500/14 px-2.5 py-1.5 text-[11px] font-mono text-sky-100 transition hover:bg-sky-500/24"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>ADD NODE</span>
          </button>
          <button
            onClick={sandboxToggleLinkedCycle}
            className="flex items-center gap-1 rounded-lg border border-amber-400/35 bg-amber-500/14 px-2.5 py-1.5 text-[11px] font-mono text-amber-200 transition hover:bg-amber-500/24"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>{currentState.hasCycle ? 'SEVER CYCLE' : 'CREATE CYCLE'}</span>
          </button>
          <button
            onClick={() =>
              handleDirectAction({
                world: 'linked-lists',
                type: 'STEP_PROBE',
              })
            }
            className="flex items-center gap-1 rounded-lg border border-violet-400/40 bg-violet-500/16 px-2.5 py-1.5 text-[11px] font-mono text-violet-100 transition hover:bg-violet-500/26"
          >
            <Radar className="h-3.5 w-3.5" />
            <span>FLOYD PROBE</span>
          </button>
        </div>
      );
    }

    if (currentState.world === 'stacks-queues') {
      const buffers = Object.values(currentState.buffers);
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={sandboxAddPacket}
            className="flex items-center gap-1 rounded-lg border border-sky-400/35 bg-sky-500/14 px-2.5 py-1.5 text-[11px] font-mono text-sky-100 transition hover:bg-sky-500/24"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>ADD PACKET</span>
          </button>
          {buffers.map((buf) => (
            <div
              key={buf.id}
              className="flex items-center gap-1 rounded-lg border border-slate-700/60 bg-surface/85 px-2 py-1"
            >
              <span className="px-1 text-[11px] font-mono text-sky-200">
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
                className="rounded-md bg-sky-500/18 px-2 py-0.5 text-[11px] font-mono text-sky-100 transition hover:bg-sky-500/28 disabled:opacity-35"
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
                className="rounded-md bg-emerald-500/18 px-2 py-0.5 text-[11px] font-mono text-emerald-100 transition hover:bg-emerald-500/28 disabled:opacity-35"
              >
                OUT
              </button>
            </div>
          ))}
        </div>
      );
    }

    if (currentState.world === 'pathfinding') {
      const tools: Array<{ id: PathPaintTool; label: string }> = [
        { id: 'wall', label: 'Wall' },
        { id: 'weight', label: 'Weight' },
        { id: 'open', label: 'Open' },
        { id: 'start', label: 'Start' },
        { id: 'goal', label: 'Goal' },
      ];
      return (
        <div className="flex flex-wrap items-center gap-2">
          {/* Paint Tools */}
          <div className="flex items-center rounded-lg border border-slate-700/60 bg-surface/85 p-0.5">
            {tools.map((t) => (
              <button
                key={t.id}
                onClick={() => setPathPaintTool(t.id)}
                className={`rounded-md px-2 py-1 text-[11px] font-mono transition ${
                  pathPaintTool === t.id
                    ? 'bg-amber-500/22 font-semibold text-amber-200'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* 6-Algorithm Selector */}
          <div className="flex flex-wrap items-center rounded-lg border border-slate-700/60 bg-surface/85 p-0.5">
            {PATHFINDING_ALGOS.map((algo) => (
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
                  currentState.algorithm === algo.id
                    ? 'bg-sky-500/25 text-sky-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {algo.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => runPathfindingSearch(currentState.algorithm)}
            className="glow-emerald flex items-center gap-1 rounded-lg border border-emerald-400/50 bg-emerald-500/20 px-3 py-1.5 text-[11px] font-mono font-bold text-emerald-100 transition hover:bg-emerald-500/30"
          >
            <Radar className="h-3.5 w-3.5" />
            <span>RUN WAVE</span>
          </button>

          <button
            onClick={comparePathfindingAlgorithms}
            className="glow-violet flex items-center gap-1 rounded-lg border border-violet-400/45 bg-violet-500/18 px-3 py-1.5 text-[11px] font-mono font-bold text-violet-100 transition hover:bg-violet-500/28"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>COMPARE ALL</span>
          </button>
        </div>
      );
    }

    if (currentState.world === 'trees') {
      const selectedId = currentState.selectedNodeId;
      const selectedNode = selectedId ? currentState.nodes[selectedId] : null;
      return (
        <div className="flex flex-wrap items-center gap-2">
          {/* Numeric Key Insert */}
          <form onSubmit={handleTreeInsertSubmit} className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={99}
              value={treeKeyInput}
              onChange={(e) => setTreeKeyInput(e.target.value)}
              placeholder="Key"
              className="w-16 rounded-lg border border-slate-700/60 bg-surface/90 px-2 py-1 text-xs font-mono text-slate-100 placeholder-slate-500 focus:border-teal-400/60 focus:outline-none"
            />
            <button
              type="submit"
              className="flex items-center gap-1 rounded-lg border border-teal-400/45 bg-teal-500/16 px-2.5 py-1.5 text-[11px] font-mono font-semibold text-teal-100 transition hover:bg-teal-500/26"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>INSERT</span>
            </button>
          </form>

          {/* Traversal Waves */}
          <div className="flex items-center rounded-lg border border-slate-700/60 bg-surface/85 p-0.5">
            {TREE_TRAVERSALS.map((tr) => (
              <button
                key={tr.id}
                onClick={() => sandboxRunTreeTraversal(tr.id)}
                className="rounded-md px-2 py-1 text-[11px] font-mono font-semibold text-sky-200 transition hover:bg-sky-500/20 hover:text-sky-100"
              >
                {tr.label}
              </button>
            ))}
          </div>

          {/* Selected Node Rotations & Delete */}
          <div className="flex items-center gap-1">
            <button
              disabled={!selectedNode}
              title={
                selectedNode
                  ? `Rotate Left around ${selectedNode.value}`
                  : 'Select a node first'
              }
              onClick={() => {
                if (!selectedNode) return;
                handleDirectAction({
                  world: 'trees',
                  type: 'ROTATE_LEFT',
                  payload: { id: selectedNode.id },
                });
              }}
              className="flex items-center gap-1 rounded-lg border border-slate-700/60 bg-surface/85 px-2 py-1.5 text-[11px] font-mono text-teal-200 transition hover:border-teal-400/45 hover:bg-teal-500/15 disabled:opacity-35"
            >
              <RotateCcw className="h-3 w-3" />
              <span>ROT L</span>
            </button>
            <button
              disabled={!selectedNode}
              title={
                selectedNode
                  ? `Rotate Right around ${selectedNode.value}`
                  : 'Select a node first'
              }
              onClick={() => {
                if (!selectedNode) return;
                handleDirectAction({
                  world: 'trees',
                  type: 'ROTATE_RIGHT',
                  payload: { id: selectedNode.id },
                });
              }}
              className="flex items-center gap-1 rounded-lg border border-slate-700/60 bg-surface/85 px-2 py-1.5 text-[11px] font-mono text-violet-200 transition hover:border-violet-400/45 hover:bg-violet-500/15 disabled:opacity-35"
            >
              <RotateCw className="h-3 w-3" />
              <span>ROT R</span>
            </button>
            <button
              disabled={!selectedNode}
              title={
                selectedNode
                  ? `Delete node ${selectedNode.value}`
                  : 'Select a node first'
              }
              onClick={() => {
                if (!selectedNode) return;
                handleDirectAction({
                  world: 'trees',
                  type: 'DELETE_NODE',
                  payload: { id: selectedNode.id },
                });
              }}
              className="flex items-center gap-1 rounded-lg border border-rose-400/35 bg-rose-500/12 px-2 py-1.5 text-[11px] font-mono text-rose-200 transition hover:bg-rose-500/22 disabled:opacity-35"
            >
              <Trash2 className="h-3 w-3" />
              <span>DEL</span>
            </button>
          </div>

          {/* AUTO-AVL Rebalance */}
          <button
            onClick={sandboxAutoBalanceTree}
            className="glow-teal flex items-center gap-1 rounded-lg border border-teal-400/50 bg-teal-500/20 px-3 py-1.5 text-[11px] font-mono font-bold text-teal-100 transition hover:bg-teal-500/30"
          >
            <Scale className="h-3.5 w-3.5 text-neon-teal" />
            <span>AUTO-AVL</span>
          </button>
        </div>
      );
    }

    if (currentState.world === 'dp') {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={sandboxRunDPTabulation}
            className="glow-indigo flex items-center gap-1.5 rounded-lg border border-indigo-400/50 bg-indigo-500/20 px-3 py-1.5 text-[11px] font-mono font-bold text-indigo-100 transition hover:bg-indigo-500/30"
          >
            <Play className="h-3.5 w-3.5 fill-indigo-300 text-indigo-300" />
            <span>RUN TABULATION</span>
          </button>
          <button
            onClick={() =>
              handleDirectAction({
                world: 'dp',
                type: 'TRACE_OPTIMAL',
              })
            }
            className="flex items-center gap-1.5 rounded-lg border border-sky-400/40 bg-sky-500/14 px-3 py-1.5 text-[11px] font-mono font-semibold text-sky-100 transition hover:bg-sky-500/24"
          >
            <GitMerge className="h-3.5 w-3.5 text-neon-cyan" />
            <span>TRACE OPTIMAL</span>
          </button>
        </div>
      );
    }

    if (currentState.world === 'hash-table') {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleHashInsertSubmit} className="flex items-center gap-1">
            <input
              type="number"
              min={0}
              max={999}
              value={hashKeyInput}
              onChange={(e) => setHashKeyInput(e.target.value)}
              placeholder="Key"
              className="w-16 rounded-lg border border-slate-700/60 bg-surface/90 px-2 py-1 text-xs font-mono text-slate-100 placeholder-slate-500 focus:border-orange-400/60 focus:outline-none"
            />
            <button
              type="submit"
              className="flex items-center gap-1 rounded-lg border border-orange-400/45 bg-orange-500/18 px-2.5 py-1.5 text-[11px] font-mono font-semibold text-orange-100 transition hover:bg-orange-500/28"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>INSERT</span>
            </button>
          </form>

          <button
            onClick={sandboxHashToggleStrategy}
            className="rounded-lg border border-slate-700/60 bg-surface/85 px-2.5 py-1.5 text-[11px] font-mono font-semibold text-amber-200 transition hover:border-orange-400/45"
          >
            MODE: {currentState.strategy === 'linear' ? 'LINEAR' : 'CHAINING'}
          </button>

          <button
            onClick={sandboxHashRehash}
            className="glow-orange flex items-center gap-1 rounded-lg border border-orange-400/50 bg-orange-500/20 px-3 py-1.5 text-[11px] font-mono font-bold text-orange-100 transition hover:bg-orange-500/30"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>REHASH 2x</span>
          </button>
        </div>
      );
    }

    if (currentState.world === 'heap') {
      const hasSelected =
        currentState.selectedIndex !== null &&
        currentState.selectedIndex >= 0 &&
        currentState.selectedIndex < currentState.items.length;

      return (
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleHeapInsertSubmit} className="flex items-center gap-1">
            <input
              type="number"
              min={1}
              max={99}
              value={heapValInput}
              onChange={(e) => setHeapValInput(e.target.value)}
              placeholder="Val"
              className="w-16 rounded-lg border border-slate-700/60 bg-surface/90 px-2 py-1 text-xs font-mono text-slate-100 placeholder-slate-500 focus:border-pink-400/60 focus:outline-none"
            />
            <button
              type="submit"
              className="flex items-center gap-1 rounded-lg border border-pink-400/45 bg-pink-500/18 px-2.5 py-1.5 text-[11px] font-mono font-semibold text-pink-100 transition hover:bg-pink-500/28"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>INSERT</span>
            </button>
          </form>

          <button
            onClick={sandboxHeapExtract}
            disabled={currentState.items.length === 0}
            className="flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-mono font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:opacity-35"
          >
            <ArrowUp className="h-3.5 w-3.5 text-neon-emerald" />
            <span>EXTRACT</span>
          </button>

          <button
            onClick={sandboxHeapHeapify}
            className="glow-rose flex items-center gap-1 rounded-lg border border-pink-400/50 bg-pink-500/20 px-2.5 py-1.5 text-[11px] font-mono font-bold text-pink-100 transition hover:bg-pink-500/30"
          >
            <Layers className="h-3.5 w-3.5" />
            <span>HEAPIFY</span>
          </button>

          {hasSelected && (
            <div className="flex items-center gap-1">
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
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3">
      {/* TOP SANDBOX BAR */}
      <header className="glass-panel pointer-events-auto flex flex-wrap items-center justify-between gap-2 rounded-2xl px-3.5 py-2">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={goToHub}
            className="flex items-center gap-1 rounded-lg border border-slate-700/60 bg-surface/80 px-2.5 py-1.5 text-xs font-mono text-slate-300 transition hover:border-sky-400/45 hover:text-sky-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>HUB</span>
          </button>

          <div className="flex items-center gap-1.5 rounded-lg border border-violet-400/35 bg-violet-500/14 px-2.5 py-1">
            <FlaskConical className="h-3.5 w-3.5 text-neon-violet" />
            <span className="text-xs font-mono font-bold text-violet-200">
              SANDBOX LAB
            </span>
          </div>

          {/* 8 World Tabs */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-700/60 bg-surface/80 p-0.5">
            {WORLD_META.map((w) => {
              const active = sandboxWorld === w.id;
              const activeClass =
                w.id === 'trees'
                  ? 'bg-teal-500/22 font-bold text-teal-100'
                  : w.id === 'dp'
                    ? 'bg-indigo-500/24 font-bold text-indigo-100'
                    : w.id === 'hash-table'
                      ? 'bg-orange-500/22 font-bold text-orange-100'
                      : w.id === 'heap'
                        ? 'bg-pink-500/22 font-bold text-pink-100'
                        : 'bg-sky-500/22 font-bold text-sky-100';
              return (
                <button
                  key={w.id}
                  onClick={() => setSandboxWorld(w.id as WorldId)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-mono transition ${
                    active ? activeClass : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {w.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Presets + Randomize + Reset + Settings */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => setPresetsOpen((v) => !v)}
            className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-mono transition ${
              presetsOpen
                ? 'border-sky-400/50 bg-sky-500/18 text-sky-100'
                : 'border-slate-700/60 bg-surface/80 text-slate-300 hover:border-sky-400/40'
            }`}
          >
            <Save className="h-3.5 w-3.5" />
            <span>PRESETS</span>
          </button>

          <button
            onClick={randomizeSandbox}
            title="Randomize Board"
            className="flex items-center gap-1 rounded-lg border border-slate-700/60 bg-surface/80 px-2.5 py-1.5 text-xs font-mono text-slate-300 transition hover:border-amber-400/45 hover:text-amber-200"
          >
            <Shuffle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">RANDOM</span>
          </button>

          <button
            onClick={resetSandbox}
            title="Reset Sandbox"
            className="rounded-lg border border-slate-700/60 bg-surface/80 p-1.5 text-slate-300 transition hover:border-slate-500/70 hover:text-slate-100"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={triggerResetCamera}
            title="Reset Camera"
            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-800/80 hover:text-sky-300"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={toggleGraphicsQuality}
            className="rounded-lg bg-surface/80 px-2 py-1 text-[11px] font-mono text-sky-200"
          >
            <Sparkles className="mr-1 inline h-3 w-3" />
            {graphicsQuality === 'high' ? 'HI' : 'ECO'}
          </button>

          <button
            onClick={toggleAudioMute}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800/80"
          >
            {audioMuted ? (
              <VolumeX className="h-3.5 w-3.5 text-neon-crimson" />
            ) : (
              <Volume2 className="h-3.5 w-3.5 text-neon-cyan" />
            )}
          </button>
        </div>
      </header>

      {/* FLOATING PANELS: Presets Popover + Pathfinding Comparison Table + Toast */}
      <div className="pointer-events-none relative flex flex-1 items-start justify-between py-2">
        {/* Left: Presets Drawer */}
        <AnimatePresence>
          {presetsOpen && (
            <motion.div
              initial={{ x: -280, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -280, opacity: 0 }}
              className="glass-panel pointer-events-auto flex max-h-[65vh] w-72 flex-col overflow-hidden rounded-2xl p-3.5"
            >
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-sky-200">
                  SANDBOX PRESETS
                </span>
                <button
                  onClick={() => setPresetsOpen(false)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-800/80 hover:text-slate-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Save Current Form */}
              <form onSubmit={handleSavePreset} className="mb-3 flex gap-1.5">
                <input
                  type="text"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="Save current board..."
                  className="min-w-0 flex-1 rounded-lg border border-slate-700/60 bg-surface/90 px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:border-sky-400/60 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-sky-400/45 bg-sky-500/18 px-2.5 py-1.5 text-xs font-mono font-bold text-sky-100 hover:bg-sky-500/28"
                >
                  SAVE
                </button>
              </form>

              <div className="axiom-scroll flex-1 space-y-3 overflow-y-auto pr-1">
                {/* Built-in */}
                <div>
                  <div className="mb-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    BUILT-IN TEMPLATES
                  </div>
                  <div className="space-y-1.5">
                    {builtInForWorld.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => loadSandboxPreset(preset)}
                        className="w-full rounded-lg border border-slate-700/50 bg-surface/75 px-2.5 py-1.5 text-left text-xs text-slate-200 transition hover:border-sky-400/45 hover:text-sky-100"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Saved */}
                <div>
                  <div className="mb-1.5 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    SAVED LOCAL PRESETS ({customForWorld.length})
                  </div>
                  {customForWorld.length === 0 ? (
                    <div className="text-xs text-slate-400">
                      No custom presets saved yet.
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {customForWorld.map((preset) => (
                        <div
                          key={preset.id}
                          className="flex items-center justify-between gap-1 rounded-lg border border-slate-700/50 bg-surface/75 px-2.5 py-1"
                        >
                          <button
                            onClick={() => loadSandboxPreset(preset)}
                            className="min-w-0 flex-1 truncate text-left text-xs text-emerald-200 hover:underline"
                          >
                            {preset.name}
                          </button>
                          <button
                            onClick={() => deleteSandboxPreset(preset.id)}
                            title="Delete Preset"
                            className="p-1 text-slate-400 hover:text-neon-crimson"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center Toast */}
        <AnimatePresence>
          {statusToast && (
            <motion.div
              initial={{ y: -10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              className="pointer-events-auto mx-auto flex items-center gap-2 rounded-full border border-sky-400/45 bg-surface/95 px-4 py-1.5 text-xs font-mono text-sky-100 shadow-lg backdrop-blur-md"
            >
              <span>{statusToast.message}</span>
              <button onClick={clearToast} className="opacity-75 hover:opacity-100">
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right: 6-Algorithm Pathfinding Benchmark Table */}
        <AnimatePresence>
          {pathComparison && sandboxWorld === 'pathfinding' && !codeDrawerOpen && (
            <motion.div
              initial={{ x: 260, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 260, opacity: 0 }}
              className="glass-panel pointer-events-auto ml-auto w-[340px] rounded-2xl p-4"
            >
              <div className="mb-2.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-violet-200">
                  <BarChart3 className="h-3.5 w-3.5 text-neon-violet" />
                  ALGORITHM BENCHMARK
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  6 Search Strategies
                </span>
              </div>
              <table className="w-full text-left font-mono text-xs">
                <thead>
                  <tr className="border-b border-slate-700/60 text-[10px] text-slate-400">
                    <th className="py-1.5">ALGO</th>
                    <th className="py-1.5 text-right">COST</th>
                    <th className="py-1.5 text-right">VISITED</th>
                    <th className="py-1.5 text-right">FRONTIER</th>
                  </tr>
                </thead>
                <tbody>
                  {pathComparison.map((row) => {
                    const meta = PATHFINDING_ALGOS.find((a) => a.id === row.algorithm);
                    const isBestCost =
                      row.pathFound && minCost !== null && row.pathCost === minCost;
                    const isBestVisited =
                      row.pathFound &&
                      minVisited !== null &&
                      row.visitedCount === minVisited;
                    return (
                      <tr
                        key={row.algorithm}
                        className="border-b border-slate-800/60 last:border-0"
                      >
                        <td className="py-1.5 font-semibold text-slate-200">
                          {meta ? meta.full : row.algorithm}
                        </td>
                        <td className="py-1.5 text-right">
                          {row.pathFound ? (
                            <span
                              className={
                                isBestCost
                                  ? 'rounded bg-emerald-500/18 px-1.5 py-0.5 font-bold text-neon-emerald'
                                  : 'text-slate-300'
                              }
                            >
                              {row.pathCost}
                            </span>
                          ) : (
                            <span className="text-rose-300">N/A</span>
                          )}
                        </td>
                        <td className="py-1.5 text-right">
                          <span
                            className={
                              isBestVisited
                                ? 'rounded bg-sky-500/18 px-1.5 py-0.5 font-bold text-neon-cyan'
                                : 'text-amber-200/90'
                            }
                          >
                            {row.visitedCount}
                          </span>
                        </td>
                        <td className="py-1.5 text-right text-violet-300">
                          {row.peakFrontier}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* BOTTOM SANDBOX DOCK */}
      <footer className="glass-panel pointer-events-auto flex flex-col gap-2 rounded-2xl px-3.5 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono text-xs text-slate-400">
            <span>
              CYCLES: <strong className="text-neon-cyan">{metrics.cycles}</strong>
            </span>
            <span>•</span>
            <span>
              MEM: <strong className="text-neon-violet">{metrics.auxMemory}</strong>
            </span>
          </div>

          <div className="flex items-center justify-center">{renderWorldTools()}</div>

          <button
            onClick={() => setCodeDrawerOpen(!codeDrawerOpen)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-mono transition ${
              codeDrawerOpen
                ? 'border-emerald-400/50 bg-emerald-500/18 text-emerald-100'
                : 'border-slate-700/60 bg-surface/80 text-slate-300 hover:border-emerald-400/40'
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>JS CODE</span>
          </button>
        </div>

        {/* Shared Playback Scrubber */}
        <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-700/50 pt-2">
          <div className="flex items-center gap-1">
            <button
              onClick={rewindTimeline}
              disabled={totalEvents === 0}
              className="rounded-md p-1.5 text-slate-300 hover:bg-slate-800/80 disabled:opacity-35"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={stepBack}
              disabled={timeline.cursor <= -1}
              className="rounded-md p-1.5 text-slate-300 hover:bg-slate-800/80 disabled:opacity-35"
            >
              <StepBack className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={timeline.isPlaying ? pauseTimeline : playTimeline}
              disabled={totalEvents === 0}
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
              className="rounded-md p-1.5 text-slate-300 hover:bg-slate-800/80 disabled:opacity-35"
            >
              <SkipForward className="h-3.5 w-3.5" />
            </button>
          </div>

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

          <div className="hidden max-w-xs truncate rounded-full border border-slate-700/60 bg-surface/80 px-3 py-1 font-mono text-[11px] text-sky-200 md:block">
            {activeEvent ? `[${activeEvent.type}] ${activeEvent.label}` : 'SANDBOX READY'}
          </div>
        </div>
      </footer>
    </div>
  );
};
