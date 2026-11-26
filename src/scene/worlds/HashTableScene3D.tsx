import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type {
  HashBeam,
  HashBucket,
  HashEntry,
  HashTableWorldState,
} from '../../engine/types';
import type { DirectAction } from '../IsometricCanvas';
import { CanvasLabel } from '../CanvasLabel';
import { soundEngine } from '../../audio/soundEngine';

export interface HashTableScene3DProps {
  state: HashTableWorldState;
  interactive: boolean;
  onDirectAction?: (action: DirectAction) => void;
}

function getBucketAccent(
  bucket: HashBucket,
  isFoundBucket: boolean,
  isHovered: boolean,
  entryState?: HashEntry['state'],
): {
  body: string;
  emissive: string;
  intensity: number;
  border: string;
} {
  if (isFoundBucket || bucket.state === 'found' || entryState === 'found') {
    return {
      body: '#0E2B22',
      emissive: '#34D399',
      intensity: 1.5,
      border: '#34D399',
    };
  }
  if (bucket.state === 'collision' || entryState === 'collision') {
    return {
      body: '#2E1420',
      emissive: '#FB7185',
      intensity: 1.5,
      border: '#FB7185',
    };
  }
  if (bucket.state === 'probing') {
    return {
      body: '#2B210E',
      emissive: '#FBBF24',
      intensity: 1.4,
      border: '#FBBF24',
    };
  }
  if (bucket.tombstone || bucket.state === 'tombstone') {
    return {
      body: '#1D1833',
      emissive: '#A78BFA',
      intensity: isHovered ? 1.25 : 0.95,
      border: '#A78BFA',
    };
  }
  if (entryState === 'rehashed') {
    return {
      body: '#10263D',
      emissive: '#38BDF8',
      intensity: 1.35,
      border: '#38BDF8',
    };
  }
  if (bucket.state === 'active' || entryState === 'active') {
    return {
      body: '#2C1C12',
      emissive: '#FB923C',
      intensity: 1.45,
      border: '#FB923C',
    };
  }
  return {
    body: isHovered ? '#291E18' : '#1E1B28',
    emissive: isHovered ? '#FDBA74' : '#FB923C',
    intensity: isHovered ? 1.3 : 1.05,
    border: isHovered ? '#FDBA74' : '#FB923C',
  };
}

interface HashPrismProps {
  capacity: number;
  pendingKeys: Array<{ key: number; value: string }>;
  searchTarget?: number;
  foundBucket?: number | null;
  loadFactor: number;
  loadFactorThreshold: number;
  collisions: number;
}

