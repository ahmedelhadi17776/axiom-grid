import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

const MONOLITH_COUNT = 36;
const PACKET_COUNT = 18;

const PALETTE = [
  new THREE.Color('#38BDF8'), // Sky-cyan
  new THREE.Color('#2DD4BF'), // Luminous teal
  new THREE.Color('#A78BFA'), // Soft lavender-violet
  new THREE.Color('#FBBF24'), // Warm gold-amber
  new THREE.Color('#34D399'), // Calm emerald
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
  const coreGroupRef = useRef<THREE.Group | null>(null);
  const innerCrystalRef = useRef<THREE.Mesh | null>(null);
  const gyroARef = useRef<THREE.Mesh | null>(null);
  const gyroBRef = useRef<THREE.Mesh | null>(null);
  const satellitesRef = useRef<THREE.Group | null>(null);
  const outerRingRef = useRef<THREE.Mesh | null>(null);
  const innerRingRef = useRef<THREE.Mesh | null>(null);

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
          amp: 0.14 + ((idx * 13) % 5) * 0.045,
          speed: 0.55 + ((idx * 7) % 5) * 0.18,
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
        speed: 1.9 + (i % 4) * 0.7,
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
        dummy.scale.set(0.84, h, 0.84);
        dummy.updateMatrix();
        monolithBodyRef.current.setMatrixAt(i, dummy.matrix);

        dummy.position.set(m.x, h + 0.04, m.z);
        dummy.scale.set(0.88, 0.06, 0.88);
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
        dummy.rotation.set(t * 1.8, t * 1.4, 0);
        dummy.scale.set(0.16, 0.16, 0.16);
        dummy.updateMatrix();
        packetsRef.current.setMatrixAt(i, dummy.matrix);
      }
      packetsRef.current.instanceMatrix.needsUpdate = true;
    }

    if (coreGroupRef.current) {
      coreGroupRef.current.position.y = 2.05 + Math.sin(t * 1.2) * 0.18;
    }

    if (innerCrystalRef.current) {
      innerCrystalRef.current.rotation.y += dt * 0.48;
      innerCrystalRef.current.rotation.x = Math.sin(t * 0.5) * 0.2;
    }

    if (gyroARef.current) {
      gyroARef.current.rotation.x += dt * 0.32;
      gyroARef.current.rotation.y += dt * 0.24;
    }

    if (gyroBRef.current) {
      gyroBRef.current.rotation.y -= dt * 0.28;
      gyroBRef.current.rotation.z += dt * 0.22;
    }

    if (satellitesRef.current) {
      satellitesRef.current.rotation.y += dt * 0.42;
    }

    if (outerRingRef.current) {
      outerRingRef.current.rotation.z -= dt * 0.24;
    }

    if (innerRingRef.current) {
      innerRingRef.current.rotation.z += dt * 0.34;
    }
  });

  return (
    <group>
      {/* Calm luminous circuit rails */}
      {rails.map((lane) => (
        <group key={lane}>
          <mesh position={[0, 0.03, lane]}>
            <boxGeometry args={[20, 0.028, 0.055]} />
            <meshStandardMaterial
              color="#14233C"
              emissive="#38BDF8"
              emissiveIntensity={0.28}
              roughness={0.45}
            />
          </mesh>
          <mesh position={[lane, 0.03, 0]}>
            <boxGeometry args={[0.055, 0.028, 20]} />
            <meshStandardMaterial
              color="#1C1A3A"
              emissive="#A78BFA"
              emissiveIntensity={0.24}
              roughness={0.45}
            />
          </mesh>
        </group>
      ))}

      {/* Extruded Midnight Slate monolith bodies */}
      <instancedMesh ref={monolithBodyRef} args={[undefined, undefined, monoliths.length]} castShadow receiveShadow>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#131D33" roughness={0.42} metalness={0.62} />
      </instancedMesh>

      {/* Calm luminous monolith top caps */}
      <instancedMesh ref={monolithCapRef} args={[undefined, undefined, monoliths.length]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={1.25}
          toneMapped={false}
          roughness={0.24}
        />
      </instancedMesh>

      {/* Traveling data-packet crystals */}
      <instancedMesh ref={packetsRef} args={[undefined, undefined, packets.length]}>
        <octahedronGeometry args={[1, 0]} />
        <meshStandardMaterial
          color="#ffffff"
          emissive="#ffffff"
          emissiveIntensity={1.45}
          toneMapped={false}
          roughness={0.18}
        />
      </instancedMesh>

      {/* Central floating AXIOM core: frosted crystal + wireframe cage + orbital rings + satellites */}
      <group ref={coreGroupRef} position={[0, 2.05, 0]}>
        {/* Inner glowing crystal core */}
        <mesh ref={innerCrystalRef}>
          <octahedronGeometry args={[0.68, 0]} />
          <meshStandardMaterial
            color="#10293D"
            emissive="#2DD4BF"
            emissiveIntensity={1.25}
            roughness={0.18}
            metalness={0.35}
            transparent
            opacity={0.86}
            toneMapped={false}
          />
        </mesh>

        {/* Outer geometric wireframe shell */}
        <mesh rotation={[0.3, 0.6, 0]}>
          <octahedronGeometry args={[1.08, 0]} />
          <meshStandardMaterial
            color="#38BDF8"
            emissive="#38BDF8"
            emissiveIntensity={1.15}
            toneMapped={false}
            wireframe
          />
        </mesh>

        {/* Orbital gyroscope ring A (sky-cyan) */}
        <mesh ref={gyroARef} rotation={[Math.PI / 3, 0.2, 0]}>
          <torusGeometry args={[1.45, 0.028, 12, 48]} />
          <meshStandardMaterial
            color="#38BDF8"
            emissive="#38BDF8"
            emissiveIntensity={1.15}
            toneMapped={false}
            roughness={0.25}
            metalness={0.6}
          />
        </mesh>

        {/* Orbital gyroscope ring B (lavender-violet) */}
        <mesh ref={gyroBRef} rotation={[-Math.PI / 3.2, 0.6, 0.3]}>
          <torusGeometry args={[1.72, 0.024, 12, 48]} />
          <meshStandardMaterial
            color="#A78BFA"
            emissive="#A78BFA"
            emissiveIntensity={1.1}
            toneMapped={false}
            roughness={0.25}
            metalness={0.6}
          />
        </mesh>

        {/* Orbiting satellite crystals */}
        <group ref={satellitesRef}>
          <mesh position={[1.95, 0.15, 0]}>
            <octahedronGeometry args={[0.13, 0]} />
            <meshStandardMaterial color="#2DD4BF" emissive="#2DD4BF" emissiveIntensity={1.35} toneMapped={false} />
          </mesh>
          <mesh position={[-0.98, -0.1, 1.69]}>
            <octahedronGeometry args={[0.12, 0]} />
            <meshStandardMaterial color="#FBBF24" emissive="#FBBF24" emissiveIntensity={1.35} toneMapped={false} />
          </mesh>
          <mesh position={[-0.98, 0.22, -1.69]}>
            <octahedronGeometry args={[0.12, 0]} />
            <meshStandardMaterial color="#A78BFA" emissive="#A78BFA" emissiveIntensity={1.35} toneMapped={false} />
          </mesh>
        </group>
      </group>

      {/* Stacked central holographic base plinth */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, 0.06, 0]} receiveShadow>
          <cylinderGeometry args={[1.45, 1.62, 0.12, 6]} />
          <meshStandardMaterial color="#131D33" roughness={0.38} metalness={0.72} />
        </mesh>
        <mesh ref={innerRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.13, 0]}>
          <ringGeometry args={[1.05, 1.2, 6]} />
          <meshStandardMaterial
            color="#2DD4BF"
            emissive="#2DD4BF"
            emissiveIntensity={1.15}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh ref={outerRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <ringGeometry args={[1.72, 1.9, 6]} />
          <meshStandardMaterial
            color="#38BDF8"
            emissive="#38BDF8"
            emissiveIntensity={1.2}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>
    </group>
  );
}
