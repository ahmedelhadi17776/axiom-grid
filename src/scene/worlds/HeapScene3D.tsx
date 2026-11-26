import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type {
  HeapKind,
  HeapNodeSlot,
  HeapNodeState,
  HeapWorldState,
} from '../../engine/types';
import type { DirectAction } from '../IsometricCanvas';
import { CanvasLabel } from '../CanvasLabel';
import { soundEngine } from '../../audio/soundEngine';

export interface HeapScene3DProps {
  state: HeapWorldState;
  interactive: boolean;
  onDirectAction?: (action: DirectAction) => void;
}

function getHeapNodeVisuals(
  nodeState: HeapNodeState,
  isSelected: boolean,
  isHovered: boolean,
  baseAccent: string,
): {
  chassis: string;
  cap: string;
  accent: string;
  intensity: number;
} {
  if (nodeState === 'violating') {
    return {
      chassis: '#2C1420',
      cap: '#381929',
      accent: '#FB7185',
      intensity: 1.5,
    };
  }
  if (nodeState === 'swapping' || nodeState === 'comparing') {
    return {
      chassis: '#2A210F',
      cap: '#362A13',
      accent: '#FBBF24',
      intensity: nodeState === 'swapping' ? 1.5 : 1.35,
    };
  }
  if (nodeState === 'sifted' || nodeState === 'extracted') {
    return {
      chassis: '#0E2922',
      cap: '#14362D',
      accent: '#34D399',
      intensity: 1.45,
    };
  }
  if (isSelected || nodeState === 'active') {
    return {
      chassis: '#10263D',
      cap: '#163250',
      accent: '#38BDF8',
      intensity: 1.5,
    };
  }
  return {
    chassis: isHovered ? '#1B2844' : '#131E34',
    cap: isHovered ? '#223354' : '#192742',
    accent: isHovered ? '#F9A8D4' : baseAccent,
    intensity: isHovered ? 1.35 : 1.15,
  };
}

function computePyramidPositions(
  count: number,
  centerX: number,
  maxWidth: number,
): [number, number, number][] {
  if (count <= 0) return [];
  const maxLevel = Math.max(0, Math.floor(Math.log2(count)));
  const zStep = maxLevel >= 3 ? 1.08 : 1.25;
  const yStep = maxLevel >= 3 ? 0.68 : 0.78;
  const topY = 3.25;
  const topZ = -3.0;

  const positions: [number, number, number][] = [];
  for (let i = 0; i < count; i++) {
    const level = Math.floor(Math.log2(i + 1));
    const levelStart = (1 << level) - 1;
    const posInLevel = i - levelStart;
    const nodesInLevel = 1 << level;
    const levelSpan =
      level === 0 ? 0 : maxWidth * (0.48 + 0.52 * (level / Math.max(1, maxLevel)));
    const x =
      level === 0
        ? centerX
        : centerX + ((posInLevel + 0.5) / nodesInLevel - 0.5) * levelSpan;
    const y = topY - level * yStep;
    const z = topZ + level * zStep;
    positions.push([x, y, z]);
  }
  return positions;
}

interface HeapBranchProps {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
  highlighted: boolean;
}

function HeapBranch({ from, to, color, highlighted }: HeapBranchProps) {
  const pulseRef = useRef<THREE.Mesh | null>(null);
  const pulsePos = useMemo(() => new THREE.Vector3(), []);

  const { curve, coreGeo, sheathGeo } = useMemo(() => {
    const start = new THREE.Vector3(from[0], from[1], from[2]);
    const end = new THREE.Vector3(to[0], to[1], to[2]);
    const mid = start.clone().lerp(end, 0.5);
    mid.y += 0.32;

    const c = new THREE.CatmullRomCurve3([start, mid, end]);
    const core = new THREE.TubeGeometry(c, 22, 0.038, 8, false);
    const sheath = new THREE.TubeGeometry(c, 22, 0.076, 8, false);
    return { curve: c, coreGeo: core, sheathGeo: sheath };
  }, [from, to]);

  useEffect(() => {
    return () => {
      coreGeo.dispose();
      sheathGeo.dispose();
    };
  }, [coreGeo, sheathGeo]);

  useFrame((clockState) => {
    if (!pulseRef.current) return;
    const speed = highlighted ? 0.9 : 0.45;
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
          emissiveIntensity={highlighted ? 1.45 : 1.15}
          toneMapped={false}
          roughness={0.22}
        />
      </mesh>
      <mesh geometry={sheathGeo}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.45}
          transparent
          opacity={0.16}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={pulseRef}>
        <sphereGeometry args={[highlighted ? 0.1 : 0.08, 10, 10]} />
        <meshStandardMaterial
          color="#F8FAFC"
          emissive={color}
          emissiveIntensity={1.45}
          toneMapped={false}
          roughness={0.18}
        />
      </mesh>
    </group>
  );
}

