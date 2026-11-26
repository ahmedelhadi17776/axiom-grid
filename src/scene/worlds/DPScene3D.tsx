import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { DPCell, DPWorldState } from '../../engine/types';
import type { DirectAction } from '../IsometricCanvas';
import { CanvasLabel } from '../CanvasLabel';
import { soundEngine } from '../../audio/soundEngine';

export interface DPScene3DProps {
  state: DPWorldState;
  interactive: boolean;
  onDirectAction?: (action: DirectAction) => void;
}

const CELL_SPACING = 1.42;
const CELL_FOOTPRINT = 1.12;

function computeCellTargetHeight(cell: DPCell, maxVal: number): number {
  if (cell.state === 'blocked') return 0.82;
  if (cell.state === 'empty') return 0.14;
  if (cell.state === 'ready') return 0.22;
  const val = cell.value;
  if (val === null || !Number.isFinite(val) || val >= 999999) return 0.45;
  const norm = maxVal > 0 ? Math.min(1, Math.max(0, Math.abs(val) / maxVal)) : 0.35;
  return 0.42 + norm * 1.42;
}

function formatCellValue(val: number | null): string {
  if (val === null) return '';
  if (!Number.isFinite(val) || val >= 999999) return '∞';
  return String(val);
}

interface DependencyArcProps {
  from: [number, number, number];
  to: [number, number, number];
  color: string;
}

function DependencyArc({ from, to, color }: DependencyArcProps) {
  const orbRef = useRef<THREE.Mesh | null>(null);
  const orbPos = useMemo(() => new THREE.Vector3(), []);

  const { curve, coreGeometry, sheathGeometry } = useMemo(() => {
    const start = new THREE.Vector3(from[0], from[1], from[2]);
    const end = new THREE.Vector3(to[0], to[1], to[2]);
    const mid = start.clone().lerp(end, 0.5);
    const dist = start.distanceTo(end);
    mid.y = Math.max(start.y, end.y) + Math.min(1.35, 0.55 + dist * 0.16);

    const c = new THREE.CatmullRomCurve3([start, mid, end]);
    const coreTube = new THREE.TubeGeometry(c, 26, 0.036, 8, false);
    const sheathTube = new THREE.TubeGeometry(c, 26, 0.072, 8, false);
    return { curve: c, coreGeometry: coreTube, sheathGeometry: sheathTube };
  }, [from, to]);

  useEffect(() => {
    return () => {
      coreGeometry.dispose();
      sheathGeometry.dispose();
    };
  }, [coreGeometry, sheathGeometry]);

  useFrame((clockState) => {
    if (!orbRef.current) return;
    const t = (clockState.clock.elapsedTime * 0.95) % 1;
    curve.getPointAt(t, orbPos);
    orbRef.current.position.copy(orbPos);
  });

  return (
    <group>
      <mesh geometry={coreGeometry}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.4}
          toneMapped={false}
          roughness={0.22}
        />
      </mesh>
      <mesh geometry={sheathGeometry}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.48}
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={orbRef}>
        <sphereGeometry args={[0.1, 10, 10]} />
        <meshStandardMaterial
          color="#F8FAFC"
          emissive={color}
          emissiveIntensity={1.52}
          toneMapped={false}
          roughness={0.15}
        />
      </mesh>
    </group>
  );
}

interface DPCellPedestalProps {
  cell: DPCell;
  xPos: number;
  zPos: number;
  targetHeight: number;
  isActive: boolean;
  isDependency: boolean;
  isHovered: boolean;
  interactive: boolean;
  onHover: (key: string | null) => void;
  onClick: (row: number, col: number) => void;
}

