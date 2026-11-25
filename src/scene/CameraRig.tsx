import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import type { AnyWorldState } from '../engine/types';

export interface CameraRigProps {
  mode: 'backdrop' | 'world';
  worldState?: AnyWorldState;
  resetCameraSignal?: number;
}

const DEFAULT_POS = new THREE.Vector3(20, 20, 20);
const DEFAULT_TARGET = new THREE.Vector3(0, 0, 0);

function computeIdealZoom(
  mode: 'backdrop' | 'world',
  worldState: AnyWorldState | undefined,
  width: number,
  height: number
): number {
  const minDim = Math.max(320, Math.min(width, height));
  const aspectFactor = Math.min(1.15, Math.max(0.75, width / Math.max(1, height) * 0.72));

  let worldSpan = 14;
  if (mode === 'backdrop' || !worldState) {
    worldSpan = 15.5;
  } else if (worldState.world === 'arrays') {
    const count = Math.max(4, worldState.slots.length);
    worldSpan = Math.max(11, count * 1.65 + 2.8);
  } else if (worldState.world === 'linked-lists') {
    const nodes = Object.values(worldState.nodes);
    if (nodes.length > 0) {
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const n of nodes) {
        minX = Math.min(minX, n.pos[0]);
        maxX = Math.max(maxX, n.pos[0]);
        minZ = Math.min(minZ, n.pos[2]);
        maxZ = Math.max(maxZ, n.pos[2]);
      }
      const spanX = maxX - minX + 6.5; // account for NULL pad
      const spanZ = maxZ - minZ + 5.0;
      worldSpan = Math.max(11, spanX, spanZ);
    } else {
      worldSpan = 12;
    }
  } else if (worldState.world === 'stacks-queues') {
    worldSpan = 16.5;
  } else if (worldState.world === 'pathfinding') {
    const maxGrid = Math.max(worldState.width, worldState.height);
    worldSpan = Math.max(10, maxGrid * 1.48 + 2.5);
  }

  const rawZoom = (minDim / worldSpan) * 0.88 * aspectFactor;
  return THREE.MathUtils.clamp(rawZoom, 24, 78);
}

export function CameraRig({ mode, worldState, resetCameraSignal = 0 }: CameraRigProps) {
  const { camera, size } = useThree();
  const controlsRef = useRef<OrbitControlsImpl | null>(null);
  const resettingRef = useRef(true);
  const lastWorldKeyRef = useRef<string>('');

  const idealZoom = useMemo(
    () => computeIdealZoom(mode, worldState, size.width, size.height),
    [mode, worldState, size.width, size.height]
  );

  // Trigger smooth camera reset when resetCameraSignal increments or world/mode changes
  const worldKey = `${mode}:${worldState?.world ?? 'none'}`;
  useEffect(() => {
    if (lastWorldKeyRef.current !== worldKey) {
      lastWorldKeyRef.current = worldKey;
      resettingRef.current = true;
    }
  }, [worldKey]);

  useEffect(() => {
    if (resetCameraSignal > 0) {
      resettingRef.current = true;
    }
  }, [resetCameraSignal]);

  // Initial camera setup
  useEffect(() => {
    camera.position.copy(DEFAULT_POS);
    camera.lookAt(DEFAULT_TARGET);
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = idealZoom;
      camera.updateProjectionMatrix();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const controls = controlsRef.current;

    if (mode === 'backdrop') {
      const t = state.clock.elapsedTime * 0.14;
      const targetX = Math.cos(t + Math.PI / 4) * 26;
      const targetZ = Math.sin(t + Math.PI / 4) * 26;
      const targetY = 19.5 + Math.sin(t * 0.8) * 1.4;

      camera.position.x = THREE.MathUtils.lerp(camera.position.x, targetX, dt * 1.8);
      camera.position.y = THREE.MathUtils.lerp(camera.position.y, targetY, dt * 1.8);
      camera.position.z = THREE.MathUtils.lerp(camera.position.z, targetZ, dt * 1.8);
      camera.lookAt(DEFAULT_TARGET);

      if (camera instanceof THREE.OrthographicCamera) {
        const nextZoom = THREE.MathUtils.lerp(camera.zoom, idealZoom, dt * 2.5);
        if (Math.abs(nextZoom - camera.zoom) > 0.01) {
          camera.zoom = nextZoom;
          camera.updateProjectionMatrix();
        }
      }
      return;
    }

    if (resettingRef.current) {
      const alpha = 1 - Math.exp(-dt * 6.5);
      camera.position.lerp(DEFAULT_POS, alpha);

      if (controls) {
        controls.target.lerp(DEFAULT_TARGET, alpha);
        controls.update();
      } else {
        camera.lookAt(DEFAULT_TARGET);
      }

      let zoomDone = true;
      if (camera instanceof THREE.OrthographicCamera) {
        camera.zoom = THREE.MathUtils.lerp(camera.zoom, idealZoom, alpha);
        camera.updateProjectionMatrix();
        zoomDone = Math.abs(camera.zoom - idealZoom) < 0.15;
      }

      const posDone = camera.position.distanceToSquared(DEFAULT_POS) < 0.04;
      const targetDone = !controls || controls.target.distanceToSquared(DEFAULT_TARGET) < 0.01;

      if (posDone && targetDone && zoomDone) {
        resettingRef.current = false;
      }
    } else if (controls) {
      // Clamp pan target inside reasonable arena bounds
      controls.target.x = THREE.MathUtils.clamp(controls.target.x, -14, 14);
      controls.target.y = THREE.MathUtils.clamp(controls.target.y, -1, 4);
      controls.target.z = THREE.MathUtils.clamp(controls.target.z, -14, 14);
    }
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enableRotate={mode === 'world'}
      enablePan={mode === 'world'}
      enableZoom={mode === 'world'}
      minPolarAngle={Math.PI / 5}
      maxPolarAngle={Math.PI / 2.6}
      minZoom={20}
      maxZoom={95}
      onStart={() => {
        resettingRef.current = false;
      }}
    />
  );
}
