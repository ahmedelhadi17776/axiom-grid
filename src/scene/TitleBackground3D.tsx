import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MONOLITH_COUNT = 36;
const PACKET_COUNT = 18;

const PALETTE = [
  new THREE.Color('#00F0FF'),
  new THREE.Color('#A855F7'),
  new THREE.Color('#00FF9D'),
  new THREE.Color('#FFB800'),
];

interface MonolithSeed {
  x: number;
  z: number;
  baseH: number;
  amp: number;
  speed: number;
  phase: number;
  colorIdx: number;
}

interface PacketSeed {
  axis: 'x' | 'z';
  lane: number;
  speed: number;
  dir: 1 | -1;
  offset: number;
  colorIdx: number;
}

export function TitleBackground3D() {
  const monolithBodyRef = useRef<THREE.InstancedMesh | null>(null);
  const monolithCapRef = useRef<THREE.InstancedMesh | null>(null);
  const packetsRef = useRef<THREE.InstancedMesh | null>(null);
  const coreRef = useRef<THREE.Mesh | null>(null);
  const outerRingRef = useRef<THREE.Mesh | null>(null);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const monoliths = useMemo<MonolithSeed[]>(() => {
    const items: MonolithSeed[] = [];
    const coords = [-7.5, -5.0, -2.5, 2.5, 5.0, 7.5];
    let idx = 0;
    for (const x of coords) {
      for (const z of coords) {
        if (Math.abs(x) < 2.2 && Math.abs(z) < 2.2) continue;
        const dist = Math.hypot(x, z);
        items.push({
          x,
          z,
          baseH: 0.45 + ((idx * 17) % 10) * 0.16 + Math.max(0, 1.2 - dist * 0.12),
          amp: 0.16 + ((idx * 13) % 5) * 0.05,
          speed: 0.7 + ((idx * 7) % 5) * 0.22,
          phase: idx * 0.65,
          colorIdx: idx % PALETTE.length,
        });
        idx++;
      }
    }
    return items.slice(0, MONOLITH_COUNT);
  }, []);

  const packets = useMemo<PacketSeed[]>(() => {
    const lanes = [-6.25, -3.75, -1.25, 1.25, 3.75, 6.25];
    const items: PacketSeed[] = [];
    for (let i = 0; i < PACKET_COUNT; i++) {
      items.push({
        axis: i % 2 === 0 ? 'x' : 'z',
        lane: lanes[i % lanes.length],
        speed: 2.2 + (i % 4) * 0.85,
        dir: i % 3 === 0 ? -1 : 1,
        offset: (i * 3.1) % 20,
        colorIdx: i % PALETTE.length,
      });
    }
    return items;
  }, []);

  const rails = useMemo(() => [-6.25, -3.75, -1.25, 1.25, 3.75, 6.25], []);

  useEffect(() => {
    if (monolithCapRef.current) {
      monoliths.forEach((m, i) => {
        monolithCapRef.current!.setColorAt(i, PALETTE[m.colorIdx]);
      });
      if (monolithCapRef.current.instanceColor) {
        monolithCapRef.current.instanceColor.needsUpdate = true;
      }
    }
    if (packetsRef.current) {
      packets.forEach((p, i) => {
        packetsRef.current!.setColorAt(i, PALETTE[p.colorIdx]);
      });
      if (packetsRef.current.instanceColor) {
        packetsRef.current.instanceColor.needsUpdate = true;
      }
    }
  }, [monoliths, packets]);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const dt = Math.min(delta, 0.05);

    if (monolithBodyRef.current && monolithCapRef.current) {
      for (let i = 0; i < monoliths.length; i++) {
        const m = monoliths[i];
        const h = m.baseH + Math.sin(t * m.speed + m.phase) * m.amp;

        dummy.position.set(m.x, h * 0.5, m.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(0.86, h, 0.86);
        dummy.updateMatrix();
        monolithBodyRef.current.setMatrixAt(i, dummy.matrix);

        dummy.position.set(m.x, h + 0.045, m.z);
        dummy.scale.set(0.88, 0.07, 0.88);
        dummy.updateMatrix();
        monolithCapRef.current.setMatrixAt(i, dummy.matrix);
      }
      monolithBodyRef.current.instanceMatrix.needsUpdate = true;
      monolithCapRef.current.instanceMatrix.needsUpdate = true;
    }

    if (packetsRef.current) {
      for (let i = 0; i < packets.length; i++) {
        const p = packets[i];
        const span = 20;
        const raw = ((t * p.speed + p.offset) % span) - span / 2;
        const coord = raw * p.dir;
        const x = p.axis === 'x' ? coord : p.lane;
        const z = p.axis === 'z' ? coord : p.lane;

        dummy.position.set(x, 0.22, z);
        dummy.rotation.set(t * 2.4, t * 1.8, 0);
        dummy.scale.set(0.18, 0.18, 0.18);
        dummy.updateMatrix();
        packetsRef.current.setMatrixAt(i, dummy.matrix);
      }
      packetsRef.current.instanceMatrix.needsUpdate = true;
    }

    if (coreRef.current) {
      coreRef.current.rotation.y += dt * 0.55;
      coreRef.current.rotation.x = Math.sin(t * 0.6) * 0.25;
      coreRef.current.position.y = 2.0 + Math.sin(t * 1.5) * 0.22;
    }

    if (outerRingRef.current) {
      outerRingRef.current.rotation.z -= dt * 0.35;
    }
  });

  return (
    <group>
      {/* Glowing circuit rails */}
      {rails.map((lane) => (
        <group key={lane}>
          <mesh position={[0, 0.03, lane]}>
            <boxGeometry args={[20, 0.03, 0.06]} />
            <meshStandardMaterial
              color="#0D2240"
              emissive="#00F0FF"
              emissiveIntensity={0.45}
              roughness={0.4}
            />
          </mesh>
          <mesh position={[lane, 0.03, 0]}>
            <boxGeometry args={[0.06, 0.03, 20]} />
            <meshStandardMaterial
              color="#1A1538"
              emissive="#A855F7"
              emissiveIntensity={0.38}
              roughness={0.4}
            />
          </mesh>
        </group>
      ))}

      {/* Extruded obsidian monolith bodies */}
      <instancedMesh ref={monolithBodyRef} args={[undefined, undefined, monoliths.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#0D1426" roughness={0.45} metalness={0.65} />
      </instancedMesh>

      {/* Neon monolith top caps */}
      <instancedMesh ref={monolithCapRef} args={[undefined, undefined, monoliths.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={1.6}
          toneMapped={false}
          roughness={0.2}
        />
      </instancedMesh>

      {/* Traveling glowing data-packet orbs */}
      <instancedMesh ref={packetsRef} args={[undefined, undefined, packets.length]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={2.2}
          toneMapped={false}
          roughness={0.1}
        />
      </instancedMesh>

      {/* Central floating AXIOM core */}
      <mesh ref={coreRef} position={[0, 2.0, 0]}>
        <octahedronGeometry args={[1.05, 0]} />
        <meshStandardMaterial
          color="#081C2E"
          emissive="#00F0FF"
          emissiveIntensity={1.7}
          toneMapped={false}
          wireframe
        />
      </mesh>

      {/* Central holographic base rings */}
      <mesh ref={outerRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <ringGeometry args={[1.65, 1.85, 6]} />
        <meshStandardMaterial
          color="#00F0FF"
          emissive="#00F0FF"
          emissiveIntensity={1.6}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}