function DPCellPedestal({
  cell,
  xPos,
  zPos,
  targetHeight,
  isActive,
  isDependency,
  isHovered,
  interactive,
  onHover,
  onClick,
}: DPCellPedestalProps) {
  const heightRef = useRef(targetHeight);
  const columnRef = useRef<THREE.Mesh | null>(null);
  const capGroupRef = useRef<THREE.Group | null>(null);
  const readyRingMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

  const cellKey = `${cell.row},${cell.col}`;
  const isBlocked = cell.state === 'blocked';
  const isReady = cell.state === 'ready';
  const isEmpty = cell.state === 'empty';
  const isPath = cell.state === 'path';

  const visuals = useMemo(() => {
    if (isBlocked) {
      return {
        bodyColor: '#151D30',
        emissive: '#334155',
        bodyIntensity: 0.16,
        capColor: '#475569',
        capIntensity: 0.35,
        toneMapped: true,
      };
    }
    if (isPath) {
      return {
        bodyColor: '#0E2A22',
        emissive: '#34D399',
        bodyIntensity: 0.48,
        capColor: '#34D399',
        capIntensity: 1.45,
        toneMapped: false,
      };
    }
    if (isActive || cell.state === 'active') {
      return {
        bodyColor: '#102840',
        emissive: '#38BDF8',
        bodyIntensity: 0.55,
        capColor: '#38BDF8',
        capIntensity: 1.48,
        toneMapped: false,
      };
    }
    if (isDependency) {
      return {
        bodyColor: '#292010',
        emissive: '#FBBF24',
        bodyIntensity: 0.46,
        capColor: '#FBBF24',
        capIntensity: 1.38,
        toneMapped: false,
      };
    }
    if (cell.state === 'computed') {
      return {
        bodyColor: '#182140',
        emissive: '#818CF8',
        bodyIntensity: isHovered ? 0.52 : 0.38,
        capColor: isHovered ? '#A5B4FC' : '#818CF8',
        capIntensity: isHovered ? 1.42 : 1.22,
        toneMapped: false,
      };
    }
    if (isReady) {
      return {
        bodyColor: isHovered ? '#1C2648' : '#131E34',
        emissive: '#818CF8',
        bodyIntensity: isHovered ? 0.5 : 0.28,
        capColor: isHovered ? '#A5B4FC' : '#818CF8',
        capIntensity: isHovered ? 1.45 : 1.15,
        toneMapped: false,
      };
    }
    return {
      bodyColor: isHovered ? '#17223B' : '#0E1628',
      emissive: isHovered ? '#818CF8' : '#1E293B',
      bodyIntensity: isHovered ? 0.28 : 0.1,
      capColor: isHovered ? '#6366F1' : '#334155',
      capIntensity: isHovered ? 0.9 : 0.22,
      toneMapped: !isHovered,
    };
  }, [isBlocked, isPath, isActive, isDependency, cell.state, isReady, isHovered]);

  useFrame((clockState, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clockState.clock.elapsedTime;
    const alpha = 1 - Math.exp(-dt * 10);
    const hoverBoost = isHovered && !isBlocked ? 0.08 : 0;
    const nextH = THREE.MathUtils.lerp(heightRef.current, targetHeight + hoverBoost, alpha);
    heightRef.current = nextH;

    if (columnRef.current) {
      columnRef.current.scale.y = Math.max(0.08, nextH);
      columnRef.current.position.y = 0.08 + nextH / 2;
    }
    if (capGroupRef.current) {
      capGroupRef.current.position.y = 0.08 + nextH;
    }
    if (readyRingMatRef.current && isReady) {
      readyRingMatRef.current.emissiveIntensity = isHovered
        ? 1.48
        : 1.05 + Math.sin(t * 3.8 + cell.row + cell.col) * 0.32;
    }
  });

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive || isBlocked) return;
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
    onHover(cellKey);
    soundEngine.playHover();
  };

  const handleOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'auto';
    onHover(null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive || isBlocked) return;
    e.stopPropagation();
    onClick(cell.row, cell.col);
  };

  const showValue = !isBlocked && !isEmpty && !isReady && cell.value !== null;

  return (
    <group position={[xPos, 0, zPos]}>
      {/* Recessed metallic socket bed */}
      <mesh position={[0, 0.04, 0]} receiveShadow>
        <boxGeometry args={[CELL_FOOTPRINT + 0.12, 0.08, CELL_FOOTPRINT + 0.12]} />
        <meshStandardMaterial color="#121B2E" roughness={0.48} metalness={0.68} />
      </mesh>

      {/* Smoothly rising crystal pedestal column */}
      <mesh
        ref={columnRef}
        position={[0, 0.08 + targetHeight / 2, 0]}
        scale={[1, Math.max(0.08, targetHeight), 1]}
        castShadow={!isEmpty}
        receiveShadow
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        <boxGeometry args={[CELL_FOOTPRINT * 0.9, 1, CELL_FOOTPRINT * 0.9]} />
        <meshStandardMaterial
          color={visuals.bodyColor}
          emissive={visuals.emissive}
          emissiveIntensity={visuals.bodyIntensity}
          roughness={isBlocked ? 0.5 : 0.32}
          metalness={isBlocked ? 0.68 : 0.62}
        />
      </mesh>

      {/* Cap bezel, luminous inlay, and floating label riding top of pedestal */}
      <group ref={capGroupRef} position={[0, 0.08 + targetHeight, 0]}>
        {/* Metallic bevel collar */}
        <mesh position={[0, 0.02, 0]}>
          <boxGeometry args={[CELL_FOOTPRINT * 0.96, 0.04, CELL_FOOTPRINT * 0.96]} />
          <meshStandardMaterial color="#192742" roughness={0.32} metalness={0.7} />
        </mesh>

        {/* Luminous top cap inlay */}
        {!isEmpty && (
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[CELL_FOOTPRINT * 0.84, 0.03, CELL_FOOTPRINT * 0.84]} />
            <meshStandardMaterial
              color={visuals.capColor}
              emissive={visuals.capColor}
              emissiveIntensity={Math.min(1.55, visuals.capIntensity)}
              toneMapped={visuals.toneMapped}
              roughness={0.22}
            />
          </mesh>
        )}

        {/* Pulsing indigo beckoning outline for ready-to-compute cells */}
        {isReady && (
          <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, 0.075, 0]}>
            <ringGeometry args={[0.56, 0.66, 4]} />
            <meshStandardMaterial
              ref={readyRingMatRef}
              color="#818CF8"
              emissive="#818CF8"
              emissiveIntensity={1.25}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* Active / Dependency halo */}
        {(isActive || isDependency) && (
          <mesh rotation={[-Math.PI / 2, 0, Math.PI / 4]} position={[0, 0.08, 0]}>
            <ringGeometry args={[0.58, 0.68, 4]} />
            <meshStandardMaterial
              color={isActive ? '#38BDF8' : '#FBBF24'}
              emissive={isActive ? '#38BDF8' : '#FBBF24'}
              emissiveIntensity={1.45}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* Cell value or clickable ready indicator */}
        {showValue && (
          <CanvasLabel
            text={formatCellValue(cell.value)}
            position={[0, 0.44, 0]}
            scale={0.42}
            fontSize={42}
            color="#F8FAFC"
            background="rgba(11, 16, 28, 0.9)"
            borderColor={visuals.capColor}
          />
        )}

        {isReady && (
          <CanvasLabel
            text={isHovered ? 'COMPUTE' : cell.label || '+'}
            position={[0, 0.36, 0]}
            scale={isHovered ? 0.3 : 0.34}
            fontSize={34}
            color={isHovered ? '#F8FAFC' : '#A5B4FC'}
            background="rgba(14, 20, 40, 0.86)"
            borderColor="#818CF8"
          />
        )}
      </group>
    </group>
  );
}

