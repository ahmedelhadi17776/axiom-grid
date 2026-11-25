import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';
import {
  AlertTriangle,
  Code2,
  Lightbulb,
  Loader2,
  Play,
  RotateCcw,
  Terminal,
  X,
} from 'lucide-react';
import { useGameStore } from '../store/useGameStore';
import type { WorldId } from '../engine/types';

const API_PILLS: Record<WorldId, Array<{ label: string; snippet: string }>> = {
  arrays: [
    { label: 'api.length', snippet: 'api.length' },
    { label: 'api.get(i)', snippet: 'api.get(0)' },
    { label: 'api.compare(i, j)', snippet: 'api.compare(0, 1)' },
    { label: 'api.swap(i, j)', snippet: 'api.swap(0, 1);' },
    { label: 'api.setPointer(n, i)', snippet: "api.setPointer('left', 0);" },
    { label: 'api.markWindow(l, r)', snippet: 'api.markWindow(0, 2);' },
  ],
  'linked-lists': [
    { label: 'api.head()', snippet: 'api.head()' },
    { label: 'api.getNode(id)', snippet: "api.getNode('n1')" },
    { label: 'api.link(a, b)', snippet: "api.link('n1', 'n2');" },
    { label: 'api.setHead(id)', snippet: "api.setHead('n1');" },
    { label: 'api.stepProbe()', snippet: 'api.stepProbe();' },
    { label: 'api.detectCycle()', snippet: 'api.detectCycle()' },
  ],
  'stacks-queues': [
    { label: 'api.hasInput()', snippet: 'api.hasInput()' },
    { label: 'api.peekInput()', snippet: 'api.peekInput()' },
    { label: 'api.intake(buf)', snippet: "api.intake('stackA');" },
    { label: 'api.transfer(a, b)', snippet: "api.transfer('inStack', 'outStack');" },
    { label: 'api.emit(buf)', snippet: "api.emit('stackA');" },
    { label: 'api.size(buf)', snippet: "api.size('stackA')" },
  ],
  pathfinding: [
    { label: "setAlgorithm('astar')", snippet: "api.setAlgorithm('astar');" },
    { label: 'setWall(x, y, bool)', snippet: 'api.setWall(2, 2, false);' },
    { label: 'setWeight(x, y, w)', snippet: 'api.setWeight(2, 2, 1);' },
    { label: 'api.runSearch()', snippet: 'api.runSearch();' },
  ],
};

