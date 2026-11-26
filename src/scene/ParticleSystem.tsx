import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AnyWorldState, SimEvent, SimEventType } from '../engine/types';

export interface ParticleSystemProps {
  activeEvent?: SimEvent | null;
  worldState?: AnyWorldState;
}

const AMBIENT_COUNT = 56;
const BURST_COUNT = 160;
const TOTAL_COUNT = AMBIENT_COUNT + BURST_COUNT;

const COLOR_CYAN = new THREE.Color('#38BDF8');
const COLOR_TEAL = new THREE.Color('#2DD4BF');
const COLOR_AMBER = new THREE.Color('#FBBF24');
const COLOR_EMERALD = new THREE.Color('#34D399');
const COLOR_CRIMSON = new THREE.Color('#FB7185');
const COLOR_VIOLET = new THREE.Color('#A78BFA');
const COLOR_INDIGO = new THREE.Color('#818CF8');
const COLOR_ORANGE = new THREE.Color('#FB923C');
const COLOR_ROSE = new THREE.Color('#F472B6');

function getEventColor(type: SimEventType): THREE.Color {
  switch (type) {
    case 'SWAP':
    case 'COMPARE':
    case 'RELAX_EDGE':
    case 'ROTATE_LEFT':
    case 'ROTATE_RIGHT':
    case 'COLLISION':
    case 'SIFT_DOWN':
      return COLOR_AMBER;
    case 'INSERT_NODE':
      return COLOR_TEAL;
    case 'DP_COMPUTE':
      return COLOR_INDIGO;
    case 'HASH_PROBE':
      return COLOR_ORANGE;
    case 'SIFT_UP':
    case 'HEAPIFY':
      return COLOR_ROSE;
    case 'SUCCESS':
    case 'PATH_FOUND':
    case 'DP_TRACE':
    case 'EXTRACT_ROOT':
      return COLOR_EMERALD;
    case 'MEMORY_LEAK':
    case 'OVERFLOW':
    case 'UNDERFLOW':
    case 'NULL_DEREF':
    case 'BOUNDS_FAULT':
    case 'CYCLE_DETECTED':
    case 'NO_PATH':
    case 'INVARIANT_FAULT':
    case 'FAIL':
      return COLOR_CRIMSON;
    case 'POP':
    case 'DEQUEUE':
    case 'UNLINK':
    case 'DELETE_NODE':
    case 'TOMBSTONE':
      return COLOR_VIOLET;
    case 'PROBE':
    case 'REHASH':
    default:
      return COLOR_CYAN;
  }
}

function getBurstOrigin(
  event: SimEvent,
  worldState: AnyWorldState | undefined,
  out: THREE.Vector3
): void {
  out.set(0, 1.4, 0);
  if (!worldState || event.targets.length === 0) return;

  const target = event.targets[0];

  if (worldState.world === 'arrays') {
    const n = worldState.slots.length;
    const spacing = 1.6;
    const offset = ((n - 1) * spacing) / 2;
    let idx = worldState.slots.findIndex((s) => s.id === target);
    if (idx === -1) {
      const parsed = Number(target);
      if (Number.isInteger(parsed) && parsed >= 0 && parsed < n) idx = parsed;
    }
    if (idx >= 0) {
      out.set(idx * spacing - offset, 1.6, 0);
    }
  } else if (worldState.world === 'linked-lists') {
    const node = worldState.nodes[target];
    if (node) {
      out.set(node.pos[0], node.pos[1] + 1.2, node.pos[2]);
    }
  } else if (worldState.world === 'trees') {
    const node = worldState.nodes[target];
    if (node) {
      out.set(node.pos[0], node.pos[1] + 1.0, node.pos[2]);
    }
  } else if (worldState.world === 'dp') {
    const parts = target.split(',');
    if (parts.length === 2) {
      const r = Number(parts[0]);
      const c = Number(parts[1]);
      if (Number.isFinite(r) && Number.isFinite(c)) {
        const spacing = 1.42;
        const ox = ((worldState.cols - 1) * spacing) / 2;
        const oz = ((worldState.rows - 1) * spacing) / 2;
        out.set(c * spacing - ox, 1.2, r * spacing - oz);
      }
    }
  } else if (worldState.world === 'hash-table') {
    const cleaned = target.replace(/^b/i, '');
    const idx = Number(cleaned);
    if (Number.isInteger(idx) && idx >= 0 && idx < worldState.capacity) {
      const spacing = 1.5;
      const ox = ((worldState.capacity - 1) * spacing) / 2;
      out.set(idx * spacing - ox, 1.15, 0);
    }
  } else if (worldState.world === 'heap') {
    let idx = worldState.items.findIndex((item) => item.id === target);
    if (idx === -1) {
      const parsed = Number(target);
      if (Number.isInteger(parsed) && parsed >= 0 && parsed < worldState.items.length) {
        idx = parsed;
      }
    }
    if (idx >= 0) {
      const n = Math.max(1, worldState.items.length);
      const spacing = 1.35;
      const ox = ((n - 1) * spacing) / 2;
      out.set(idx * spacing - ox, 1.5, 0.2);
    }
  } else if (worldState.world === 'pathfinding') {
    const parts = target.split(',');
    if (parts.length === 2) {
      const gx = Number(parts[0]);
      const gy = Number(parts[1]);
      if (Number.isFinite(gx) && Number.isFinite(gy)) {
        const cellSize = 1.08;
        const ox = ((worldState.width - 1) * cellSize) / 2;
        const oz = ((worldState.height - 1) * cellSize) / 2;
        out.set(gx * cellSize - ox, 0.9, gy * cellSize - oz);
      }
    }
  }
}