function HeaderBeacon({
  text,
  position,
  color,
  showGem = true,
}: {
  text: string;
  position: [number, number, number];
  color: string;
  showGem?: boolean;
}) {
  const gemRef = useRef<THREE.Mesh | null>(null);

  useFrame((clockState) => {
    if (!gemRef.current) return;
    const t = clockState.clock.elapsedTime;
    gemRef.current.rotation.y = t * 1.3;
    gemRef.current.position.y = -0.34 + Math.sin(t * 2.5) * 0.06;
  });

  return (
    <group position={position}>
      {showGem && (
        <mesh ref={gemRef} position={[0, -0.34, 0]}>
          <octahedronGeometry args={[0.2, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={color}
            emissiveIntensity={1.45}
            toneMapped={false}
            roughness={0.2}
          />
        </mesh>
      )}
      <CanvasLabel
        text={text}
        position={[0, 0.12, 0]}
        scale={0.4}
        fontSize={34}
        color="#F8FAFC"
        background="rgba(11, 18, 32, 0.92)"
        borderColor={color}
      />
    </group>
  );
}

export function DPScene3D({ state, interactive, onDirectAction }: DPScene3DProps) {
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);

  const offsetX = ((state.cols - 1) * CELL_SPACING) / 2;
  const offsetZ = ((state.rows - 1) * CELL_SPACING) / 2;
  const plateW = state.cols * CELL_SPACING + 0.9;
  const plateD = state.rows * CELL_SPACING + 0.9;

  const maxVal = useMemo(() => {
    let max = 1;
    for (const c of state.cells) {
      if (c.value !== null && Number.isFinite(c.value) && c.value < 999999) {
        const abs = Math.abs(c.value);
        if (abs > max) max = abs;
      }
    }
    return max;
  }, [state.cells]);

  const cellMap = useMemo(() => {
    const map = new Map<string, DPCell>();
    for (const c of state.cells) {
      map.set(`${c.row},${c.col}`, c);
    }
    return map;
  }, [state.cells]);

  const activeKey = state.activeCell ? `${state.activeCell[0]},${state.activeCell[1]}` : null;
  const depKeys = useMemo(() => {
    const s = new Set<string>();
    for (const [r, c] of state.activeDeps) {
      s.add(`${r},${c}`);
    }
    return s;
  }, [state.activeDeps]);

  const handleCellClick = (row: number, col: number) => {
    if (!interactive) return;
    soundEngine.playStep(0.65);
    onDirectAction?.({
      world: 'dp',
      type: 'COMPUTE_CELL',
      payload: { row, col },
    });
  };

  // Compute dependency arcs from activeDeps -> activeCell
  const dependencyArcs = useMemo(() => {
    if (!state.activeCell || state.activeDeps.length === 0) return [];
    const [ar, ac] = state.activeCell;
    const toCell = cellMap.get(`${ar},${ac}`);
    const toH = toCell ? computeCellTargetHeight(toCell, maxVal) : 0.45;
    const toPos: [number, number, number] = [
      ac * CELL_SPACING - offsetX,
      0.16 + toH,
      ar * CELL_SPACING - offsetZ,
    ];

    return state.activeDeps.map(([dr, dc], idx) => {
      const fromCell = cellMap.get(`${dr},${dc}`);
      const fromH = fromCell ? computeCellTargetHeight(fromCell, maxVal) : 0.35;
      const fromPos: [number, number, number] = [
        dc * CELL_SPACING - offsetX,
        0.16 + fromH,
        dr * CELL_SPACING - offsetZ,
      ];
      return {
        key: `${dr},${dc}->${ar},${ac}`,
        from: fromPos,
        to: toPos,
        color: idx % 2 === 0 ? '#FBBF24' : '#38BDF8',
      };
    });
  }, [state.activeCell, state.activeDeps, cellMap, maxVal, offsetX, offsetZ]);

  return (
    <group>
      {/* Architectural dark slate baseplate + metallic rim */}
      <mesh position={[0, -0.04, 0]} receiveShadow>
        <boxGeometry args={[plateW + 0.24, 0.08, plateD + 0.24]} />
        <meshStandardMaterial color="#192742" roughness={0.38} metalness={0.72} />
      </mesh>
      <mesh position={[0, 0.005, 0]} receiveShadow>
        <boxGeometry args={[plateW, 0.05, plateD]} />
        <meshStandardMaterial color="#0C1322" roughness={0.52} metalness={0.58} />
      </mesh>

      {/* Subtle indigo front/back trim bars */}
      <mesh position={[0, 0.04, plateD / 2 + 0.04]}>
        <boxGeometry args={[plateW, 0.035, 0.045]} />
        <meshStandardMaterial
          color="#818CF8"
          emissive="#818CF8"
          emissiveIntensity={1.15}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.04, -(plateD / 2 + 0.04)]}>
        <boxGeometry args={[plateW, 0.035, 0.045]} />
        <meshStandardMaterial
          color="#818CF8"
          emissive="#818CF8"
          emissiveIntensity={1.15}
          toneMapped={false}
        />
      </mesh>

      {/* Floating Target & Naive O(2^n) Comparison Beacons */}
      <HeaderBeacon
        text={`TARGET: ${state.targetAnswer}`}
        position={[
          state.naiveRecursionOps !== undefined ? -2.2 : 0,
          2.65,
          -offsetZ - 1.85,
        ]}
        color={state.tracebackShown ? '#34D399' : '#818CF8'}
      />
      {state.naiveRecursionOps !== undefined && (
        <HeaderBeacon
          text={`NAIVE O(2^n): ${state.naiveRecursionOps.toLocaleString()} ops`}
          position={[2.4, 2.65, -offsetZ - 1.85]}
          color="#FBBF24"
          showGem={false}
        />
      )}

      {/* Column axis headers */}
      {state.colLabels.map((label, c) =>
        label ? (
          <CanvasLabel
            key={`col-${c}`}
            text={label}
            position={[c * CELL_SPACING - offsetX, 0.24, -offsetZ - CELL_SPACING * 0.88]}
            scale={0.32}
            fontSize={32}
            color="#CBD5E1"
            background="rgba(11, 16, 28, 0.85)"
            borderColor="rgba(129, 140, 248, 0.45)"
          />
        ) : null
      )}

      {/* Row axis headers */}
      {state.rowLabels.map((label, r) =>
        label ? (
          <CanvasLabel
            key={`row-${r}`}
            text={label}
            position={[-offsetX - CELL_SPACING * 0.96, 0.24, r * CELL_SPACING - offsetZ]}
            scale={0.32}
            fontSize={32}
            color="#CBD5E1"
            background="rgba(11, 16, 28, 0.85)"
            borderColor="rgba(129, 140, 248, 0.45)"
          />
        ) : null
      )}

      {/* DP Memo Matrix Cells */}
      {state.cells.map((cell) => {
        const key = `${cell.row},${cell.col}`;
        return (
          <DPCellPedestal
            key={key}
            cell={cell}
            xPos={cell.col * CELL_SPACING - offsetX}
            zPos={cell.row * CELL_SPACING - offsetZ}
            targetHeight={computeCellTargetHeight(cell, maxVal)}
            isActive={activeKey === key}
            isDependency={depKeys.has(key)}
            isHovered={hoveredKey === key}
            interactive={interactive}
            onHover={setHoveredKey}
            onClick={handleCellClick}
          />
        );
      })}

      {/* Glowing Curved Dependency Arcs */}
      {dependencyArcs.map((arc) => (
        <DependencyArc
          key={arc.key}
          from={arc.from}
          to={arc.to}
          color={arc.color}
        />
      ))}
    </group>
  );
}