function HashPrism({
  capacity,
  pendingKeys,
  searchTarget,
  foundBucket,
  loadFactor,
  loadFactorThreshold,
  collisions,
}: HashPrismProps) {
  const crystalRef = useRef<THREE.Mesh | null>(null);
  const gimbalRef = useRef<THREE.Mesh | null>(null);
  const innerGimbalRef = useRef<THREE.Mesh | null>(null);

  const nextItem = pendingKeys[0];
  const safeCap = Math.max(1, capacity);
  const hashedNext = nextItem
    ? ((nextItem.key % safeCap) + safeCap) % safeCap
    : null;
  const hashedSearch =
    searchTarget !== undefined
      ? ((searchTarget % safeCap) + safeCap) % safeCap
      : null;

  const isFound = foundBucket !== undefined && foundBucket !== null;
  const loadPct = Math.round(loadFactor * 100);
  const loadColor =
    loadFactor >= loadFactorThreshold
      ? '#FB7185'
      : loadFactor >= loadFactorThreshold * 0.78
        ? '#FBBF24'
        : '#34D399';

  const prismColor = isFound ? '#34D399' : '#FB923C';

  useFrame((clockState) => {
    const t = clockState.clock.elapsedTime;
    if (crystalRef.current) {
      crystalRef.current.rotation.y = t * 0.95;
      crystalRef.current.rotation.x = Math.sin(t * 0.7) * 0.14;
      crystalRef.current.position.y = 1.72 + Math.sin(t * 2.2) * 0.08;
    }
    if (gimbalRef.current) {
      gimbalRef.current.rotation.z = t * 0.55;
      gimbalRef.current.rotation.x = Math.PI / 2 + Math.sin(t * 0.9) * 0.18;
    }
    if (innerGimbalRef.current) {
      innerGimbalRef.current.rotation.y = -t * 0.75;
    }
  });

  return (
    <group position={[0, 0, -3.4]}>
      {/* Ground Emitter Pedestal */}
      <mesh position={[0, 0.06, 0]} receiveShadow>
        <cylinderGeometry args={[0.92, 1.06, 0.12, 8]} />
        <meshStandardMaterial color="#131E34" roughness={0.38} metalness={0.72} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.13, 0]}>
        <ringGeometry args={[0.68, 0.8, 8]} />
        <meshStandardMaterial
          color={prismColor}
          emissive={prismColor}
          emissiveIntensity={1.25}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Hovering Luminous Hash Octahedron Prism */}
      <mesh ref={crystalRef} position={[0, 1.72, 0]} castShadow>
        <octahedronGeometry args={[0.54, 0]} />
        <meshStandardMaterial
          color="#1E1824"
          emissive={prismColor}
          emissiveIntensity={0.62}
          roughness={0.18}
          metalness={0.35}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Outer Metallic Gimbal Ring */}
      <mesh ref={gimbalRef} position={[0, 1.72, 0]}>
        <torusGeometry args={[0.84, 0.032, 10, 32]} />
        <meshStandardMaterial
          color={prismColor}
          emissive={prismColor}
          emissiveIntensity={1.35}
          toneMapped={false}
          roughness={0.22}
        />
      </mesh>

      {/* Inner Slate Stabilizer Ring */}
      <mesh ref={innerGimbalRef} position={[0, 1.72, 0]} rotation={[0.45, 0, 0.35]}>
        <torusGeometry args={[0.68, 0.025, 8, 24]} />
        <meshStandardMaterial color="#192742" roughness={0.32} metalness={0.75} />
      </mesh>

      {/* Hash Function Formula Badge */}
      <CanvasLabel
        text={`h(k) = k % ${capacity}`}
        position={[0, 2.74, 0]}
        scale={0.42}
        fontSize={36}
        color="#F8FAFC"
        background="rgba(11, 16, 28, 0.92)"
        borderColor="#FB923C"
      />

      {/* Next Key or Search Target Mapping Badge */}
      {nextItem && hashedNext !== null && (
        <CanvasLabel
          text={
            pendingKeys.length > 1
              ? `KEY ${nextItem.key} → h = ${hashedNext} (+${pendingKeys.length - 1})`
              : `KEY ${nextItem.key} → h = ${hashedNext}`
          }
          position={[0, 3.36, 0]}
          scale={0.46}
          fontSize={38}
          color="#FED7AA"
          background="rgba(26, 16, 12, 0.92)"
          borderColor="#FB923C"
        />
      )}

      {!nextItem && searchTarget !== undefined && hashedSearch !== null && (
        <CanvasLabel
          text={
            isFound
              ? `FOUND ${searchTarget} @ [${foundBucket}]`
              : `LOOKUP ${searchTarget} → h = ${hashedSearch}`
          }
          position={[0, 3.36, 0]}
          scale={0.46}
          fontSize={38}
          color={isFound ? '#34D399' : '#7DD3FC'}
          background="rgba(11, 18, 32, 0.92)"
          borderColor={isFound ? '#34D399' : '#38BDF8'}
        />
      )}

      {/* Live Load Factor Pill */}
      <CanvasLabel
        text={`LOAD: ${loadPct}%`}
        position={[-3.85, 1.95, 0]}
        scale={0.38}
        fontSize={34}
        color={loadColor}
        background="rgba(11, 16, 28, 0.9)"
        borderColor={loadColor}
      />

      {/* Collisions Counter Pill */}
      {collisions > 0 && (
        <CanvasLabel
          text={`COLLISIONS: ${collisions}`}
          position={[3.85, 1.95, 0]}
          scale={0.36}
          fontSize={32}
          color="#FB7185"
          background="rgba(30, 14, 22, 0.9)"
          borderColor="#FB7185"
        />
      )}
    </group>
  );
}

interface EnergyArcProps {
  from: [number, number, number];
  to: [number, number, number];
  arcHeight: number;
  color: string;
  radius?: number;
  speed?: number;
}

