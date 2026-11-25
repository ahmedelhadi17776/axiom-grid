import React from 'react';
import { motion } from 'framer-motion';
import {
  Cpu,
  FlaskConical,
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
      <div className="pointer-events-auto flex items-center justify-between">
        <div className="glass-panel-subtle flex items-center gap-2.5 rounded-full px-4 py-1.5 text-xs font-mono tracking-widest text-cyan-300/90">
          <span className="h-2 w-2 animate-pulse rounded-full bg-neon-emerald shadow-[0_0_8px_#00FF9D]" />
          <span>SYSTEM ONLINE // v1.0</span>
          {totalStars > 0 && (
            <span className="ml-2 border-l border-slate-700 pl-2.5 text-amber-300">
              ★ {totalStars}/{maxStars} {sRanks > 0 ? `• ${sRanks} S-RANK` : ''}
            </span>
          )}
        </div>

        {/* Quick Audio & Graphics Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleGraphicsQuality}
            title="Toggle Bloom & Post-Processing Quality"
            className="glass-panel-subtle flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-mono text-slate-200 transition hover:border-cyan-400/50 hover:text-cyan-300"
          >
            <Sparkles className="h-3.5 w-3.5 text-neon-cyan" />
            <span>{graphicsQuality === 'high' ? 'BLOOM: HIGH' : 'GPU: ECO'}</span>
          </button>

          <button
            onClick={toggleAmbient}
            title="Toggle Ambient Synth Pad"
            className={`glass-panel-subtle flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-mono transition ${
              ambientEnabled && !audioMuted
                ? 'border-violet-400/50 text-violet-300 glow-violet'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Music className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">AMBIENT</span>
          </button>

          <button
            onClick={toggleAudioMute}
            title={audioMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="glass-panel-subtle flex items-center justify-center rounded-lg p-2 text-slate-200 transition hover:border-cyan-400/50 hover:text-cyan-300"
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
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="glass-panel relative overflow-hidden rounded-3xl px-8 py-10 md:px-14 md:py-12"
        >
          {/* Subtle top neon accent bar */}
          <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-neon-cyan to-transparent opacity-80" />

          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-mono tracking-[0.2em] text-cyan-300">
            <Cpu className="h-3.5 w-3.5" />
            <span>INTERACTIVE 3D DSA ARENA</span>
          </div>

          <h1 className="text-glow-cyan bg-gradient-to-b from-white via-cyan-100 to-cyan-400 bg-clip-text text-5xl font-bold tracking-[0.14em] text-transparent sm:text-6xl md:text-7xl">
            AXIOM <span className="text-neon-cyan">//</span> GRID
          </h1>

          <p className="mt-4 text-base font-medium tracking-wide text-slate-300 sm:text-lg">
            Play the Machine. Feel the Complexity.
          </p>

          <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-slate-400 sm:text-sm">
            Manipulate glowing 3D memory buses, tether matrices, pressurized pipelines,
            and isometric signal grids — directly or via live JavaScript.
          </p>

          {/* Primary & Secondary CTAs */}
          <div className="mt-8 flex flex-col items-center justify-center gap-3.5 sm:flex-row">
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={goToHub}
              className="glow-cyan group flex w-full items-center justify-center gap-2.5 rounded-xl border border-cyan-400/70 bg-cyan-500/20 px-8 py-3.5 text-sm font-bold tracking-[0.16em] text-cyan-100 transition hover:bg-cyan-400/30 sm:w-auto"
            >
              <Play className="h-4 w-4 fill-cyan-300 text-cyan-300 transition-transform group-hover:translate-x-0.5" />
              <span>ENTER GRID</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => enterSandbox('arrays')}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-violet-400/45 bg-violet-500/15 px-7 py-3.5 text-sm font-semibold tracking-[0.14em] text-violet-200 transition hover:border-violet-400/80 hover:bg-violet-500/25 sm:w-auto"
            >
              <FlaskConical className="h-4 w-4 text-neon-violet" />
              <span>SANDBOX LAB</span>
            </motion.button>
          </div>
        </motion.div>
      </div>

      {/* Bottom Capabilities Strip */}
      <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-3 text-[11px] font-mono text-slate-400">
        <span className="glass-panel-subtle flex items-center gap-1.5 rounded-full px-3 py-1">
          <Zap className="h-3 w-3 text-neon-cyan" /> 16 Handcrafted Puzzles
        </span>
        <span className="glass-panel-subtle flex items-center gap-1.5 rounded-full px-3 py-1">
          <span className="text-neon-amber">O(n)</span> Big-O Cycle &amp; Memory Par
        </span>
        <span className="glass-panel-subtle flex items-center gap-1.5 rounded-full px-3 py-1">
          <span className="text-neon-emerald">{'{ }'}</span> Hybrid 3D + JS Code Drawer
        </span>
      </div>
    </motion.div>
  );
};