interface GuideBeamProps {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
}

function GuideBeam({ from, to, color }: GuideBeamProps) {
  const { geo } = useMemo(() => {
    const start = new THREE.Vector3(from[0], from[1] - 0.32, from[2]);
    const end = new THREE.Vector3(to[0], to[1] + 0.55, to[2]);
    const mid = start.clone().lerp(end, 0.5);
    mid.y += 0.25;
    const curve = new THREE.CatmullRomCurve3([start, mid, end]);
    return { geo: new THREE.TubeGeometry(curve, 24, 0.032, 8, false) };
  }, [from, to]);

  useEffect(() => {
    return () => {
      geo.dispose();
    };
  }, [geo]);

  return (
    <mesh geometry={geo}>
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.35}
        toneMapped={false}
        transparent
        opacity={0.72}
        depthWrite={false}
      />
    </mesh>
  );
}

interface SpireNodeProps {
  slot: HeapNodeSlot;
  index: number;
  targetPos: [number, number, number];
  isRoot: boolean;
  rootLabel: string;
  isSelected: boolean;
  isHovered: boolean;
  baseAccent: string;
  interactive: boolean;
  compact?: boolean;
  onHover: (idx: number | null) => void;
  onClick: (idx: number) => void;
}

function SpireNode({
  slot,
  index,
  targetPos,
  isRoot,
  rootLabel,
  isSelected,
  isHovered,
  baseAccent,
  interactive,
  compact = false,
  onHover,
  onClick,
}: SpireNodeProps) {
  const outerRef = useRef<THREE.Group | null>(null);
  const floatRef = useRef<THREE.Group | null>(null);
  const crownRef = useRef<THREE.Mesh | null>(null);
  const warnRingRef = useRef<THREE.Mesh | null>(null);
  const warnMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const initializedRef = useRef(false);

  const visuals = getHeapNodeVisuals(slot.state, isSelected, isHovered, baseAccent);
  const scaleFactor = compact ? 0.84 : 1;

  useFrame((clockState, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clockState.clock.elapsedTime;

    if (outerRef.current) {
      if (!initializedRef.current) {
        outerRef.current.position.set(targetPos[0], targetPos[1], targetPos[2]);
        initializedRef.current = true;
      } else {
        const alpha = 1 - Math.exp(-dt * 10);
        outerRef.current.position.x = THREE.MathUtils.lerp(
          outerRef.current.position.x,
          targetPos[0],
          alpha,
        );
        outerRef.current.position.y = THREE.MathUtils.lerp(
          outerRef.current.position.y,
          targetPos[1],
          alpha,
        );
        outerRef.current.position.z = THREE.MathUtils.lerp(
          outerRef.current.position.z,
          targetPos[2],
          alpha,
        );
      }
    }

    if (floatRef.current) {
      const bob = Math.sin(t * 2.2 + index * 0.9) * 0.06;
      const lift =
        slot.state === 'swapping'
          ? 0.24 + Math.sin(t * 8.5) * 0.05
          : isSelected
            ? 0.16
            : isHovered
              ? 0.09
              : 0;
      floatRef.current.position.y = bob + lift;
    }

    if (crownRef.current) {
      crownRef.current.rotation.y = t * 1.25;
    }

    if (warnRingRef.current) {
      warnRingRef.current.rotation.z = t * 2.0;
    }
    if (warnMatRef.current && slot.state === 'violating') {
      warnMatRef.current.emissiveIntensity = 1.15 + Math.sin(t * 6.0) * 0.35;
    }
  });

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
    onHover(index);
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
    onClick(index);
  };

  return (
    <group ref={outerRef}>
      <group
        ref={floatRef}
        scale={[scaleFactor, scaleFactor, scaleFactor]}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        {/* Lower chamfered metallic slate chassis */}
        <mesh position={[0, -0.2, 0]} castShadow>
          <cylinderGeometry args={[0.56, 0.42, 0.18, 6]} />
          <meshStandardMaterial color={visuals.chassis} roughness={0.34} metalness={0.68} />
        </mesh>

        {/* Middle frosted crystalline hex core */}
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.48, 0.48, 0.24, 6]} />
          <meshStandardMaterial
            color={visuals.chassis}
            emissive={visuals.accent}
            emissiveIntensity={isSelected ? 0.65 : isHovered ? 0.52 : 0.38}
            roughness={0.22}
            metalness={0.3}
            transparent
            opacity={0.93}
          />
        </mesh>

        {/* Luminous waist collar */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.58, 0.58, 0.055, 6]} />
          <meshStandardMaterial
            color={visuals.accent}
            emissive={visuals.accent}
            emissiveIntensity={Math.min(1.55, visuals.intensity)}
            toneMapped={false}
            roughness={0.22}
          />
        </mesh>

        {/* Upper beveled metallic cap */}
        <mesh position={[0, 0.2, 0]} castShadow>
          <cylinderGeometry args={[0.48, 0.57, 0.16, 6]} />
          <meshStandardMaterial color={visuals.cap} roughness={0.3} metalness={0.68} />
        </mesh>

        {/* Top luminous hex inlay */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.285, 0]}>
          <ringGeometry args={[0.34, 0.44, 6]} />
          <meshStandardMaterial
            color={visuals.accent}
            emissive={visuals.accent}
            emissiveIntensity={Math.min(1.5, visuals.intensity)}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Root Octahedral Crown */}
        {isRoot && (
          <mesh ref={crownRef} position={[0, 0.46, 0]}>
            <octahedronGeometry args={[0.17, 0]} />
            <meshStandardMaterial
              color={visuals.accent}
              emissive={visuals.accent}
              emissiveIntensity={1.45}
              toneMapped={false}
              roughness={0.18}
            />
          </mesh>
        )}

        {/* Selection Halo Ring */}
        {isSelected && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <ringGeometry args={[0.72, 0.84, 6]} />
            <meshStandardMaterial
              color="#38BDF8"
              emissive="#38BDF8"
              emissiveIntensity={1.45}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* Violating Node Pulsing Coral Warning Ring */}
        {slot.state === 'violating' && (
          <mesh ref={warnRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.06, 0]}>
            <ringGeometry args={[0.74, 0.88, 6]} />
            <meshStandardMaterial
              ref={warnMatRef}
              color="#FB7185"
              emissive="#FB7185"
              emissiveIntensity={1.45}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* Primary Value Label */}
        <CanvasLabel
          text={String(slot.value)}
          position={[0, 0.72, 0]}
          scale={0.44}
          fontSize={44}
          color="#F8FAFC"
          background="rgba(11, 16, 28, 0.9)"
          borderColor={visuals.accent}
        />

        {/* Index Sub-Badge */}
        <CanvasLabel
          text={`[${index}]`}
          position={[0.64, -0.06, 0.35]}
          scale={0.26}
          fontSize={30}
          color="#CBD5E1"
          background="rgba(11, 16, 28, 0.86)"
          borderColor={isSelected ? '#38BDF8' : 'rgba(71, 85, 105, 0.75)'}
        />

        {/* ROOT (MIN / MAX) Floating Crown Label */}
        {isRoot && (
          <CanvasLabel
            text={rootLabel}
            position={[0, 1.32, 0]}
            scale={0.35}
            fontSize={32}
            color={visuals.accent}
            background="rgba(11, 16, 28, 0.92)"
            borderColor={visuals.accent}
          />
        )}
      </group>
    </group>
  );
}