function EnergyArc({
  from,
  to,
  arcHeight,
  color,
  radius = 0.045,
  speed = 1.15,
}: EnergyArcProps) {
  const pulseRef = useRef<THREE.Mesh | null>(null);
  const pulsePos = useMemo(() => new THREE.Vector3(), []);

  const { curve, coreGeo, sheathGeo } = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const mid = start.clone().lerp(end, 0.5);
    mid.y += arcHeight;

    const c = new THREE.CatmullRomCurve3([start, mid, end]);
    const core = new THREE.TubeGeometry(c, 28, radius, 8, false);
    const sheath = new THREE.TubeGeometry(c, 28, radius * 2.05, 8, false);
    return { curve: c, coreGeo: core, sheathGeo: sheath };
  }, [from, to, arcHeight, radius]);

  useEffect(() => {
    return () => {
      coreGeo.dispose();
      sheathGeo.dispose();
    };
  }, [coreGeo, sheathGeo]);

  useFrame((clockState) => {
    if (!pulseRef.current) return;
    const t = (clockState.clock.elapsedTime * speed) % 1;
    curve.getPointAt(t, pulsePos);
    pulseRef.current.position.copy(pulsePos);
  });

  return (
    <group>
      <mesh geometry={coreGeo}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.45}
          toneMapped={false}
          roughness={0.2}
        />
      </mesh>
      <mesh geometry={sheathGeo}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.45}
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={pulseRef}>
        <sphereGeometry args={[radius * 2.4, 10, 10]} />
        <meshStandardMaterial
          color="#FFF7ED"
          emissive={color}
          emissiveIntensity={1.5}
          toneMapped={false}
          roughness={0.15}
        />
      </mesh>
    </group>
  );
}

interface HashBeamVisualProps {
  beam: HashBeam;
  getBucketX: (idx: number) => number;
  capacity: number;
}

function HashBeamVisual({ beam, getBucketX, capacity }: HashBeamVisualProps) {
  const safeTarget = THREE.MathUtils.clamp(beam.targetBucket, 0, Math.max(0, capacity - 1));
  const targetX = getBucketX(safeTarget);

  const probeHops = useMemo(() => {
    const hops: Array<{ from: [number, number, number]; to: [number, number, number]; key: string }> = [];
    if (!beam.probePath || beam.probePath.length < 2) return hops;
    for (let i = 0; i < beam.probePath.length - 1; i++) {
      const a = beam.probePath[i];
      const b = beam.probePath[i + 1];
      if (a < 0 || a >= capacity || b < 0 || b >= capacity) continue;
      hops.push({
        key: `${a}-${b}-${i}`,
        from: [getBucketX(a), 0.92, 0],
        to: [getBucketX(b), 0.92, 0],
      });
    }
    return hops;
  }, [beam.probePath, capacity, getBucketX]);

  return (
    <group>
      {/* Primary Laser Hash Beam from Prism to h(k) */}
      <EnergyArc
        from={[0, 1.72, -3.4]}
        to={[targetX, 0.95, 0]}
        arcHeight={0.95}
        color={beam.collided ? '#FB7185' : '#FB923C'}
        radius={0.048}
        speed={1.2}
      />

      {/* Amber Probe-Hop Arcs when Collisions Occurred */}
      {probeHops.map((hop) => (
        <EnergyArc
          key={hop.key}
          from={hop.from}
          to={hop.to}
          arcHeight={0.78}
          color="#FBBF24"
          radius={0.036}
          speed={1.45}
        />
      ))}
    </group>
  );
}

interface CrystalDataBlockProps {
  entry: HashEntry;
  bucket: HashBucket;
  isFound: boolean;
  isHovered: boolean;
  position?: [number, number, number];
  compact?: boolean;
}

