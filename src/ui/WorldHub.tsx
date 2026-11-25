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
      className="fixed inset-0 z-20 flex flex-col overflow-hidden bg-void/55 backdrop-blur-[3px]"
    >
      {/* Top Header */}
      <header className="glass-panel z-10 flex flex-wrap items-center justify-between gap-3 border-x-0 border-t-0 px-5 py-3.5 md:px-8">
        <div className="flex items-center gap-4">
          <button
            onClick={goToTitle}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700/70 bg-slate-900/70 px-3 py-1.5 text-xs font-mono text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-200"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>TITLE</span>
          </button>
          <div>
            <h1 className="text-lg font-bold tracking-[0.14em] text-white sm:text-xl">
              SECTOR MAP <span className="text-neon-cyan">//</span> CURRICULUM
            </h1>
            <p className="text-[11px] font-mono text-slate-400">
              Select any unlocked circuit node to begin simulation
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Global Star & S-Rank Counter */}
          <div className="glass-panel-subtle flex items-center gap-3 rounded-lg px-3.5 py-1.5 text-xs font-mono">
            <span className="flex items-center gap-1 text-neon-amber">
              <Star className="h-3.5 w-3.5 fill-neon-amber" />
              {totalStars}/{maxStars}
            </span>
            <span className="h-3 w-px bg-slate-700" />
            <span className="flex items-center gap-1 text-neon-emerald">
              <Trophy className="h-3.5 w-3.5" />
              {totalSRanks} S-RANK
            </span>
          </div>

          {/* Unlock All Toggle */}
          <button
            onClick={toggleUnlockAll}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-mono transition ${
              unlockAll
                ? 'border-emerald-400/60 bg-emerald-500/15 text-emerald-300'
                : 'border-slate-700/70 bg-slate-900/70 text-slate-400 hover:border-slate-500 hover:text-slate-200'
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
            className="flex items-center gap-1.5 rounded-lg border border-violet-400/50 bg-violet-500/15 px-3.5 py-1.5 text-xs font-mono font-semibold text-violet-200 transition hover:border-violet-400 hover:bg-violet-500/25"
          >
            <FlaskConical className="h-3.5 w-3.5 text-neon-violet" />
            <span>SANDBOX LAB</span>
          </button>
        </div>
      </header>

      {/* 4-Sector Grid */}
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

            return (
              <motion.section
                key={world.id}
                initial={{ y: 18, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: wIdx * 0.06, duration: 0.35 }}
                className="glass-panel relative flex flex-col overflow-hidden rounded-2xl p-5"
                style={{
                  borderColor: `${world.accentColor}38`,
                }}
              >
                {/* Top Accent Hairline */}
                <div
                  className="absolute inset-x-0 top-0 h-[2px]"
                  style={{
                    background: `linear-gradient(90deg, transparent, ${world.accentColor}, transparent)`,
                  }}
                />

                {/* World Header */}
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className="rounded px-2 py-0.5 text-[10px] font-mono font-bold tracking-widest uppercase"
                        style={{
                          backgroundColor: `${world.accentColor}20`,
                          color: world.accentColor,
                          border: `1px solid ${world.accentColor}50`,
                        }}
                      >
                        SECTOR 0{wIdx + 1}
                      </span>
                      <span className="rounded border border-slate-700/80 bg-slate-900/70 px-2 py-0.5 text-[10px] font-mono text-slate-300">
                        {world.bigOTheme}
                      </span>
                    </div>
                    <h2 className="mt-1.5 text-xl font-bold tracking-wide text-white">
                      {world.name}{' '}
                      <span className="text-sm font-normal text-slate-400">
                        // {world.subtitle}
                      </span>
                    </h2>
                    <p className="mt-0.5 text-xs text-slate-400">{world.tagline}</p>
                  </div>

                  <div className="flex flex-col items-end gap-1 text-xs font-mono">
                    <span className="flex items-center gap-1 text-neon-amber">
                      <Star className="h-3.5 w-3.5 fill-neon-amber" />
                      {worldStars}/{levels.length * 3}
                    </span>
                    {worldSRanks > 0 && (
                      <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[10px] font-bold text-neon-emerald">
                        {worldSRanks} S-RANK
                      </span>
                    )}
                  </div>
                </div>

                {/* Level Cards */}
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
                            ? 'cursor-pointer border-slate-700/80 bg-slate-950/75 hover:border-cyan-400/70 hover:bg-slate-900/90'
                            : 'cursor-not-allowed border-slate-800/60 bg-slate-950/35 opacity-55'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className="text-xs font-mono font-bold"
                              style={{ color: unlocked ? world.accentColor : '#64748B' }}
                            >
                              {level.code}
                            </span>

                            {!unlocked ? (
                              <Lock className="h-3.5 w-3.5 text-slate-500" />
                            ) : prog?.rank ? (
                              <span
                                className={`rounded px-1.5 py-0.5 text-[10px] font-mono font-bold ${
                                  prog.rank === 'S'
                                    ? 'bg-emerald-500/20 text-neon-emerald border border-emerald-400/50'
                                    : prog.rank === 'A'
                                      ? 'bg-cyan-500/20 text-neon-cyan border border-cyan-400/40'
                                      : 'bg-amber-500/20 text-neon-amber border border-amber-400/40'
                                }`}
                              >
                                RANK {prog.rank}
                              </span>
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5 text-slate-500 transition-transform group-hover:translate-x-0.5 group-hover:text-cyan-300" />
                            )}
                          </div>

                          <div className="mt-1 text-sm font-semibold text-slate-100 group-hover:text-white">
                            {level.title}
                          </div>
                          <div className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">
                            {level.concept}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between border-t border-slate-800/80 pt-2">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3].map((n) => (
                              <Star
                                key={n}
                                className={`h-3 w-3 ${
                                  (prog?.stars ?? 0) >= n
                                    ? 'fill-neon-amber text-neon-amber'
                                    : 'text-slate-700'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] font-mono text-slate-400">
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
