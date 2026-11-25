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
    S: 'border-emerald-400 text-neon-emerald bg-emerald-500/20 glow-emerald',
    A: 'border-cyan-400 text-neon-cyan bg-cyan-500/20 glow-cyan',
    B: 'border-amber-400 text-neon-amber bg-amber-500/20 glow-amber',
    C: 'border-slate-400 text-slate-200 bg-slate-500/20',
  };

  const rankStyle = rankColors[scoreReport.rank ?? 'C'] ?? rankColors.C;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={dismissVictoryModal}
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/70 p-4 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 280, damping: 24 }}
        onClick={(e) => e.stopPropagation()}
        className="glass-panel relative w-full max-w-xl overflow-hidden rounded-3xl border-emerald-400/40 p-6 md:p-8"
      >
        {/* Top neon accent */}
        <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-neon-cyan via-neon-emerald to-neon-amber" />

        {/* Close / Inspect Board button */}
        <button
          type="button"
          onClick={dismissVictoryModal}
          aria-label="Inspect Board"
          title="Inspect Board (Esc)"
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/80 bg-slate-900/80 text-slate-400 transition hover:border-cyan-400/60 hover:bg-cyan-500/15 hover:text-cyan-200"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Header & Rank Badge */}
        <div className="flex items-start justify-between gap-4 pr-10">
          <div>
            <div className="text-[11px] font-mono tracking-[0.2em] text-neon-emerald">
              CIRCUIT VERIFIED // {level?.code}
            </div>
            <h2 className="mt-1 text-2xl font-bold tracking-wide text-white">
              {level?.title ?? 'Level Complete'}
            </h2>
          </div>

          {scoreReport.rank && (
            <motion.div
              initial={{ rotate: -15, scale: 0.4 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 320 }}
              className={`flex h-16 w-16 flex-col items-center justify-center rounded-2xl border-2 font-mono ${rankStyle}`}
            >
              <span className="text-[9px] tracking-widest opacity-80">RANK</span>
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
                initial={{ scale: 0, rotate: -30 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  delay: 0.1 + n * 0.12,
                  type: 'spring',
                  stiffness: 300,
                }}
              >
                <Star
                  className={`h-10 w-10 ${
                    earned
                      ? 'fill-neon-amber text-neon-amber drop-shadow-[0_0_12px_rgba(255,184,0,0.8)]'
                      : 'text-slate-700'
                  }`}
                />
              </motion.div>
            );
          })}
        </div>

        {/* Metrics Breakdown */}
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-slate-700/70 bg-slate-950/75 p-3">
            <div className="flex items-center gap-1.5 text-[10px] font-mono tracking-wider text-slate-400">
              <Cpu className="h-3.5 w-3.5 text-neon-cyan" />
              <span>CYCLES USED</span>
            </div>
            <div className="mt-1 flex items-baseline gap-2 font-mono">
              <span className="text-2xl font-bold text-white">
                {scoreReport.metrics.cycles}
              </span>
              {level && (
                <span className="text-xs text-slate-400">
                  / S-Par {level.par.sRankCycles}
                </span>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-700/70 bg-slate-950/75 p-3">
            <div className="text-[10px] font-mono tracking-wider text-slate-400">
              AUX MEMORY
            </div>
            <div className="mt-1 flex items-baseline gap-2 font-mono">
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
        <div className="mt-4 rounded-xl border border-cyan-500/30 bg-cyan-950/25 p-3.5">
          <div className="flex items-center gap-1.5 text-[11px] font-mono font-semibold text-neon-cyan">
            <Lightbulb className="h-3.5 w-3.5" />
            <span>BIG-O INSIGHT ({level?.par.targetBigO})</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-200">
            {scoreReport.insight}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={goToHub}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-900/80 px-3.5 py-2.5 text-xs font-mono text-slate-300 transition hover:border-slate-500 hover:text-white"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>WORLD HUB</span>
            </button>

            <button
              onClick={dismissVictoryModal}
              className="flex items-center gap-1.5 rounded-xl border border-cyan-400/60 bg-cyan-500/15 px-3.5 py-2.5 text-xs font-mono font-semibold text-cyan-100 transition hover:bg-cyan-500/25"
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
              className="flex items-center gap-1.5 rounded-xl border border-amber-400/50 bg-amber-500/10 px-3.5 py-2.5 text-xs font-mono font-semibold text-amber-200 transition hover:bg-amber-500/20"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>OPTIMIZE</span>
            </button>

            {nextLevel && (
              <button
                onClick={() => startLevel(nextLevel.id)}
                className="glow-emerald flex items-center gap-1.5 rounded-xl border border-emerald-400/70 bg-emerald-500/20 px-4 py-2.5 text-xs font-mono font-bold text-emerald-100 transition hover:bg-emerald-500/30"
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