function CrystalDataBlock({
  entry,
  bucket,
  isFound,
  isHovered,
  position = [0, 0, 0],
  compact = false,
}: CrystalDataBlockProps) {
  const blockRef = useRef<THREE.Group | null>(null);
  const visuals = getBucketAccent(bucket, isFound, isHovered, entry.state);
  const size = compact ? 0.84 : 0.96;
  const height = compact ? 0.72 : 0.88;

  useFrame((clockState, delta) => {
    if (!blockRef.current) return;
    const dt = Math.min(delta, 0.05);
    const t = clockState.clock.elapsedTime;
    const targetY =
      position[1] +
      (isFound
        ? 0.22 + Math.sin(t * 4.2) * 0.04
        : bucket.state === 'collision' || entry.state === 'collision'
          ? 0.16 + Math.sin(t * 7.5) * 0.04
          : isHovered
            ? 0.12
            : 0);
    blockRef.current.position.y = THREE.MathUtils.lerp(
      blockRef.current.position.y,
      targetY,
      1 - Math.exp(-dt * 10),
    );
  });

  const displayValue =
    entry.value && entry.value !== String(entry.key)
      ? `${entry.key}:${entry.value}`
      : String(entry.key);

  return (
    <group ref={blockRef} position={position}>
      {/* Lower metallic collar */}
      <mesh position={[0, 0.22, 0]} castShadow receiveShadow>
        <boxGeometry args={[size + 0.1, 0.12, size + 0.1]} />
        <meshStandardMaterial color="#162238" roughness={0.36} metalness={0.72} />
      </mesh>

      {/* Luminous frosted crystal data block */}
      <mesh position={[0, 0.28 + height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[size, height, size]} />
        <meshStandardMaterial
          color={visuals.body}
          emissive={visuals.emissive}
          emissiveIntensity={visuals.intensity * 0.36}
          roughness={0.24}
          metalness={0.48}
          transparent
          opacity={0.95}
        />
      </mesh>

      {/* Upper metallic bevel cap */}
      <mesh position={[0, 0.28 + height + 0.04, 0]} castShadow>
        <boxGeometry args={[size + 0.06, 0.08, size + 0.06]} />
        <meshStandardMaterial color="#192742" roughness={0.3} metalness={0.72} />
      </mesh>

      {/* Glowing top inlay strip */}
      <mesh position={[0, 0.28 + height + 0.095, 0]}>
        <boxGeometry args={[size * 0.86, 0.04, size * 0.86]} />
        <meshStandardMaterial
          color={visuals.emissive}
          emissive={visuals.emissive}
          emissiveIntensity={Math.min(1.5, visuals.intensity)}
          toneMapped={false}
          roughness={0.2}
        />
      </mesh>

      {/* Key / Value Label */}
      <CanvasLabel
        text={displayValue}
        position={[0, 0.28 + height + 0.54, 0]}
        scale={compact ? 0.36 : 0.42}
        fontSize={compact ? 36 : 40}
        color="#F8FAFC"
        background="rgba(11, 16, 28, 0.9)"
        borderColor={visuals.border}
      />
    </group>
  );
}

function TombstoneMarker({ isHovered }: { isHovered: boolean }) {
  const markerRef = useRef<THREE.Group | null>(null);
  const ringRef = useRef<THREE.Mesh | null>(null);

  useFrame((clockState) => {
    const t = clockState.clock.elapsedTime;
    if (markerRef.current) {
      markerRef.current.position.y = 0.58 + Math.sin(t * 2.4) * 0.05 + (isHovered ? 0.08 : 0);
      markerRef.current.rotation.y = t * 0.65;
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = -t * 0.9;
    }
  });

  return (
    <group>
      {/* Translucent holographic amber-violet [DEL] marker */}
      <group ref={markerRef} position={[0, 0.58, 0]}>
        <mesh>
          <octahedronGeometry args={[0.32, 0]} />
          <meshStandardMaterial
            color="#2E1B3D"
            emissive="#A78BFA"
            emissiveIntensity={0.65}
            transparent
            opacity={0.52}
            roughness={0.25}
            metalness={0.25}
          />
        </mesh>
        <mesh>
          <octahedronGeometry args={[0.35, 0]} />
          <meshStandardMaterial
            color="#F59E0B"
            emissive="#F59E0B"
            emissiveIntensity={0.95}
            wireframe
            transparent
            opacity={0.55}
          />
        </mesh>
      </group>

      {/* Holographic floor ring */}
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.19, 0]}>
        <ringGeometry args={[0.42, 0.5, 6]} />
        <meshStandardMaterial
          color="#A78BFA"
          emissive="#A78BFA"
          emissiveIntensity={1.1}
          toneMapped={false}
          transparent
          opacity={0.72}
          side={THREE.DoubleSide}
        />
      </mesh>

      <CanvasLabel
        text="[DEL]"
        position={[0, 1.32, 0]}
        scale={0.34}
        fontSize={34}
        color="#DDD6FE"
        background="rgba(26, 18, 42, 0.88)"
        borderColor="#A78BFA"
      />
    </group>
  );
}