interface BackingArrayRailProps {
  items: HeapNodeSlot[];
  centerX: number;
  zPos: number;
  baseAccent: string;
  selectedIndex: number | null;
  hoveredIndex: number | null;
  interactive: boolean;
  compact?: boolean;
  label?: string;
  onHover: (idx: number | null) => void;
  onClick: (idx: number) => void;
}

function BackingArrayRail({
  items,
  centerX,
  zPos,
  baseAccent,
  selectedIndex,
  hoveredIndex,
  interactive,
  compact = false,
  label,
  onHover,
  onClick,
}: BackingArrayRailProps) {
  const count = items.length;
  const spacing = compact ? 1.04 : count <= 9 ? 1.34 : 1.14;
  const slotSize = Math.min(0.96, spacing - 0.22);
  const startX = centerX - ((Math.max(1, count) - 1) * spacing) / 2;
  const railWidth = Math.max(2.6, Math.max(1, count) * spacing + 0.75);

  return (
    <group position={[0, 0, zPos]}>
      {/* Metallic Backing Array Rail Chassis */}
      <mesh position={[centerX, 0.03, 0]} receiveShadow>
        <boxGeometry args={[railWidth, 0.09, 1.56]} />
        <meshStandardMaterial color="#131E34" roughness={0.42} metalness={0.7} />
      </mesh>

      {/* Luminous Front & Back Trim Bars */}
      <mesh position={[centerX, 0.08, 0.75]}>
        <boxGeometry args={[railWidth, 0.04, 0.05]} />
        <meshStandardMaterial
          color={baseAccent}
          emissive={baseAccent}
          emissiveIntensity={1.15}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[centerX, 0.08, -0.75]}>
        <boxGeometry args={[railWidth, 0.04, 0.05]} />
        <meshStandardMaterial
          color={baseAccent}
          emissive={baseAccent}
          emissiveIntensity={1.15}
          toneMapped={false}
        />
      </mesh>

      {label && (
        <CanvasLabel
          text={label}
          position={[centerX - railWidth / 2 - 0.95, 0.34, 0]}
          scale={0.3}
          fontSize={30}
          color={baseAccent}
          background="rgba(11, 16, 28, 0.88)"
          borderColor={baseAccent}
        />
      )}

      {items.map((slot, idx) => {
        const x = startX + idx * spacing;
        const isSel = selectedIndex === idx;
        const isHov = hoveredIndex === idx;
        const visuals = getHeapNodeVisuals(slot.state, isSel, isHov, baseAccent);

        return (
          <group key={`rail-${slot.id}`} position={[x, 0.08, 0]}>
            {/* Recessed Socket */}
            <mesh position={[0, 0.03, 0]} receiveShadow>
              <boxGeometry args={[slotSize + 0.08, 0.06, slotSize + 0.08]} />
              <meshStandardMaterial color="#0C1322" roughness={0.55} metalness={0.5} />
            </mesh>

            {/* Contiguous Array Data Cell */}
            <mesh
              position={[0, isSel ? 0.36 : isHov ? 0.3 : 0.24, 0]}
              castShadow
              receiveShadow
              onPointerOver={(e) => {
                if (!interactive) return;
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
                onHover(idx);
                soundEngine.playHover();
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'auto';
                onHover(null);
              }}
              onClick={(e) => {
                if (!interactive) return;
                e.stopPropagation();
                onClick(idx);
              }}
            >
              <boxGeometry args={[slotSize, 0.38, slotSize]} />
              <meshStandardMaterial
                color={visuals.chassis}
                emissive={visuals.accent}
                emissiveIntensity={isSel ? 0.65 : isHov ? 0.45 : 0.28}
                roughness={0.32}
                metalness={0.65}
              />
            </mesh>

            {/* Top Glowing Cap Strip */}
            <mesh position={[0, (isSel ? 0.36 : isHov ? 0.3 : 0.24) + 0.21, 0]}>
              <boxGeometry args={[slotSize * 0.88, 0.035, slotSize * 0.88]} />
              <meshStandardMaterial
                color={visuals.accent}
                emissive={visuals.accent}
                emissiveIntensity={Math.min(1.5, visuals.intensity)}
                toneMapped={false}
                roughness={0.22}
              />
            </mesh>

            {/* Value Label */}
            <CanvasLabel
              text={String(slot.value)}
              position={[0, 0.86, 0]}
              scale={compact ? 0.32 : 0.36}
              fontSize={36}
              color="#F8FAFC"
              background="rgba(11, 16, 28, 0.9)"
              borderColor={visuals.accent}
            />

            {/* Index Label */}
            <CanvasLabel
              text={`[${idx}]`}
              position={[0, 0.14, 0.92]}
              scale={0.28}
              fontSize={32}
              color={isSel ? '#38BDF8' : '#94A3B8'}
              background="rgba(11, 16, 28, 0.85)"
              borderColor={isSel ? '#38BDF8' : 'rgba(51, 65, 85, 0.7)'}
            />
          </group>
        );
      })}
    </group>
  );
}

