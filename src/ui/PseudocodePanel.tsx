import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, ChevronDown, ChevronUp, FileCode2, X } from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import { getLevelById } from '../levels/index';
import { getActiveEvent } from '../engine/timeline';

export const PseudocodePanel: React.FC = () => {
  const pseudocodeOpen = useGameStore((s) => s.pseudocodeOpen);
  const setPseudocodeOpen = useGameStore((s) => s.setPseudocodeOpen);
  const activeLevelId = useGameStore((s) => s.activeLevelId);
  const timeline = useGameStore((s) => s.timeline);

  const [intuitionExpanded, setIntuitionExpanded] = useState(true);

  const level = getLevelById(activeLevelId);
  const activeEvent = getActiveEvent(timeline);
  const highlightedLine = activeEvent?.pseudocodeLine ?? -1;

  if (!level) return null;

  return (
    <AnimatePresence>
      {pseudocodeOpen && (
        <motion.aside
          initial={{ x: -320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: -320, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="glass-panel pointer-events-auto fixed left-3 top-[74px] bottom-[106px] z-30 flex w-72 flex-col overflow-hidden rounded-2xl md:w-80"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800/90 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-neon-cyan" />
              <span className="text-xs font-mono font-bold tracking-wider text-cyan-200">
                PSEUDOCODE TRACE
              </span>
            </div>
            <button
              onClick={() => setPseudocodeOpen(false)}
              title="Collapse Pseudocode Panel"
              className="rounded-md p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Pseudocode Lines */}
          <div className="axiom-scroll flex-1 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed">
            {level.pseudocode.length === 0 ? (
              <div className="py-6 text-center text-slate-500">
                No pseudocode trace for this mode.
              </div>
            ) : (
              <ol className="space-y-1">
                {level.pseudocode.map((line, idx) => {
                  const isActive = idx === highlightedLine;
                  return (
                    <li
                      key={idx}
                      className={`flex items-start gap-2.5 rounded-lg px-2.5 py-1.5 transition-all duration-150 ${
                        isActive
                          ? 'border border-cyan-400/60 bg-cyan-500/20 text-cyan-100 shadow-[0_0_14px_rgba(0,240,255,0.28)]'
                          : 'border border-transparent text-slate-300/85'
                      }`}
                    >
                      <span
                        className={`w-4 shrink-0 select-none text-right text-[10px] ${
                          isActive ? 'font-bold text-neon-cyan' : 'text-slate-600'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <span className="whitespace-pre-wrap break-words">{line}</span>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>

          {/* Expandable Big-O Intuition Card */}
          <div className="border-t border-slate-800/90 bg-slate-950/60">
            <button
              onClick={() => setIntuitionExpanded((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-2.5 text-left text-[11px] font-mono font-semibold text-amber-300 transition hover:bg-slate-900/60"
            >
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5 text-neon-amber" />
                BIG-O INTUITION ({level.par.targetBigO})
              </span>
              {intuitionExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronUp className="h-3.5 w-3.5" />
              )}
            </button>

            <AnimatePresence initial={false}>
              {intuitionExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-4 pb-3.5 text-[11px] leading-relaxed text-slate-300">
                    {level.bigOIntuition ?? level.insight}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