interface BucketBayProps {
  bucket: HashBucket;
  xPos: number;
  baySize: number;
  strategy: HashTableWorldState['strategy'];
  isFoundBucket: boolean;
  isHovered: boolean;
  interactive: boolean;
  onHover: (idx: number | null) => void;
  onClick: (bucketIndex: number) => void;
}

function BucketBay({
  bucket,
  xPos,
  baySize,
  strategy,
  isFoundBucket,
  isHovered,
  interactive,
  onHover,
  onClick,
}: BucketBayProps) {
  const chainEntries = useMemo(() => {
    if (strategy !== 'chaining') return [];
    if (bucket.chain.length > 0) return bucket.chain;
    return bucket.entry ? [bucket.entry] : [];
  }, [strategy, bucket.chain, bucket.entry]);

  const bayVisuals = getBucketAccent(bucket, isFoundBucket, isHovered, bucket.entry?.state);
  const isEmpty =
    strategy === 'chaining'
      ? chainEntries.length === 0 && !bucket.tombstone
      : !bucket.entry && !bucket.tombstone;

  const rimColor = isFoundBucket
    ? '#34D399'
    : bucket.state === 'collision'
      ? '#FB7185'
      : bucket.state === 'probing'
        ? '#FBBF24'
        : bucket.tombstone
          ? '#A78BFA'
          : isHovered
            ? '#FDBA74'
            : isEmpty
              ? '#334155'
              : '#FB923C';

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
    onHover(bucket.index);
    soundEngine.playHover();
  };

  const handleOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'auto';
    onHover(null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    onClick(bucket.index);
  };

  const chainStepZ = 1.48;

  return (
    <group position={[xPos, 0, 0]}>
      {/* Metallic Vault Bay Collar */}
      <mesh
        position={[0, 0.08, 0]}
        receiveShadow
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        <boxGeometry args={[baySize, 0.14, 1.34]} />
        <meshStandardMaterial color="#162238" roughness={0.42} metalness={0.72} />
      </mesh>

      {/* Dark Recessed Vault Bed */}
      <mesh
        position={[0, 0.155, 0]}
        receiveShadow
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        <boxGeometry args={[baySize - 0.18, 0.04, 1.12]} />
        <meshStandardMaterial
          color="#0C1322"
          emissive={isHovered ? '#FB923C' : rimColor}
          emissiveIntensity={isHovered ? 0.35 : isEmpty ? 0.06 : 0.18}
          roughness={0.55}
          metalness={0.5}
        />
      </mesh>

      {/* Status Accent Perimeter Trim */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.18, 0]}>
        <ringGeometry args={[baySize * 0.43, baySize * 0.48, 4]} />
        <meshStandardMaterial
          color={rimColor}
          emissive={rimColor}
          emissiveIntensity={isEmpty && !isHovered ? 0.32 : Math.min(1.45, bayVisuals.intensity)}
          toneMapped={isEmpty && !isHovered}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Bucket Index Badge */}
      <CanvasLabel
        text={`[${bucket.index}]`}
        position={[0, 0.16, -0.98]}
        scale={0.32}
        fontSize={34}
        color={isFoundBucket ? '#34D399' : isHovered ? '#FED7AA' : '#94A3B8'}
        background="rgba(11, 16, 28, 0.88)"
        borderColor={
          isFoundBucket
            ? '#34D399'
            : isHovered
              ? '#FB923C'
              : 'rgba(51, 65, 85, 0.75)'
        }
      />

      {/* Linear Probing Mode: Single Crystal Block or Tombstone */}
      {strategy === 'linear' && bucket.entry && (
        <group onPointerOver={handleOver} onPointerOut={handleOut} onClick={handleClick}>
          <CrystalDataBlock
            entry={bucket.entry}
            bucket={bucket}
            isFound={isFoundBucket}
            isHovered={isHovered}
          />
        </group>
      )}

      {strategy === 'linear' && !bucket.entry && bucket.tombstone && (
        <group onPointerOver={handleOver} onPointerOut={handleOut} onClick={handleClick}>
          <TombstoneMarker isHovered={isHovered} />
        </group>
      )}

      {/* Chaining Mode: Stacked Linked Crystal Pods along +Z */}
      {strategy === 'chaining' &&
        chainEntries.map((entry, cIdx) => {
          const zOffset = cIdx * chainStepZ;
          return (
            <group key={`${bucket.index}-${entry.key}-${cIdx}`}>
              {/* Pod anchor pad for extended chain pods */}
              {cIdx > 0 && (
                <mesh position={[0, 0.06, zOffset]} receiveShadow>
                  <boxGeometry args={[0.98, 0.1, 0.98]} />
                  <meshStandardMaterial color="#131E34" roughness={0.44} metalness={0.68} />
                </mesh>
              )}

              {/* Short Arched Energy Link from Previous Pod */}
              {cIdx > 0 && (
                <EnergyArc
                  from={[0, 0.62, (cIdx - 1) * chainStepZ + 0.42]}
                  to={[0, 0.62, zOffset - 0.42]}
                  arcHeight={0.32}
                  color="#FB923C"
                  radius={0.032}
                  speed={0.9}
                />
              )}

              <group
                onPointerOver={handleOver}
                onPointerOut={handleOut}
                onClick={handleClick}
              >
                <CrystalDataBlock
                  entry={entry}
                  bucket={bucket}
                  isFound={isFoundBucket || entry.state === 'found'}
                  isHovered={isHovered}
                  position={[0, 0, zOffset]}
                  compact
                />
              </group>
            </group>
          );
        })}
    </group>
  );
}

