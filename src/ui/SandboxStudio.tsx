import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  BarChart3,
  Camera,
  Code2,
  FlaskConical,
  Pause,
  Play,
  Plus,
  Radar,
  RefreshCw,
  RotateCcw,
  Save,
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
import type { PathfindingAlgorithm, PlaybackSpeed, WorldId } from '../engine/types';

const SPEEDS: PlaybackSpeed[] = [0.5, 1, 2, 4];

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

  const renderWorldTools = () => {
    if (currentState.world === 'arrays') {
      return (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-slate-700/80 bg-slate-950/80 px-2.5 py-1">
            <span className="text-[10px] font-mono text-slate-400">
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
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-mono text-slate-500">SORT:</span>
            {(['bubble', 'insertion', 'quick'] as const).map((algo) => (
              <button
                key={algo}
                onClick={() => runSandboxSortDemo(algo)}
                className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1 text-[10px] font-mono font-semibold uppercase text-cyan-200 transition hover:bg-cyan-500/30"
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
            className="flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1.5 text-[11px] font-mono text-cyan-200 transition hover:bg-cyan-500/25"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>ADD NODE</span>
          </button>
          <button
            onClick={sandboxToggleLinkedCycle}
            className="flex items-center gap-1 rounded-lg border border-amber-500/40 bg-amber-500/15 px-2.5 py-1.5 text-[11px] font-mono text-amber-200 transition hover:bg-amber-500/25"
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
            className="flex items-center gap-1 rounded-lg border border-violet-400/50 bg-violet-500/20 px-2.5 py-1.5 text-[11px] font-mono text-violet-100 transition hover:bg-violet-500/30"
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
            className="flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-2.5 py-1.5 text-[11px] font-mono text-cyan-200 transition hover:bg-cyan-500/25"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>ADD PACKET</span>
          </button>
          {buffers.map((buf) => (
            <div
              key={buf.id}
              className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/80 px-1.5 py-1"
            >
              <span className="px-1 text-[10px] font-mono text-cyan-300">
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
                className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-mono text-cyan-100 disabled:opacity-35"
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
                className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-100 disabled:opacity-35"
              >
                OUT
              </button>
            </div>
          ))}
        </div>
      );
    }

    if (currentState.world === 'pathfinding') {
      const algos: PathfindingAlgorithm[] = ['bfs', 'dijkstra', 'astar'];
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
          <div className="flex items-center rounded-lg border border-slate-700/80 bg-slate-950/80 p-0.5">
            {tools.map((t) => (
              <button
                key={t.id}
                onClick={() => setPathPaintTool(t.id)}
                className={`rounded px-2 py-1 text-[10px] font-mono transition ${
                  pathPaintTool === t.id
                    ? 'bg-amber-500/25 font-bold text-amber-200'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Algorithm Selector */}
          <div className="flex items-center rounded-lg border border-slate-700/80 bg-slate-950/80 p-0.5">
            {algos.map((algo) => (
              <button
                key={algo}
                onClick={() =>
                  handleDirectAction({
                    world: 'pathfinding',
                    type: 'SET_ALGORITHM',
                    payload: { algorithm: algo },
                  })
                }
                className={`rounded px-2 py-1 text-[10px] font-mono font-bold uppercase transition ${
                  currentState.algorithm === algo
                    ? 'bg-cyan-500/30 text-cyan-100'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {algo === 'astar' ? 'A*' : algo}
              </button>
            ))}
          </div>

          <button
            onClick={() => runPathfindingSearch(currentState.algorithm)}
            className="glow-emerald flex items-center gap-1 rounded-lg border border-emerald-400/70 bg-emerald-500/25 px-3 py-1.5 text-[11px] font-mono font-bold text-emerald-100 transition hover:bg-emerald-500/35"
          >
            <Radar className="h-3.5 w-3.5" />
            <span>RUN WAVE</span>
          </button>

          <button
            onClick={comparePathfindingAlgorithms}
            className="glow-violet flex items-center gap-1 rounded-lg border border-violet-400/60 bg-violet-500/20 px-3 py-1.5 text-[11px] font-mono font-bold text-violet-100 transition hover:bg-violet-500/30"
          >
            <BarChart3 className="h-3.5 w-3.5" />
            <span>COMPARE ALL</span>
          </button>
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
            className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/75 px-2.5 py-1.5 text-xs font-mono text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>HUB</span>
          </button>

          <div className="flex items-center gap-1.5 rounded-lg border border-violet-400/40 bg-violet-500/15 px-2.5 py-1">
            <FlaskConical className="h-3.5 w-3.5 text-neon-violet" />
            <span className="text-xs font-mono font-bold text-violet-200">
              SANDBOX LAB
            </span>
          </div>

          {/* 4 World Tabs */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-800 bg-slate-950/75 p-0.5">
            {WORLD_META.map((w) => {
              const active = sandboxWorld === w.id;
              return (
                <button
                  key={w.id}
                  onClick={() => setSandboxWorld(w.id as WorldId)}
                  className={`rounded-lg px-2.5 py-1 text-[11px] font-mono transition ${
                    active
                      ? 'bg-cyan-500/25 font-bold text-cyan-100'
                      : 'text-slate-400 hover:text-slate-200'
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
                ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100'
                : 'border-slate-700/80 bg-slate-900/75 text-slate-300 hover:border-cyan-400/40'
            }`}
          >
            <Save className="h-3.5 w-3.5" />
            <span>PRESETS</span>
          </button>

          <button
            onClick={randomizeSandbox}
            title="Randomize Board"
            className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/75 px-2.5 py-1.5 text-xs font-mono text-slate-300 transition hover:border-amber-400/50 hover:text-amber-200"
          >
            <Shuffle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">RANDOM</span>
          </button>

          <button
            onClick={resetSandbox}
            title="Reset Sandbox"
            className="rounded-lg border border-slate-700/80 bg-slate-900/75 p-1.5 text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={triggerResetCamera}
            title="Reset Camera"
            className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-cyan-300"
          >
            <Camera className="h-3.5 w-3.5" />
          </button>

          <button
            onClick={toggleGraphicsQuality}
            className="rounded-lg bg-slate-900/80 px-2 py-1 text-[10px] font-mono text-cyan-200"
          >
            <Sparkles className="mr-1 inline h-3 w-3" />
            {graphicsQuality === 'high' ? 'HI' : 'ECO'}
          </button>

          <button
            onClick={toggleAudioMute}
            className="rounded-lg p-1.5 text-slate-300 hover:bg-slate-800"
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
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-cyan-200">
                  SANDBOX PRESETS
                </span>
                <button
                  onClick={() => setPresetsOpen(false)}
                  className="text-slate-400 hover:text-white"
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
                  className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-950/90 px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none"
                />
                <button
                  type="submit"
                  className="rounded-lg border border-cyan-400/60 bg-cyan-500/20 px-2.5 py-1.5 text-xs font-mono font-bold text-cyan-100 hover:bg-cyan-500/30"
                >
                  SAVE
                </button>
              </form>

              <div className="axiom-scroll flex-1 space-y-3 overflow-y-auto pr-1">
                {/* Built-in */}
                <div>
                  <div className="mb-1 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    BUILT-IN TEMPLATES
                  </div>
                  <div className="space-y-1">
                    {builtInForWorld.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => loadSandboxPreset(preset)}
                        className="w-full rounded-lg border border-slate-800 bg-slate-950/75 px-2.5 py-1.5 text-left text-xs text-slate-200 transition hover:border-cyan-400/50 hover:text-cyan-200"
                      >
                        {preset.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom Saved */}
                <div>
                  <div className="mb-1 text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    SAVED LOCAL PRESETS ({customForWorld.length})
                  </div>
                  {customForWorld.length === 0 ? (
                    <div className="text-[11px] text-slate-500">
                      No custom presets saved yet.
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {customForWorld.map((preset) => (
                        <div
                          key={preset.id}
                          className="flex items-center justify-between gap-1 rounded-lg border border-slate-800 bg-slate-950/75 px-2 py-1"
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
                            className="p-1 text-slate-500 hover:text-neon-crimson"
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
              className="pointer-events-auto mx-auto flex items-center gap-2 rounded-full border border-cyan-500/50 bg-slate-900/90 px-4 py-1.5 text-xs font-mono text-cyan-100"
            >
              <span>{statusToast.message}</span>
              <button onClick={clearToast}>
                <X className="h-3.5 w-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right: Pathfinding Comparison Table */}
        <AnimatePresence>
          {pathComparison && sandboxWorld === 'pathfinding' && !codeDrawerOpen && (
            <motion.div
              initial={{ x: 260, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 260, opacity: 0 }}
              className="glass-panel pointer-events-auto ml-auto w-80 rounded-2xl p-4"
            >
              <div className="mb-2.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-violet-200">
                  <BarChart3 className="h-3.5 w-3.5 text-neon-violet" />
                  ALGORITHM BENCHMARK
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  BFS vs Dijkstra vs A*
                </span>
              </div>
              <table className="w-full text-left font-mono text-[11px]">
                <thead>
                  <tr className="border-b border-slate-800 text-[10px] text-slate-500">
                    <th className="py-1">ALGO</th>
                    <th className="py-1 text-right">COST</th>
                    <th className="py-1 text-right">VISITED</th>
                    <th className="py-1 text-right">FRONTIER</th>
                  </tr>
                </thead>
                <tbody>
                  {pathComparison.map((row) => (
                    <tr
                      key={row.algorithm}
                      className="border-b border-slate-800/50 last:border-0"
                    >
                      <td className="py-1.5 font-bold uppercase text-cyan-200">
                        {row.algorithm === 'astar' ? 'A*' : row.algorithm}
                      </td>
                      <td className="py-1.5 text-right text-emerald-300">
                        {row.pathFound ? row.pathCost : 'N/A'}
                      </td>
                      <td className="py-1.5 text-right text-amber-200">
                        {row.visitedCount}
                      </td>
                      <td className="py-1.5 text-right text-violet-300">
                        {row.peakFrontier}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* BOTTOM SANDBOX DOCK */}
      <footer className="glass-panel pointer-events-auto flex flex-col gap-2 rounded-2xl px-3.5 py-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 font-mono text-[11px] text-slate-400">
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
                ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                : 'border-slate-700/80 bg-slate-900/75 text-slate-300 hover:border-emerald-400/40'
            }`}
          >
            <Code2 className="h-3.5 w-3.5" />
            <span>JS CODE</span>
          </button>
        </div>

        {/* Shared Playback Scrubber */}
        <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-800/80 pt-2">
          <div className="flex items-center gap-1">
            <button
              onClick={rewindTimeline}
              disabled={totalEvents === 0}
              className="rounded-md p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-35"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={stepBack}
              disabled={timeline.cursor <= -1}
              className="rounded-md p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-35"
            >
              <StepBack className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={timeline.isPlaying ? pauseTimeline : playTimeline}
              disabled={totalEvents === 0}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-400/50 bg-cyan-500/20 text-cyan-200 disabled:opacity-35"
            >
              {timeline.isPlaying ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5 fill-cyan-300" />
              )}
            </button>
            <button
              onClick={stepForward}
              disabled={timeline.cursor >= totalEvents - 1}
              className="rounded-md p-1.5 text-slate-300 hover:bg-slate-800 disabled:opacity-35"
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
            <span className="w-12 shrink-0 text-right font-mono text-[10px] text-slate-400">
              {timeline.cursor + 1}/{totalEvents}
            </span>
          </div>

          <div className="flex items-center rounded-md border border-slate-800 bg-slate-950/75 p-0.5">
            {SPEEDS.map((spd) => (
              <button
                key={spd}
                onClick={() => setSpeed(spd)}
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${
                  timeline.speed === spd
                    ? 'bg-cyan-500/30 font-bold text-cyan-200'
                    : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          <div className="hidden max-w-xs truncate rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 font-mono text-[10px] text-cyan-300/90 md:block">
            {activeEvent ? `[${activeEvent.type}] ${activeEvent.label}` : 'SANDBOX READY'}
          </div>
        </div>
      </footer>
    </div>
  );
};