export function ParticleSystem({ activeEvent, worldState }: ParticleSystemProps) {
  const meshRef = useRef<THREE.InstancedMesh | null>(null);
  const lastEventIdRef = useRef<number | null>(null);
  const burstCursorRef = useRef(0);

  // Zero-GC pre-allocated typed arrays & scratch objects
  const pool = useMemo(() => {
    const px = new Float32Array(TOTAL_COUNT);
    const py = new Float32Array(TOTAL_COUNT);
    const pz = new Float32Array(TOTAL_COUNT);
    const vx = new Float32Array(TOTAL_COUNT);
    const vy = new Float32Array(TOTAL_COUNT);
    const vz = new Float32Array(TOTAL_COUNT);
    const life = new Float32Array(TOTAL_COUNT);
    const maxLife = new Float32Array(TOTAL_COUNT);
    const baseScale = new Float32Array(TOTAL_COUNT);
    const phase = new Float32Array(TOTAL_COUNT);

    // Initialize floating ambient data motes
    for (let i = 0; i < AMBIENT_COUNT; i++) {
      px[i] = (Math.random() - 0.5) * 26;
      py[i] = 0.5 + Math.random() * 6.5;
      pz[i] = (Math.random() - 0.5) * 26;
      vx[i] = (Math.random() - 0.5) * 0.18;
      vy[i] = 0.12 + Math.random() * 0.22;
      vz[i] = (Math.random() - 0.5) * 0.18;
      life[i] = 1;
      maxLife[i] = 1;
      baseScale[i] = 0.045 + Math.random() * 0.04;
      phase[i] = Math.random() * Math.PI * 2;
    }

    // Burst slots start dormant (life = 0)
    for (let i = AMBIENT_COUNT; i < TOTAL_COUNT; i++) {
      life[i] = 0;
      maxLife[i] = 1;
      baseScale[i] = 0.08;
    }

    return {
      px,
      py,
      pz,
      vx,
      vy,
      vz,
      life,
      maxLife,
      baseScale,
      phase,
      dummy: new THREE.Object3D(),
      origin: new THREE.Vector3(),
      colorScratch: new THREE.Color(),
    };
  }, []);

  // Initialize ambient mote colors once
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    for (let i = 0; i < AMBIENT_COUNT; i++) {
      mesh.setColorAt(i, i % 3 === 0 ? COLOR_VIOLET : COLOR_CYAN);
    }
    for (let i = AMBIENT_COUNT; i < TOTAL_COUNT; i++) {
      mesh.setColorAt(i, COLOR_CYAN);
    }
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, []);

  // Emit burst whenever activeEvent changes
  useEffect(() => {
    if (!activeEvent || activeEvent.type === 'INIT') return;
    if (lastEventIdRef.current === activeEvent.id) return;
    lastEventIdRef.current = activeEvent.id;

    const mesh = meshRef.current;
    if (!mesh) return;

    const color = getEventColor(activeEvent.type);
    const isVictory =
      activeEvent.type === 'SUCCESS' ||
      activeEvent.type === 'PATH_FOUND' ||
      activeEvent.type === 'DP_TRACE';
    const isError =
      activeEvent.type === 'MEMORY_LEAK' ||
      activeEvent.type === 'OVERFLOW' ||
      activeEvent.type === 'NULL_DEREF' ||
      activeEvent.type === 'INVARIANT_FAULT' ||
      activeEvent.type === 'FAIL';

    const count = isVictory ? 48 : isError ? 34 : 20;
    getBurstOrigin(activeEvent, worldState, pool.origin);

    for (let k = 0; k < count; k++) {
      const idx = AMBIENT_COUNT + (burstCursorRef.current % BURST_COUNT);
      burstCursorRef.current = (burstCursorRef.current + 1) % BURST_COUNT;

      const angle = Math.random() * Math.PI * 2;
      const elev = (Math.random() - 0.15) * Math.PI * 0.5;
      const speed = isVictory
        ? 3.0 + Math.random() * 4.5
        : isError
          ? 2.4 + Math.random() * 3.2
          : 1.5 + Math.random() * 2.4;

      const spread = isVictory ? 2.4 : 0.45;
      pool.px[idx] = pool.origin.x + (Math.random() - 0.5) * spread;
      pool.py[idx] = pool.origin.y + (Math.random() - 0.5) * 0.4;
      pool.pz[idx] = pool.origin.z + (Math.random() - 0.5) * spread;

      pool.vx[idx] = Math.cos(angle) * Math.cos(elev) * speed;
      pool.vy[idx] = Math.abs(Math.sin(elev)) * speed + (isVictory ? 2.4 : 1.1);
      pool.vz[idx] = Math.sin(angle) * Math.cos(elev) * speed;

      const dur = isVictory ? 1.1 + Math.random() * 0.6 : 0.55 + Math.random() * 0.4;
      pool.maxLife[idx] = dur;
      pool.life[idx] = dur;
      pool.baseScale[idx] = isVictory ? 0.11 + Math.random() * 0.06 : 0.075 + Math.random() * 0.04;

      // Slight color shimmer on victory
      if (isVictory && k % 3 === 0) {
        mesh.setColorAt(idx, COLOR_CYAN);
      } else {
        mesh.setColorAt(idx, color);
      }
    }

    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }
  }, [activeEvent, worldState, pool]);

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const dt = Math.min(delta, 0.05);
    const t = state.clock.elapsedTime;
    const { px, py, pz, vx, vy, vz, life, maxLife, baseScale, phase, dummy } = pool;

    // Update floating ambient data motes
    for (let i = 0; i < AMBIENT_COUNT; i++) {
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
      pz[i] += vz[i] * dt;

      if (py[i] > 7.5) {
        py[i] = 0.3;
        px[i] = (Math.random() - 0.5) * 26;
        pz[i] = (Math.random() - 0.5) * 26;
      }

      const pulse = 0.75 + 0.35 * Math.sin(t * 2.2 + phase[i]);
      const s = baseScale[i] * pulse;
      dummy.position.set(px[i], py[i], pz[i]);
      dummy.rotation.set(t * 0.6 + phase[i], t * 0.8, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    // Update burst sparks
    for (let i = AMBIENT_COUNT; i < TOTAL_COUNT; i++) {
      if (life[i] <= 0) {
        dummy.position.set(0, -50, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      life[i] -= dt;
      if (life[i] <= 0) {
        life[i] = 0;
        dummy.position.set(0, -50, 0);
        dummy.scale.set(0, 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        continue;
      }

      vy[i] -= 6.2 * dt; // soft gravity
      px[i] += vx[i] * dt;
      py[i] += vy[i] * dt;
      pz[i] += vz[i] * dt;

      if (py[i] < 0.05) {
        py[i] = 0.05;
        vy[i] = Math.abs(vy[i]) * 0.38;
        vx[i] *= 0.78;
        vz[i] *= 0.78;
      }

      const norm = life[i] / maxLife[i];
      const s = baseScale[i] * norm;
      dummy.position.set(px[i], py[i], pz[i]);
      dummy.rotation.set(t * 4 + i, t * 3, 0);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, TOTAL_COUNT]} frustumCulled={false}>
      <octahedronGeometry args={[1, 0]} />
      <meshStandardMaterial
        color="#ffffff"
        emissive="#ffffff"
        emissiveIntensity={1.45}
        toneMapped={false}
        roughness={0.22}
      />
    </instancedMesh>
  );
}