interface TwoSumBannerProps {
  twoSumArray: number[];
  twoSumTarget: number;
  foundPair?: [number, number] | null;
}

function TwoSumBanner({ twoSumArray, twoSumTarget, foundPair }: TwoSumBannerProps) {
  const count = twoSumArray.length;
  const spacing = 1.22;
  const startX = -((count - 1) * spacing) / 2;
  const hasPair = Boolean(foundPair);

  return (
    <group position={[0, 0, 2.75]}>
      {/* Target Badge */}
      <CanvasLabel
        text={
          foundPair
            ? `TWO-SUM TARGET: ${twoSumTarget}  ✓ [${foundPair[0]}, ${foundPair[1]}]`
            : `TWO-SUM TARGET: ${twoSumTarget}`
        }
        position={[0, 1.25, 0]}
        scale={0.44}
        fontSize={36}
        color={hasPair ? '#34D399' : '#FED7AA'}
        background="rgba(11, 16, 28, 0.92)"
        borderColor={hasPair ? '#34D399' : '#FB923C'}
      />

      {/* Compact Input Strip Rail */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[Math.max(3.6, count * spacing + 0.7), 0.08, 1.15]} />
        <meshStandardMaterial color="#131E34" roughness={0.42} metalness={0.7} />
      </mesh>

      {twoSumArray.map((val, idx) => {
        const isPairMember =
          foundPair !== undefined &&
          foundPair !== null &&
          (foundPair[0] === idx || foundPair[1] === idx);
        const x = startX + idx * spacing;
        const accent = isPairMember ? '#34D399' : '#FB923C';

        return (
          <group key={`twosum-${idx}`} position={[x, 0.14, 0]}>
            <mesh position={[0, 0.22, 0]} castShadow>
              <boxGeometry args={[0.88, 0.42, 0.82]} />
              <meshStandardMaterial
                color={isPairMember ? '#0E2B22' : '#162238'}
                emissive={accent}
                emissiveIntensity={isPairMember ? 0.58 : 0.2}
                roughness={0.32}
                metalness={0.62}
              />
            </mesh>
            <CanvasLabel
              text={String(val)}
              position={[0, 0.72, 0]}
              scale={0.36}
              fontSize={36}
              color={isPairMember ? '#34D399' : '#F1F5F9'}
              background="rgba(11, 16, 28, 0.9)"
              borderColor={accent}
            />
          </group>
        );
      })}
    </group>
  );
}

