import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Cpu,
  Eye,
  LayoutGrid,
  Lightbulb,
  RotateCcw,
  Star,
  X,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { getLevelById, getNextLevel } from '../levels/index';

export const VictoryModal: React.FC = () => {
  const scoreReport = useGameStore((s) => s.scoreReport);
  const victoryDismissed = useGameStore((s) => s.victoryDismissed);
  const activeLevelId = useGameStore((s) => s.activeLevelId);
  const startLevel = useGameStore((s) => s.startLevel);
  const goToHub = useGameStore((s) => s.goToHub);
  const dismissVictoryModal = useGameStore((s) => s.dismissVictoryModal);
  const resetLevel = useGameStore((s) => s.resetLevel);

  const isVisible = Boolean(scoreReport?.passed && !victoryDismissed);

  useEffect(() => {
    if (!isVisible) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        dismissVictoryModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible, dismissVictoryModal]);

  if (!isVisible || !scoreReport) {
    return null;
  }

  const level = getLevelById(activeLevelId);
  const nextLevel = getNextLevel(activeLevelId);

  const rankColors: Record<string, string> = {
    S: 'border-emerald-400/70 text-neon-emerald bg-emerald-500/15 glow-emerald',
    A: 'border-sky-400/70 text-neon-cyan bg-sky-500/15 glow-cyan',
    B: 'border-amber-400/70 text-neon-amber bg-amber-500/15 glow-amber',
    C: 'border-slate-500/70 text-slate-200 bg-slate-500/15',
  };

  const rankStyle = rankColors[scoreReport.rank ?? 'C'] ?? rankColors.C;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={dismissVictoryModal}
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/75 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.92, y: 18, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel relative w-full max-w-xl overflow-hidden rounded-3xl border-emerald-400/30 p-6 md:p-8"
      >
        {/* Top luminous accent */}
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-neon-cyan via-neon-emerald to-neon-teal opacity-85" />

        {/* Close / Inspect Board button */}
        <button
          type="button"
          onClick={dismissVictoryModal}
          aria-label="Inspect Board"
          title="Inspect Board (Esc)"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/60 bg-slate-900/75 text-slate-400 transition hover:border-sky-400/45 hover:bg-sky-500/15 hover:text-sky-200"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header & Rank Badge */}
        <div className="flex items-start justify-between gap-4 pr-10">
          <div>
            <div className="text-xs font-mono tracking-[0.18em] text-neon-emerald">
              CIRCUIT VERIFIED // {level?.code}
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-wide text-slate-100">
              {level?.title ?? 'Level Complete'}
            </h2>
          </div>

          {scoreReport.rank && (
            <motion.div
              initial={{ rotate: -12, scale: 0.5 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.18, type: 'spring', stiffness: 320 }}
              className={`flex h-16 w-16 flex-col items-center justify-center rounded-2xl border font-mono ${rankStyle}`}
            >
              <span className="text-[10px] tracking-widest opacity-80">RANK</span>
              <span className="text-3xl font-black leading-none">
                {scoreReport.rank}
              </span>
            </motion.div>
          )}
        </div>

        {/* Animated Stars */}
        <div className="my-5 flex items-center justify-center gap-4">
          {[1, 2, 3].map((n) => {
            const earned = scoreReport.stars >= n;
            return (
              <motion.div
                key={n}
                initial={{ scale: 0, rotate: -24 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  delay: 0.1 + n * 0.1,
                  type: 'spring',
                  stiffness: 300,
                }}
              >
                <Star
                  className={`h-10 w-10 ${
                    earned
                      ? 'fill-neon-amber text-neon-amber drop-shadow-[0_0_10px_rgba(251,191,36,0.55)]'
                      : 'text-slate-700'
                  }`}
                />
              </motion.div>
            );
          })}
        </div>

        {/* Metrics Breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-700/60 bg-surface/75 p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] font-mono tracking-wider text-slate-400">
              <Cpu className="h-3.5 w-3.5 text-neon-cyan" />
              <span>CYCLES USED</span>
            </div>
            <div className="mt-1.5 flex items-baseline gap-2 font-mono">
              <span className="text-2xl font-bold text-slate-100">
                {scoreReport.metrics.cycles}
              </span>
              {level && (
                <span className="text-xs text-slate-400">
                  / S-Par {level.par.sRankCycles}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/60 bg-surface/75 p-3.5">
            <div className="text-[11px] font-mono tracking-wider text-slate-400">
              AUX MEMORY
            </div>
            <div className="mt-1.5 flex items-baseline gap-2 font-mono">
              <span className="text-2xl font-bold text-neon-violet">
                {scoreReport.metrics.auxMemory}
              </span>
              {level && (
                <span className="text-xs text-slate-400">
                  / Max {level.par.maxAuxMemory}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Big-O Conceptual Insight */}
        <div className="mt-4 rounded-xl border border-sky-400/25 bg-sky-950/25 p-4">
          <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-neon-cyan">
            <Lightbulb className="h-3.5 w-3.5" />
            <span>BIG-O INSIGHT ({level?.par.targetBigO})</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-200">
            {scoreReport.insight}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={goToHub}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700/60 bg-slate-900/75 px-3.5 py-2.5 text-xs font-mono text-slate-300 transition hover:border-slate-500/70 hover:text-slate-100"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>WORLD HUB</span>
            </button>

            <button
              onClick={dismissVictoryModal}
              className="flex items-center gap-1.5 rounded-xl border border-sky-400/45 bg-sky-500/14 px-3.5 py-2.5 text-xs font-mono font-semibold text-sky-100 transition hover:bg-sky-500/22"
            >
              <Eye className="h-3.5 w-3.5 text-neon-cyan" />
              <span>INSPECT STATE</span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                dismissVictoryModal();
                resetLevel();
              }}
              className="flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-500/12 px-3.5 py-2.5 text-xs font-mono font-semibold text-amber-200 transition hover:bg-amber-500/20"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>OPTIMIZE</span>
            </button>

            {nextLevel && (
              <button
                onClick={() => startLevel(nextLevel.id)}
                className="glow-emerald flex items-center gap-1.5 rounded-xl border border-emerald-400/50 bg-emerald-500/20 px-4 py-2.5 text-xs font-mono font-bold text-emerald-100 transition hover:bg-emerald-500/30"
              >
                <span>NEXT: {nextLevel.code}</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};
