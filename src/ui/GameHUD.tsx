import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code2,
  Cpu,
  FileCode2,
  Music,
  Pause,
  Play,
  Radar,
  RotateCcw,
  SkipBack,
  SkipForward,
  Sparkles,
  StepBack,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { useGameStore, type PathPaintTool } from '../store/useGameStore';
import { getLevelById } from '../levels/index';
import { getActiveEvent, getCurrentState } from '../engine/timeline';
import type { PathfindingAlgorithm, PlaybackSpeed } from '../engine/types';

const SPEEDS: PlaybackSpeed[] = [0.5, 1, 2, 4];

export const GameHUD: React.FC = () => {
  const activeLevelId = useGameStore((s) => s.activeLevelId);
  const timeline = useGameStore((s) => s.timeline);
  const metrics = useGameStore((s) => s.metrics);
  const codeDrawerOpen = useGameStore((s) => s.codeDrawerOpen);
  const pseudocodeOpen = useGameStore((s) => s.pseudocodeOpen);
  const audioMuted = useGameStore((s) => s.audioMuted);
  const ambientEnabled = useGameStore((s) => s.ambientEnabled);
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);
  const pathPaintTool = useGameStore((s) => s.pathPaintTool);
  const statusToast = useGameStore((s) => s.statusToast);

  const goToHub = useGameStore((s) => s.goToHub);
  const resetLevel = useGameStore((s) => s.resetLevel);
  const validateCurrentLevel = useGameStore((s) => s.validateCurrentLevel);
  const setCodeDrawerOpen = useGameStore((s) => s.setCodeDrawerOpen);
  const setPseudocodeOpen = useGameStore((s) => s.setPseudocodeOpen);
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

  const currentState = getCurrentState(timeline);
  const activeEvent = getActiveEvent(timeline);
  const totalEvents = timeline.events.length;

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

  const renderWorldQuickControls = () => {
    if (currentState.world === 'arrays') {
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
              className="flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-mono text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>SLIDE L</span>
            </button>
            <span className="rounded bg-slate-900/90 px-2 py-1 text-[10px] font-mono text-slate-300">
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
              className="flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-mono text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-40"
            >
              <span>SLIDE R</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      }
      return (
        <span className="hidden text-[11px] font-mono text-slate-400 xl:inline">
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
              className="glow-violet flex items-center gap-1.5 rounded-lg border border-violet-400/60 bg-violet-500/20 px-3 py-1.5 text-[11px] font-mono font-semibold text-violet-100 transition hover:bg-violet-500/30"
            >
              <Radar className="h-3.5 w-3.5 text-neon-violet" />
              <span>STEP PROBE (1x/2x)</span>
            </button>
          )}
          <span className="hidden text-[11px] font-mono text-slate-400 xl:inline">
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
              className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/80 px-1.5 py-1"
            >
              <span className="px-1 text-[10px] font-mono font-semibold text-cyan-300">
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
                className="rounded bg-cyan-500/20 px-2 py-0.5 text-[10px] font-mono text-cyan-100 transition hover:bg-cyan-500/35 disabled:opacity-35"
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
                className="rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono text-emerald-100 transition hover:bg-emerald-500/35 disabled:opacity-35"
              >
                OUT
              </button>
            </div>
          ))}
          {buffers.length === 2 && (
            <button
              disabled={buffers[0].items.length === 0}
              onClick={() =>
                handleDirectAction({
                  world: 'stacks-queues',
                  type: 'TRANSFER',
                  payload: { fromId: buffers[0].id, toId: buffers[1].id },
                })
              }
              className="rounded-lg border border-violet-400/50 bg-violet-500/15 px-2.5 py-1.5 text-[10px] font-mono text-violet-200 transition hover:bg-violet-500/25 disabled:opacity-35"
            >
              {buffers[0].label} → {buffers[1].label}
            </button>
          )}
        </div>
      );
    }

    if (currentState.world === 'pathfinding') {
      const algos: PathfindingAlgorithm[] = ['bfs', 'dijkstra', 'astar'];
      const tools: Array<{ id: PathPaintTool; label: string }> = [
        { id: 'wall', label: 'Wall' },
        { id: 'weight', label: 'Weight' },
        { id: 'open', label: 'Open' },
      ];
      return (
        <div className="flex flex-wrap items-center gap-2">
          {/* Algorithm Selector */}
          <div className="flex items-center rounded-lg border border-slate-700/80 bg-slate-950/80 p-0.5">
            {algos.map((algo) => {
              const active = currentState.algorithm === algo;
              return (
                <button
                  key={algo}
                  onClick={() =>
                    handleDirectAction({
                      world: 'pathfinding',
                      type: 'SET_ALGORITHM',
                      payload: { algorithm: algo },
                    })
                  }
                  className={`rounded-md px-2.5 py-1 text-[10px] font-mono font-bold uppercase transition ${
                    active
                      ? 'bg-cyan-500/30 text-cyan-100 shadow-[0_0_10px_rgba(0,240,255,0.3)]'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {algo === 'astar' ? 'A*' : algo}
                </button>
              );
            })}
          </div>

          {/* Paint Tools */}
          <div className="hidden items-center rounded-lg border border-slate-700/80 bg-slate-950/80 p-0.5 sm:flex">
            {tools.map((t) => (
              <button
                key={t.id}
                onClick={() => setPathPaintTool(t.id)}
                className={`rounded-md px-2 py-1 text-[10px] font-mono transition ${
                  pathPaintTool === t.id
                    ? 'bg-amber-500/25 text-amber-200'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Pulsing RUN WAVE Button */}
          <button
            onClick={() => runPathfindingSearch(currentState.algorithm)}
            className="glow-emerald flex items-center gap-1.5 rounded-lg border border-emerald-400/70 bg-emerald-500/25 px-3.5 py-1.5 text-xs font-mono font-bold text-emerald-100 transition hover:bg-emerald-500/35"
          >
            <Radar className="h-3.5 w-3.5 animate-pulse text-neon-emerald" />
            <span>RUN WAVE</span>
          </button>
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
            className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/75 px-2.5 py-1.5 text-xs font-mono text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">HUB</span>
          </button>

          <div className="flex items-center gap-2 rounded-lg border border-cyan-500/35 bg-cyan-500/10 px-2.5 py-1">
            <span className="text-xs font-mono font-bold text-neon-cyan">
              {level.code}
            </span>
            <span className="text-xs font-semibold tracking-wide text-white uppercase">
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
          <div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/75 px-2.5 py-1 font-mono text-xs">
            <Cpu className="h-3.5 w-3.5 text-slate-400" />
            <span className={`font-bold ${cycleColor}`}>{metrics.cycles}</span>
            <span className="text-[10px] text-slate-500">
              / S:{level.par.sRankCycles}
            </span>
          </div>

          {/* Aux Memory Meter */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950/75 px-2.5 py-1 font-mono text-xs">
            <span className="text-[10px] text-slate-400">MEM</span>
            <span className={`font-bold ${memColor}`}>{metrics.auxMemory}</span>
            <span className="text-[10px] text-slate-500">
              /{level.par.maxAuxMemory}
            </span>
          </div>

          {/* Big-O Target Badge */}
          <span className="hidden rounded-lg border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-mono font-semibold text-amber-200 md:inline">
            {level.par.targetBigO}
          </span>

          {/* Camera / Graphics / Audio */}
          <div className="flex items-center gap-1 border-l border-slate-800 pl-2">
            <button
              onClick={triggerResetCamera}
              title="Reset Isometric Camera"
              className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-cyan-300"
            >
              <Camera className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={toggleGraphicsQuality}
              title={`Graphics: ${graphicsQuality.toUpperCase()}`}
              className={`rounded-lg px-2 py-1 text-[10px] font-mono transition ${
                graphicsQuality === 'high'
                  ? 'bg-cyan-500/15 text-cyan-200'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              <Sparkles className="inline h-3 w-3 mr-1" />
              {graphicsQuality === 'high' ? 'HI' : 'ECO'}
            </button>
            <button
              onClick={toggleAmbient}
              title="Toggle Ambient Pad"
              className={`rounded-lg p-1.5 transition ${
                ambientEnabled && !audioMuted
                  ? 'bg-violet-500/20 text-violet-300'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Music className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={toggleAudioMute}
              title={audioMuted ? 'Unmute Audio' : 'Mute Audio'}
              className="rounded-lg p-1.5 text-slate-300 transition hover:bg-slate-800"
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
          {/* Left: Pseudocode Toggle */}
          <button
            onClick={() => setPseudocodeOpen(!pseudocodeOpen)}
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-mono transition ${
              pseudocodeOpen
                ? 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100'
                : 'border-slate-700/80 bg-slate-900/75 text-slate-300 hover:border-cyan-400/40'
            }`}
          >
            <FileCode2 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">PSEUDOCODE</span>
          </button>

          {/* Center: World-Specific Tactile Controls */}
          <div className="flex items-center justify-center">
            {renderWorldQuickControls()}
          </div>

          {/* Right: Reset + Check/Validate + Code Drawer Toggle */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={resetLevel}
              title="Reset Level"
              className="flex items-center gap-1 rounded-lg border border-slate-700/80 bg-slate-900/75 px-2.5 py-1.5 text-xs font-mono text-slate-300 transition hover:border-amber-400/50 hover:text-amber-200"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden md:inline">RESET</span>
            </button>

            <button
              onClick={validateCurrentLevel}
              title="Check / Validate Solution"
              className="flex items-center gap-1 rounded-lg border border-emerald-500/45 bg-emerald-500/15 px-2.5 py-1.5 text-xs font-mono font-semibold text-emerald-200 transition hover:bg-emerald-500/25"
            >
              <CheckCircle2 className="h-3.5 w-3.5 text-neon-emerald" />
              <span className="hidden md:inline">CHECK</span>
            </button>

            <button
              onClick={() => setCodeDrawerOpen(!codeDrawerOpen)}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-mono transition ${
                codeDrawerOpen
                  ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                  : 'border-slate-700/80 bg-slate-900/75 text-slate-300 hover:border-emerald-400/40'
              }`}
            >
              <Code2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">JS CODE</span>
            </button>
          </div>
        </div>

        {/* Row 2: Universal Playback Scrubber & Telemetry Event Pill */}
        <div className="flex flex-wrap items-center gap-2.5 border-t border-slate-800/80 pt-2">
          <div className="flex items-center gap-1">
            <button
              onClick={rewindTimeline}
              disabled={totalEvents === 0}
              title="Rewind"
              className="rounded-md p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-cyan-300 disabled:opacity-35"
            >
              <SkipBack className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={stepBack}
              disabled={timeline.cursor <= -1}
              title="Step Back"
              className="rounded-md p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-cyan-300 disabled:opacity-35"
            >
              <StepBack className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={timeline.isPlaying ? pauseTimeline : playTimeline}
              disabled={totalEvents === 0}
              title={timeline.isPlaying ? 'Pause' : 'Play'}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-cyan-400/50 bg-cyan-500/20 text-cyan-200 transition hover:bg-cyan-500/35 disabled:opacity-35"
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
              title="Step Forward"
              className="rounded-md p-1.5 text-slate-300 transition hover:bg-slate-800 hover:text-cyan-300 disabled:opacity-35"
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
            <span className="w-12 shrink-0 text-right font-mono text-[10px] text-slate-400">
              {timeline.cursor + 1}/{totalEvents}
            </span>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center rounded-md border border-slate-800 bg-slate-950/75 p-0.5">
            {SPEEDS.map((spd) => (
              <button
                key={spd}
                onClick={() => setSpeed(spd)}
                className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition ${
                  timeline.speed === spd
                    ? 'bg-cyan-500/30 font-bold text-cyan-200'
                    : 'text-slate-500 hover:text-slate-200'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>

          {/* Live Telemetry Event Pill */}
          <div className="hidden max-w-xs truncate rounded-full border border-slate-800 bg-slate-950/80 px-3 py-1 font-mono text-[10px] text-cyan-300/90 md:block">
            {activeEvent ? `[${activeEvent.type}] ${activeEvent.label}` : 'READY // Direct 3D or JS Code'}
          </div>
        </div>
      </footer>
    </div>

    {/* FLOATING STATUS TOAST (Root stacking context z-40 above side panels) */}
    <AnimatePresence>
      {statusToast && (
        <motion.div
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          className={`pointer-events-auto fixed left-1/2 top-[74px] z-40 flex max-w-xl -translate-x-1/2 items-center gap-2.5 rounded-full border px-4 py-1.5 text-xs font-mono shadow-lg backdrop-blur-md ${
            statusToast.tone === 'error'
              ? 'border-rose-500/60 bg-rose-950/92 text-rose-100'
              : statusToast.tone === 'success'
                ? 'border-emerald-500/60 bg-emerald-950/92 text-emerald-100'
                : 'border-cyan-500/50 bg-slate-900/95 text-cyan-100'
          }`}
        >
          <span className="truncate">{statusToast.message}</span>
          <button onClick={clearToast} className="shrink-0 opacity-70 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
};