export function HashTableScene3D({
  state,
  interactive,
  onDirectAction,
}: HashTableScene3DProps) {
  const [hoveredBucket, setHoveredBucket] = useState<number | null>(null);

  const capacity = Math.max(1, state.capacity);
  const bucketSpacing = capacity <= 8 ? 1.72 : capacity <= 11 ? 1.46 : 1.26;
  const baySize = Math.min(1.36, bucketSpacing - 0.22);
  const startOffset = ((capacity - 1) * bucketSpacing) / 2;
  const railWidth = Math.max(4.5, capacity * bucketSpacing + 1.1);

  const getBucketX = useMemo(
    () => (idx: number) => idx * bucketSpacing - startOffset,
    [bucketSpacing, startOffset],
  );

  const loadFactor = useMemo(() => {
    let occupied = 0;
    for (const b of state.buckets) {
      if (state.strategy === 'chaining') {
        occupied += b.chain.length > 0 ? b.chain.length : b.entry ? 1 : 0;
      } else if (b.entry) {
        occupied += 1;
      }
    }
    return occupied / capacity;
  }, [state.buckets, state.strategy, capacity]);

  const handleBucketClick = (bucketIndex: number) => {
    if (!interactive) return;

    if (state.pendingKeys.length > 0) {
      soundEngine.playSelect();
      onDirectAction?.({
        world: 'hash-table',
        type: 'INSERT_AT_BUCKET',
        payload: { bucketIndex },
      });
      return;
    }

    if (state.searchTarget !== undefined) {
      soundEngine.playStep(0.65);
      onDirectAction?.({
        world: 'hash-table',
        type: 'LOOKUP',
        payload: { bucketIndex, key: state.searchTarget },
      });
      return;
    }

    soundEngine.playSelect();
    onDirectAction?.({
      world: 'hash-table',
      type: 'LOOKUP',
      payload: { bucketIndex },
    });
  };

  return (
    <group>
      {/* Floating Hash Prism (h(k) = k % M) */}
      <HashPrism
        capacity={capacity}
        pendingKeys={state.pendingKeys}
        searchTarget={state.searchTarget}
        foundBucket={state.foundBucket}
        loadFactor={loadFactor}
        loadFactorThreshold={state.loadFactorThreshold}
        collisions={state.collisions}
      />

      {/* Laser Hash Beam + Collision Probe-Hop Arcs */}
      {state.lastHashBeam && (
        <HashBeamVisual
          beam={state.lastHashBeam}
          getBucketX={getBucketX}
          capacity={capacity}
        />
      )}

      {/* Vault Bucket Rail Chassis Baseplate */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[railWidth, 0.09, 2.18]} />
        <meshStandardMaterial color="#131E34" roughness={0.42} metalness={0.7} />
      </mesh>

      {/* Warm Coral-Orange Luminous Rail Trim Bars */}
      <mesh position={[0, 0.075, 1.05]}>
        <boxGeometry args={[railWidth, 0.045, 0.055]} />
        <meshStandardMaterial
          color="#FB923C"
          emissive="#FB923C"
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.075, -1.05]}>
        <boxGeometry args={[railWidth, 0.045, 0.055]} />
        <meshStandardMaterial
          color="#FB923C"
          emissive="#FB923C"
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>

      {/* Indexed Vault Bucket Bays */}
      {state.buckets.map((bucket) => (
        <BucketBay
          key={bucket.index}
          bucket={bucket}
          xPos={getBucketX(bucket.index)}
          baySize={baySize}
          strategy={state.strategy}
          isFoundBucket={state.foundBucket === bucket.index}
          isHovered={hoveredBucket === bucket.index}
          interactive={interactive}
          onHover={setHoveredBucket}
          onClick={handleBucketClick}
        />
      ))}

      {/* Two-Sum Mode Target Banner & Highlighted Input Strip */}
      {state.mode === 'two-sum' &&
        state.twoSumArray &&
        state.twoSumTarget !== undefined && (
          <TwoSumBanner
            twoSumArray={state.twoSumArray}
            twoSumTarget={state.twoSumTarget}
            foundPair={state.foundPair}
          />
        )}
    </group>
  );
}
