import React from 'react';
import { motion } from 'framer-motion';
import {
  Cpu,
  FlaskConical,
  GitBranch,
  Music,
  Play,
  Sparkles,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { ALL_LEVELS } from '../levels/index';

export const TitleScreen: React.FC = () => {
  const goToHub = useGameStore((s) => s.goToHub);
  const enterSandbox = useGameStore((s) => s.enterSandbox);
  const audioMuted = useGameStore((s) => s.audioMuted);
  const ambientEnabled = useGameStore((s) => s.ambientEnabled);
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);
  const toggleAudioMute = useGameStore((s) => s.toggleAudioMute);
  const toggleAmbient = useGameStore((s) => s.toggleAmbient);
  const toggleGraphicsQuality = useGameStore((s) => s.toggleGraphicsQuality);
  const progress = useGameStore((s) => s.progress);

  const totalStars = Object.values(progress).reduce((sum, p) => sum + p.stars, 0);
  const maxStars = ALL_LEVELS.length * 3;
  const sRanks = Object.values(progress).filter((p) => p.rank === 'S').length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-6 md:p-10"
    >
      {/* Top Status Strip */}
      <div className="pointer-events-auto flex items-center justify-between gap-3">
        <div className="glass-panel-subtle flex items-center gap-2.5 rounded-full px-4 py-1.5 text-xs font-mono tracking-wider text-slate-200">
          <span className="h-2 w-2 animate-pulse rounded-full bg-neon-emerald shadow-[0_0_8px_rgba(52,211,153,0.65)]" />
          <span>SYSTEM ONLINE // v2.0</span>
          {totalStars > 0 && (
            <span className="ml-1.5 border-l border-slate-700/70 pl-2.5 text-amber-200">
              ★ {totalStars}/{maxStars} {sRanks > 0 ? `• ${sRanks} S-RANK` : ''}
            </span>
          )}
        </div>

        {/* Quick Audio & Graphics Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleGraphicsQuality}
            title="Toggle Bloom & Post-Processing Quality"
            className="glass-panel-subtle flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 transition hover:border-sky-400/40 hover:text-sky-200"
          >
            <Sparkles className="h-3.5 w-3.5 text-neon-cyan" />
            <span>{graphicsQuality === 'high' ? 'BLOOM: HIGH' : 'GPU: ECO'}</span>
          </button>

          <button
            onClick={toggleAmbient}
            title="Toggle Ambient Synth Pad"
            className={`glass-panel-subtle flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-mono transition ${
              ambientEnabled && !audioMuted
                ? 'glow-violet border-violet-400/45 text-violet-200'
                : 'text-slate-300 hover:text-slate-100'
            }`}
          >
            <Music className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AMBIENT</span>
          </button>

          <button
            onClick={toggleAudioMute}
            title={audioMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="glass-panel-subtle flex items-center justify-center rounded-lg p-2 text-slate-200 transition hover:border-sky-400/40 hover:text-sky-200"
          >
            {audioMuted ? (
              <VolumeX className="h-4 w-4 text-neon-crimson" />
            ) : (
              <Volume2 className="h-4 w-4 text-neon-cyan" />
            )}
          </button>
        </div>
      </div>

      {/* Center Hero Card */}
      <div className="pointer-events-auto mx-auto flex max-w-2xl flex-col items-center text-center">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="glass-panel relative overflow-hidden rounded-3xl px-8 py-10 md:px-14 md:py-12"
        >
          {/* Subtle top luminous accent bar */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-neon-cyan to-transparent opacity-70" />

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-400/30 bg-sky-500/10 px-3.5 py-1 text-xs font-mono tracking-[0.18em] text-sky-200">
            <Cpu className="h-3.5 w-3.5 text-neon-cyan" />
            <span>INTERACTIVE 3D DSA ARENA</span>
          </div>

          <h1 className="text-glow-cyan bg-gradient-to-b from-slate-50 via-sky-100 to-sky-300 bg-clip-text text-5xl font-bold tracking-[0.14em] text-transparent sm:text-6xl md:text-7xl">
            AXIOM <span className="text-neon-cyan">//</span> GRID
          </h1>

          <p className="mt-4 text-base font-medium tracking-wide text-slate-200 sm:text-lg">
            Play the Machine. Feel the Complexity.
          </p>

          <p className="mx-auto mt-2.5 max-w-lg text-sm leading-relaxed text-slate-400">
            Manipulate isometric memory buses, tether chains, pressurized pipelines,
            signal grids, and crystalline binary tree canopies — directly or via live JavaScript.
          </p>

          {/* Primary & Secondary CTAs */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={goToHub}
              className="glow-cyan group flex w-full items-center justify-center gap-2.5 rounded-xl border border-sky-400/50 bg-sky-500/18 px-8 py-3.5 text-sm font-bold tracking-[0.14em] text-slate-100 transition hover:bg-sky-400/25 sm:w-auto"
            >
              <Play className="h-4 w-4 fill-sky-300 text-sky-300 transition-transform group-hover:translate-x-0.5" />
              <span>ENTER GRID</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => enterSandbox('arrays')}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-violet-400/40 bg-violet-500/14 px-7 py-3.5 text-sm font-semibold tracking-[0.12em] text-violet-200 transition hover:border-violet-400/65 hover:bg-violet-500/22 sm:w-auto"
            >
              <FlaskConical className="h-4 w-4 text-neon-violet" />
              <span>SANDBOX LAB</span>
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Bottom Capabilities Strip */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2.5 text-xs font-mono text-slate-300">
        <span className="glass-panel-subtle flex items-center gap-1.5 rounded-full px-3.5 py-1.5">
          <Zap className="h-3.5 w-3.5 text-neon-cyan" /> {ALL_LEVELS.length} Handcrafted Puzzles
        </span>
        <span className="glass-panel-subtle flex items-center gap-1.5 rounded-full px-3.5 py-1.5">
          <GitBranch className="h-3.5 w-3.5 text-neon-teal" /> Sector 05: Canopy Trees &amp; AVL
        </span>
        <span className="glass-panel-subtle flex items-center gap-1.5 rounded-full px-3.5 py-1.5">
          <span className="text-neon-amber">O(log n)</span> Big-O Cycle &amp; Memory Par
        </span>
        <span className="glass-panel-subtle flex items-center gap-1.5 rounded-full px-3.5 py-1.5">
          <span className="text-neon-emerald">{'{ }'}</span> Hybrid 3D + JS Code Drawer
        </span>
      </div>
    </motion.div>
  );
};
