import React, { useEffect } from 'react';
import { AnimatePresence } from 'framer-motion';
import { IsometricCanvas } from './scene/IsometricCanvas';
import { useGameStore } from './store/useGameStore';
import { getActiveEvent, getCurrentState } from './engine/timeline';
import { TitleScreen } from './ui/TitleScreen';
import { WorldHub } from './ui/WorldHub';
import { GameHUD } from './ui/GameHUD';
import { PseudocodePanel } from './ui/PseudocodePanel';
import { CodeDrawer } from './ui/CodeDrawer';
import { VictoryModal } from './ui/VictoryModal';
import { SandboxStudio } from './ui/SandboxStudio';

export function App() {
  const screen = useGameStore((s) => s.screen);
  const timeline = useGameStore((s) => s.timeline);
  const graphicsQuality = useGameStore((s) => s.graphicsQuality);
  const resetCameraSignal = useGameStore((s) => s.resetCameraSignal);
  const pathPaintTool = useGameStore((s) => s.pathPaintTool);
  const handleDirectAction = useGameStore((s) => s.handleDirectAction);
  const stepForward = useGameStore((s) => s.stepForward);

  const worldState = getCurrentState(timeline);
  const activeEvent = getActiveEvent(timeline);
  const isBackdrop = screen === 'title' || screen === 'hub';

  // Drive timeline playback ticker when timeline.isPlaying is true
  useEffect(() => {
    if (!timeline.isPlaying) return;

    const baseDelayMs =
      worldState.world === 'pathfinding'
        ? 110
        : worldState.world === 'dp'
          ? 260
          : worldState.world === 'trees' ||
              worldState.world === 'hash-table' ||
              worldState.world === 'heap'
            ? 320
            : 380;
    const intervalMs = Math.max(35, Math.round(baseDelayMs / timeline.speed));

    const timer = window.setInterval(() => {
      stepForward();
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [timeline.isPlaying, timeline.speed, worldState.world, stepForward]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-void text-slate-100 select-none">
      {/* Persistent 3D Isometric Viewport */}
      <div className="fixed inset-0 z-0">
        <IsometricCanvas
          mode={isBackdrop ? 'backdrop' : 'world'}
          worldState={isBackdrop ? undefined : worldState}
          activeEvent={isBackdrop ? null : activeEvent}
          graphicsQuality={graphicsQuality}
          resetCameraSignal={resetCameraSignal}
          interactive={!isBackdrop && !timeline.isPlaying}
          paintTool={pathPaintTool}
          onDirectAction={handleDirectAction}
        />
      </div>

      {/* Screen Overlays */}
      <AnimatePresence mode="wait">
        {screen === 'title' && <TitleScreen key="title" />}
        {screen === 'hub' && <WorldHub key="hub" />}
        {screen === 'play' && (
          <React.Fragment key="play">
            <GameHUD />
            <PseudocodePanel />
            <CodeDrawer />
            <VictoryModal />
          </React.Fragment>
        )}
        {screen === 'sandbox' && (
          <React.Fragment key="sandbox">
            <SandboxStudio />
            <CodeDrawer />
          </React.Fragment>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;
