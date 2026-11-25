import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Canvas } from '@react-three/fiber';
import type { AnyWorldState, SimEvent, WorldId } from '../engine/types';
import { NeonEnvironment } from './NeonEnvironment';
import { CameraRig } from './CameraRig';
import { ParticleSystem } from './ParticleSystem';
import { TitleBackground3D } from './TitleBackground3D';
import { ArraysScene3D } from './worlds/ArraysScene3D';
import { LinkedListScene3D } from './worlds/LinkedListScene3D';
import { StacksQueuesScene3D } from './worlds/StacksQueuesScene3D';
import { PathfindingScene3D } from './worlds/PathfindingScene3D';

export interface DirectAction {
  world: WorldId;
  type: string;
  payload?: Record<string, unknown>;
}

export interface IsometricCanvasProps {
  mode: 'backdrop' | 'world';
  worldState?: AnyWorldState;
  activeEvent?: SimEvent | null;
  graphicsQuality: 'high' | 'eco';
  resetCameraSignal?: number;
  interactive?: boolean;
  paintTool?: 'wall' | 'weight' | 'open' | 'start' | 'goal';
  onDirectAction?: (action: DirectAction) => void;
}

interface BoundaryProps {
  children: ReactNode;
}

interface BoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class WebGLErrorBoundary extends Component<BoundaryProps, BoundaryState> {
  public state: BoundaryState = { hasError: false, errorMessage: '' };

  public static getDerivedStateFromError(error: Error): BoundaryState {
    return { hasError: true, errorMessage: error.message || 'WebGL rendering error' };
  }

  public componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[AXIOM//GRID 3D] Render error:', error, info);
  }

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center bg-[#06080F] p-6 text-center text-slate-200">
          <div className="max-w-md rounded-xl border border-cyan-500/30 bg-[#0B1222]/90 p-6 shadow-2xl">
            <div className="mb-2 font-mono text-xs uppercase tracking-widest text-cyan-400">
              AXIOM // GRID — 3D Fallback
            </div>
            <h2 className="mb-2 text-lg font-semibold text-white">
              3D Viewport Unavailable
            </h2>
            <p className="mb-4 text-sm text-slate-400">
              WebGL failed to initialize in this browser context ({this.state.errorMessage}).
              You can still run simulations via the Code Drawer or reload to retry.
            </p>
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, errorMessage: '' })}
              className="rounded-lg border border-cyan-400/50 bg-cyan-500/15 px-4 py-2 font-mono text-xs text-cyan-300 transition hover:bg-cyan-500/25"
            >
              Retry 3D Renderer
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export function IsometricCanvas({
  mode,
  worldState,
  activeEvent = null,
  graphicsQuality,
  resetCameraSignal = 0,
  interactive = true,
  paintTool = 'wall',
  onDirectAction,
}: IsometricCanvasProps) {
  return (
    <WebGLErrorBoundary>
      <div className="relative h-full w-full select-none bg-[#06080F]">
        <Canvas
          shadows={graphicsQuality === 'high'}
          orthographic
          dpr={graphicsQuality === 'high' ? [1, 2] : [1, 1]}
          camera={{ position: [20, 20, 20], zoom: 42, near: -80, far: 180 }}
          gl={{ antialias: true, powerPreference: 'high-performance' }}
        >
          <NeonEnvironment graphicsQuality={graphicsQuality} />
          <CameraRig
            mode={mode}
            worldState={worldState}
            resetCameraSignal={resetCameraSignal}
          />
          <ParticleSystem activeEvent={activeEvent} worldState={worldState} />

          {mode === 'backdrop' && <TitleBackground3D />}

          {mode === 'world' && worldState && (
            <>
              {worldState.world === 'arrays' && (
                <ArraysScene3D
                  state={worldState}
                  interactive={interactive}
                  onDirectAction={onDirectAction}
                />
              )}
              {worldState.world === 'linked-lists' && (
                <LinkedListScene3D
                  state={worldState}
                  interactive={interactive}
                  onDirectAction={onDirectAction}
                />
              )}
              {worldState.world === 'stacks-queues' && (
                <StacksQueuesScene3D
                  state={worldState}
                  interactive={interactive}
                  onDirectAction={onDirectAction}
                />
              )}
              {worldState.world === 'pathfinding' && (
                <PathfindingScene3D
                  state={worldState}
                  interactive={interactive}
                  paintTool={paintTool}
                  onDirectAction={onDirectAction}
                />
              )}
            </>
          )}
        </Canvas>
      </div>
    </WebGLErrorBoundary>
  );
}
