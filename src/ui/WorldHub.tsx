import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  FlaskConical,
  Lock,
  Star,
  Unlock,
  Trophy,
  ChevronRight,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { ALL_LEVELS, LEVELS_BY_WORLD, WORLD_META } from '../levels/index';

export const WorldHub: React.FC = () => {
  const goToTitle = useGameStore((s) => s.goToTitle);
  const startLevel = useGameStore((s) => s.startLevel);
  const enterSandbox = useGameStore((s) => s.enterSandbox);
  const progress = useGameStore((s) => s.progress);
  const unlockAll = useGameStore((s) => s.unlockAll);
  const toggleUnlockAll = useGameStore((s) => s.toggleUnlockAll);
  const isLevelUnlocked = useGameStore((s) => s.isLevelUnlocked);

  const totalStars = Object.values(progress).reduce((sum, p) => sum + p.stars, 0);
  const maxStars = ALL_LEVELS.length * 3;
  const totalSRanks = Object.values(progress).filter((p) => p.rank === 'S').length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed inset-0 z-20 flex flex-col overflow-hidden bg-void/65 backdrop-blur-[4px]"
    >
      {/* Top Header */}
      <header className="glass-panel z-10 flex flex-wrap items-center justify-between gap-3 border-x-0 border-t-0 px-5 py-3.5 md:px-8">
        <div className="flex items-center gap-4">
          <button
            onClick={goToTitle}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-900/70 px-3 py-1.5 text-xs font-mono text-slate-300 transition hover:border-sky-400/45 hover:text-sky-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>TITLE</span>
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-[0.14em] text-slate-100 sm:text-xl">
              SECTOR MAP <span className="text-neon-cyan">//</span> CURRICULUM
            </h1>
            <p className="text-xs font-mono text-slate-400">
              {WORLD_META.length} Sectors • {ALL_LEVELS.length} Circuits • Select any unlocked node to begin
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Global Star & S-Rank Counter */}
          <div className="glass-panel-subtle flex items-center gap-3 rounded-lg px-3.5 py-1.5 text-xs font-mono">
            <span className="flex items-center gap-1.5 text-neon-amber">
              <Star className="h-3.5 w-3.5 fill-neon-amber" />
              {totalStars}/{maxStars}
            </span>
            <span className="h-3.5 w-px bg-slate-700/70" />
            <span className="flex items-center gap-1.5 text-neon-emerald">
              <Trophy className="h-3.5 w-3.5" />
              {totalSRanks} S-RANK
            </span>
          </div>

          {/* Unlock All Toggle */}
          <button
            onClick={toggleUnlockAll}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-mono transition ${
              unlockAll
                ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                : 'border-slate-700/60 bg-slate-900/70 text-slate-300 hover:border-slate-500/70 hover:text-slate-100'
            }`}
          >
            {unlockAll ? (
              <Unlock className="h-3.5 w-3.5" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
            <span>{unlockAll ? 'ALL UNLOCKED' : 'UNLOCK ALL'}</span>
          </button>

          {/* Sandbox Shortcut */}
          <button
            onClick={() => enterSandbox('arrays')}
            className="flex items-center gap-1.5 rounded-lg border border-violet-400/45 bg-violet-500/14 px-3.5 py-1.5 text-xs font-mono font-semibold text-violet-200 transition hover:border-violet-400/70 hover:bg-violet-500/22"
          >
            <FlaskConical className="h-3.5 w-3.5 text-neon-violet" />
            <span>SANDBOX LAB</span>
          </button>
        </div>
      </header>

      {/* 8-Sector Grid */}
      <main className="axiom-scroll flex-1 overflow-y-auto px-5 py-6 md:px-8">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 lg:grid-cols-2">
          {WORLD_META.map((world, wIdx) => {
            const levels = LEVELS_BY_WORLD[world.id] ?? [];
            const worldStars = levels.reduce(
              (sum, lvl) => sum + (progress[lvl.id]?.stars ?? 0),
              0
            );
            const worldSRanks = levels.filter(
              (lvl) => progress[lvl.id]?.rank === 'S'
            ).length;
            const accent =
              world.id === 'trees'
                ? '#2DD4BF'
                : world.id === 'dp'
                  ? '#818CF8'
                  : world.id === 'hash-table'
                    ? '#FB923C'
                    : world.id === 'heap'
                      ? '#F472B6'
                      : world.accentColor;

            return (
              <motion.section
                key={world.id}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: wIdx * 0.04, duration: 0.3 }}
                className="glass-panel relative flex flex-col overflow-hidden rounded-2xl p-5"
                style={{
                  borderColor: `${accent}30`,
                }}
              >
                {/* Top Accent Hairline */}
                <div
                  className="absolute inset-x-0 top-0 h-[2px] opacity-80"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
                  }}
                />

                {/* World Header */}
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className="rounded-md px-2 py-0.5 text-[11px] font-mono font-bold tracking-widest uppercase"
                        style={{
                          backgroundColor: `${accent}18`,
                          color: accent,
                          border: `1px solid ${accent}42`,
                        }}
                      >
                        SECTOR 0{wIdx + 1}
                      </span>
                      <span className="rounded-md border border-slate-700/60 bg-surface/75 px-2 py-0.5 text-[11px] font-mono text-slate-300">
                        {world.bigOTheme}
                      </span>
                    </div>
                    <h2 className="mt-2 text-xl font-bold tracking-wide text-slate-100">
                      {world.name}{' '}
                      <span className="text-sm font-normal text-slate-400">
                        // {world.subtitle}
                      </span>
                    </h2>
                    <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                      {world.tagline}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-col items-end gap-1.5 text-xs font-mono">
                    <span className="flex items-center gap-1 text-neon-amber">
                      <Star className="h-3.5 w-3.5 fill-neon-amber" />
                      {worldStars}/{levels.length * 3}
                    </span>
                    {worldSRanks > 0 && (
                      <span className="rounded-md border border-emerald-400/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-neon-emerald">
                        {worldSRanks} S-RANK
                      </span>
                    )}
                  </div>
                </div>

                {/* 6-Level Subgrid */}
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {levels.map((level) => {
                    const unlocked = isLevelUnlocked(level.id);
                    const prog = progress[level.id];

                    return (
                      <button
                        key={level.id}
                        disabled={!unlocked}
                        onClick={() => startLevel(level.id)}
                        className={`group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition ${
                          unlocked
                            ? 'cursor-pointer border-slate-700/60 bg-surface/75 hover:border-sky-400/50 hover:bg-slate-800/75'
                            : 'cursor-not-allowed border-slate-800/60 bg-void/45 opacity-55'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="text-xs font-mono font-bold"
                              style={{ color: unlocked ? accent : '#64748B' }}
                            >
                              {level.code}
                            </span>

                            {!unlocked ? (
                              <Lock className="h-3.5 w-3.5 text-slate-500" />
                            ) : prog?.rank ? (
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                                  prog.rank === 'S'
                                    ? 'border border-emerald-400/40 bg-emerald-500/15 text-neon-emerald'
                                    : prog.rank === 'A'
                                      ? 'border border-sky-400/40 bg-sky-500/15 text-neon-cyan'
                                      : 'border border-amber-400/40 bg-amber-500/15 text-neon-amber'
                                }`}
                              >
                                RANK {prog.rank}
                              </span>
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-sky-300" />
                            )}
                          </div>

                          <div className="mt-1.5 text-sm font-semibold text-slate-100 group-hover:text-white">
                            {level.title}
                          </div>
                          <div className="mt-0.5 line-clamp-1 text-xs text-slate-400">
                            {level.concept}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-slate-700/50 pt-2">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3].map((n) => (
                              <Star
                                key={n}
                                className={`h-3.5 w-3.5 ${
                                  (prog?.stars ?? 0) >= n
                                    ? 'fill-neon-amber text-neon-amber'
                                    : 'text-slate-700'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-[11px] font-mono text-slate-400">
                            {level.par.targetBigO}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.section>
            );
          })}
        </div>
      </main>
    </motion.div>
  );
};