function FloatingBeacon({
  text,
  position,
  color,
}: {
  text: string;
  position: [number, number, number];
  color: string;
}) {
  const gemRef = useRef<THREE.Mesh | null>(null);

  useFrame((clockState) => {
    if (!gemRef.current) return;
    const t = clockState.clock.elapsedTime;
    gemRef.current.rotation.y = t * 1.4;
    gemRef.current.position.y = -0.34 + Math.sin(t * 2.5) * 0.06;
  });

  return (
    <group position={position}>
      <mesh ref={gemRef} position={[0, -0.34, 0]}>
        <octahedronGeometry args={[0.2, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.45}
          toneMapped={false}
          roughness={0.18}
        />
      </mesh>
      <CanvasLabel
        text={text}
        position={[0, 0.16, 0]}
        scale={0.42}
        fontSize={36}
        color="#F8FAFC"
        background="rgba(11, 16, 28, 0.92)"
        borderColor={color}
      />
    </group>
  );
}

interface SpireClusterProps {
  items: HeapNodeSlot[];
  kind: HeapKind;
  centerX: number;
  maxWidth: number;
  baseAccent: string;
  selectedIndex: number | null;
  hoveredIndex: number | null;
  interactive: boolean;
  compact?: boolean;
  railLabel?: string;
  onHover: (idx: number | null) => void;
  onClick: (idx: number) => void;
}

function SpireCluster({
  items,
  kind,
  centerX,
  maxWidth,
  baseAccent,
  selectedIndex,
  hoveredIndex,
  interactive,
  compact = false,
  railLabel,
  onHover,
  onClick,
}: SpireClusterProps) {
  const positions = useMemo(
    () => computePyramidPositions(items.length, centerX, maxWidth),
    [items.length, centerX, maxWidth],
  );

  const count = items.length;
  const railZ = 2.8;
  const railSpacing = compact ? 1.04 : count <= 9 ? 1.34 : 1.14;
  const railStartX = centerX - ((Math.max(1, count) - 1) * railSpacing) / 2;
  const focusIndex = selectedIndex ?? hoveredIndex;

  const rootLabel = kind === 'min' ? 'ROOT (MIN)' : 'ROOT (MAX)';

  return (
    <group>
      {/* Arched Binary Tree Branch Tubes */}
      {items.map((slot, idx) => {
        if (idx === 0) return null;
        const parentIdx = Math.floor((idx - 1) / 2);
        const parentPos = positions[parentIdx];
        const childPos = positions[idx];
        if (!parentPos || !childPos) return null;

        const parentSlot = items[parentIdx];
        const isLeft = idx === parentIdx * 2 + 1;
        const isViolating =
          slot.state === 'violating' || parentSlot.state === 'violating';
        const isActiveSwap =
          slot.state === 'swapping' ||
          slot.state === 'comparing' ||
          parentSlot.state === 'swapping' ||
          parentSlot.state === 'comparing';
        const branchColor = isViolating
          ? '#FB7185'
          : isActiveSwap
            ? '#FBBF24'
            : compact
              ? baseAccent
              : isLeft
                ? '#F472B6'
                : '#38BDF8';

        return (
          <HeapBranch
            key={`branch-${parentSlot.id}-${slot.id}`}
            from={parentPos}
            to={childPos}
            color={branchColor}
            highlighted={isViolating || isActiveSwap || selectedIndex === idx || selectedIndex === parentIdx}
          />
        );
      })}

      {/* Upper Tier — 3D Binary Heap Pyramid Nodes */}
      {items.map((slot, idx) => {
        const pos = positions[idx];
        if (!pos) return null;
        return (
          <SpireNode
            key={slot.id}
            slot={slot}
            index={idx}
            targetPos={pos}
            isRoot={idx === 0}
            rootLabel={rootLabel}
            isSelected={selectedIndex === idx}
            isHovered={hoveredIndex === idx}
            baseAccent={baseAccent}
            interactive={interactive}
            compact={compact}
            onHover={onHover}
            onClick={onClick}
          />
        );
      })}

      {/* Holographic Vertical Guide Beam connecting Selected/Hovered Pyramid Node to Backing Array [i] */}
      {focusIndex !== null && focusIndex >= 0 && focusIndex < count && positions[focusIndex] && (
        <GuideBeam
          from={positions[focusIndex]}
          to={[railStartX + focusIndex * railSpacing, 0.1, railZ]}
          color={selectedIndex === focusIndex ? '#38BDF8' : baseAccent}
        />
      )}

      {/* Lower Tier — Synchronized Backing Flat Array Rail */}
      <BackingArrayRail
        items={items}
        centerX={centerX}
        zPos={railZ}
        baseAccent={baseAccent}
        selectedIndex={selectedIndex}
        hoveredIndex={hoveredIndex}
        interactive={interactive}
        compact={compact}
        label={railLabel}
        onHover={onHover}
        onClick={onClick}
      />
    </group>
  );
}

function ExtractedTray({ extracted, xPos }: { extracted: number[]; xPos: number }) {
  const stepZ = 1.05;
  const startZ = -((extracted.length - 1) * stepZ) / 2;

  return (
    <group position={[xPos, 0, 0.3]}>
      <CanvasLabel
        text="EXTRACTED"
        position={[0, 1.38, startZ - 0.8]}
        scale={0.34}
        fontSize={32}
        color="#34D399"
        background="rgba(10, 26, 22, 0.92)"
        borderColor="#34D399"
      />

      {/* Tray Baseplate */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[1.45, 0.08, Math.max(1.8, extracted.length * stepZ + 0.7)]} />
        <meshStandardMaterial color="#131E34" roughness={0.42} metalness={0.7} />
      </mesh>

      {extracted.map((val, idx) => {
        const z = startZ + idx * stepZ;
        return (
          <group key={`ext-${idx}-${val}`} position={[0, 0.26, z]}>
            <mesh castShadow>
              <cylinderGeometry args={[0.38, 0.42, 0.34, 6]} />
              <meshStandardMaterial
                color="#0E2922"
                emissive="#34D399"
                emissiveIntensity={0.48}
                roughness={0.28}
                metalness={0.55}
              />
            </mesh>
            <CanvasLabel
              text={String(val)}
              position={[0, 0.56, 0]}
              scale={0.34}
              fontSize={34}
              color="#A7F3D0"
              background="rgba(10, 26, 22, 0.9)"
              borderColor="#34D399"
            />
          </group>
        );
      })}
    </group>
  );
}

export function HeapScene3D({ state, interactive, onDirectAction }: HeapScene3DProps) {
  const [localSelected, setLocalSelected] = useState<number | null>(state.selectedIndex);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [hoveredSecondaryIdx, setHoveredSecondaryIdx] = useState<number | null>(null);

  useEffect(() => {
    setLocalSelected(state.selectedIndex);
  }, [state.selectedIndex]);

  const activeSelected = localSelected;
  const isTwinSpires = state.mode === 'median' && Boolean(state.secondaryItems);

  const handlePrimaryNodeClick = (idx: number) => {
    if (!interactive) return;

    if (activeSelected === null) {
      setLocalSelected(idx);
      soundEngine.playSelect();
      onDirectAction?.({
        world: 'heap',
        type: 'SELECT',
        payload: { index: idx },
      });
      return;
    }

    if (activeSelected === idx) {
      setLocalSelected(null);
      soundEngine.playHover();
      onDirectAction?.({
        world: 'heap',
        type: 'SELECT',
        payload: { index: null },
      });
      return;
    }

    const first = activeSelected;
    setLocalSelected(null);
    soundEngine.playSelect();
    onDirectAction?.({
      world: 'heap',
      type: 'SWAP',
      payload: { i: first, j: idx },
    });
  };

  const liveMedian = useMemo(() => {
    if (!isTwinSpires) return null;
    const left = state.items;
    const right = state.secondaryItems ?? [];
    if (left.length === 0 && right.length === 0) return null;
    if (left.length > right.length) return left[0]?.value ?? null;
    if (right.length > left.length) return right[0]?.value ?? null;
    const lRoot = left[0]?.value;
    const rRoot = right[0]?.value;
    if (lRoot === undefined || rRoot === undefined) return null;
    return Number(((lRoot + rRoot) / 2).toFixed(1));
  }, [isTwinSpires, state.items, state.secondaryItems]);

  const primaryAccent = state.kind === 'min' && !isTwinSpires ? '#F472B6' : '#F472B6';
  const extractedX = isTwinSpires ? 7.4 : Math.max(5.8, state.items.length * 0.65 + 2.2);

  return (
    <group>
      {/* Floating NEXT Pending Queue Beacon */}
      {state.pendingQueue.length > 0 && (
        <FloatingBeacon
          text={
            state.pendingQueue.length > 1
              ? `NEXT: ${state.pendingQueue[0]} (+${state.pendingQueue.length - 1})`
              : `NEXT: ${state.pendingQueue[0]}`
          }
          position={[isTwinSpires ? 0 : -4.4, 4.45, -3.2]}
          color="#F472B6"
        />
      )}

      {/* Twin Spires Mode (Median Finder): Left MAX-HEAP + Right MIN-HEAP + Central MEDIAN Beacon */}
      {isTwinSpires ? (
        <group>
          <SpireCluster
            items={state.items}
            kind="max"
            centerX={-3.5}
            maxWidth={4.6}
            baseAccent="#F472B6"
            selectedIndex={activeSelected}
            hoveredIndex={hoveredIdx}
            interactive={interactive}
            compact
            railLabel="MAX"
            onHover={setHoveredIdx}
            onClick={handlePrimaryNodeClick}
          />

          <SpireCluster
            items={state.secondaryItems ?? []}
            kind="min"
            centerX={3.5}
            maxWidth={4.6}
            baseAccent="#38BDF8"
            selectedIndex={null}
            hoveredIndex={hoveredSecondaryIdx}
            interactive={false}
            compact
            railLabel="MIN"
            onHover={setHoveredSecondaryIdx}
            onClick={() => {}}
          />

          {/* Central Floating MEDIAN Beacon */}
          <FloatingBeacon
            text={
              liveMedian !== null
                ? `MEDIAN: ${liveMedian}`
                : state.targetMedian !== undefined
                  ? `TARGET MEDIAN: ${state.targetMedian}`
                  : 'MEDIAN'
            }
            position={[0, 3.85, -1.6]}
            color={
              state.targetMedian !== undefined && liveMedian === state.targetMedian
                ? '#34D399'
                : '#FBBF24'
            }
          />
        </group>
      ) : (
        /* Standard Single-Spire Synchronized Split-View Contraption */
        <SpireCluster
          items={state.items}
          kind={state.kind}
          centerX={0}
          maxWidth={state.items.length > 7 ? 8.8 : 6.6}
          baseAccent={primaryAccent}
          selectedIndex={activeSelected}
          hoveredIndex={hoveredIdx}
          interactive={interactive}
          railLabel="ARRAY"
          onHover={setHoveredIdx}
          onClick={handlePrimaryNodeClick}
        />
      )}

      {/* Extracted Priority Output Tray */}
      {state.extracted.length > 0 && (
        <ExtractedTray extracted={state.extracted} xPos={extractedX} />
      )}
    </group>
  );
}