export const CodeDrawer: React.FC = () => {
  const codeDrawerOpen = useGameStore((s) => s.codeDrawerOpen);
  const setCodeDrawerOpen = useGameStore((s) => s.setCodeDrawerOpen);
  const activeWorldId = useGameStore((s) => s.activeWorldId);
  const screen = useGameStore((s) => s.screen);
  const activeCode = useGameStore((s) => s.activeCode);
  const setActiveCode = useGameStore((s) => s.setActiveCode);
  const runCode = useGameStore((s) => s.runCode);
  const isRunningCode = useGameStore((s) => s.isRunningCode);
  const codeLogs = useGameStore((s) => s.codeLogs);
  const codeError = useGameStore((s) => s.codeError);
  const resetStarterCode = useGameStore((s) => s.resetStarterCode);
  const loadReferenceSolution = useGameStore((s) => s.loadReferenceSolution);

  const pills = API_PILLS[activeWorldId] ?? [];

  const handleInsertSnippet = (snippet: string) => {
    const separator = activeCode.endsWith('\n') || activeCode.length === 0 ? '' : '\n';
    setActiveCode(`${activeCode}${separator}${snippet}\n`);
  };

  return (
    <AnimatePresence>
      {codeDrawerOpen && (
        <motion.aside
          initial={{ x: 440, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 440, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          className="glass-panel pointer-events-auto fixed right-3 top-[74px] bottom-[106px] z-30 flex w-[92vw] max-w-[440px] flex-col overflow-hidden rounded-2xl"
        >
          {/* Drawer Header */}
          <div className="flex items-center justify-between border-b border-slate-800/90 px-4 py-2.5">
            <div className="flex items-center gap-2">
              <Code2 className="h-4 w-4 text-neon-emerald" />
              <span className="text-xs font-mono font-bold tracking-wider text-emerald-200">
                JS SANDBOX RUNNER
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={resetStarterCode}
                title="Reset to Starter Template"
                className="flex items-center gap-1 rounded-md border border-slate-700/80 bg-slate-900/70 px-2 py-1 text-[10px] font-mono text-slate-300 transition hover:border-slate-500 hover:text-white"
              >
                <RotateCcw className="h-3 w-3" />
                <span>STARTER</span>
              </button>

              {screen === 'play' && (
                <button
                  onClick={loadReferenceSolution}
                  title="Load Reference Solution Hint"
                  className="flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-[10px] font-mono text-amber-200 transition hover:bg-amber-500/20"
                >
                  <Lightbulb className="h-3 w-3 text-neon-amber" />
                  <span>HINT</span>
                </button>
              )}

              <button
                onClick={() => setCodeDrawerOpen(false)}
                title="Close Code Drawer"
                className="rounded-md p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Clickable API Quick-Reference Pills */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-800/80 bg-slate-950/60 px-3 py-2">
            <span className="text-[9px] font-mono uppercase tracking-wider text-slate-500">
              API:
            </span>
            {pills.map((pill) => (
              <button
                key={pill.label}
                onClick={() => handleInsertSnippet(pill.snippet)}
                title={`Click to append ${pill.snippet}`}
                className="rounded border border-cyan-500/25 bg-cyan-500/10 px-1.5 py-0.5 text-[10px] font-mono text-cyan-200 transition hover:border-cyan-400/70 hover:bg-cyan-500/20"
              >
                {pill.label}
              </button>
            ))}
          </div>

          {/* CodeMirror Editor */}
          <div className="axiom-scroll flex-1 overflow-auto bg-[#282c34]">
            <CodeMirror
              value={activeCode}
              height="100%"
              theme={oneDark}
              extensions={[javascript()]}
              onChange={(val) => setActiveCode(val)}
              basicSetup={{
                lineNumbers: true,
                highlightActiveLineGutter: true,
                foldGutter: false,
                autocompletion: true,
              }}
              className="h-full text-xs"
            />
          </div>

          {/* Console Output / Error Banner */}
          {(codeError || codeLogs.length > 0) && (
            <div className="axiom-scroll max-h-32 overflow-y-auto border-t border-slate-800 bg-slate-950/90 px-3.5 py-2.5 font-mono text-[11px]">
              {codeError && (
                <div className="mb-1.5 flex items-start gap-2 rounded-lg border border-crimson-500/40 bg-rose-950/50 p-2 text-rose-200">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-neon-crimson" />
                  <span className="break-words">{codeError}</span>
                </div>
              )}
              {codeLogs.length > 0 && (
                <div className="space-y-0.5 text-slate-300">
                  <div className="flex items-center gap-1 text-[10px] text-slate-500">
                    <Terminal className="h-3 w-3" />
                    <span>CONSOLE OUTPUT</span>
                  </div>
                  {codeLogs.map((log, i) => (
                    <div key={i} className="text-cyan-200/90">
                      &gt; {log}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Footer Run Bar */}
          <div className="flex items-center justify-between border-t border-slate-800/90 bg-slate-950/80 px-3.5 py-2.5">
            <span className="text-[10px] font-mono text-slate-500">
              Web Worker • 1.5s / 2k ops cap
            </span>
            <button
              onClick={() => void runCode()}
              disabled={isRunningCode}
              className="glow-emerald flex items-center gap-2 rounded-lg border border-emerald-400/70 bg-emerald-500/20 px-4 py-1.5 text-xs font-mono font-bold text-emerald-100 transition hover:bg-emerald-500/30 disabled:opacity-50"
            >
              {isRunningCode ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>RUNNING...</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 fill-emerald-300 text-emerald-300" />
                  <span>RUN CODE</span>
                </>
              )}
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
};
