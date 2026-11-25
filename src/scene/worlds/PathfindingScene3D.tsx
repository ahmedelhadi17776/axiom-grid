import { useEffect, useMemo, useRef } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { GridCell, PathfindingWorldState } from '../../engine/types';
import type { DirectAction } from '../IsometricCanvas';
import { CanvasLabel } from '../CanvasLabel';
import { soundEngine } from '../../audio/soundEngine';

export interface PathfindingScene3DProps {
  state: PathfindingWorldState;
  interactive: boolean;
  paintTool?: 'wall' | 'weight' | 'open' | 'start' | 'goal';
  onDirectAction?: (action: DirectAction) => void;
}

const CELL_SIZE = 1.08;
const TILE_FOOTPRINT = 0.96;

function getTileHeight(cell: GridCell): number {
  switch (cell.type) {
    case 'wall':
      return 1.32;
    case 'weighted':
      return 0.2 + Math.max(1, cell.weight) * 0.22;
    case 'start':
    case 'goal':
    case 'relay':
      return 0.34;
    default:
      return 0.2;
  }
}

interface TileMeshProps {
  cell: GridCell;
  xPos: number;
  zPos: number;
  interactive: boolean;
  onPointerDownCell: (x: number, y: number) => void;
  onPointerEnterCell: (x: number, y: number) => void;
}

function TileMesh({
  cell,
  xPos,
  zPos,
  interactive,
  onPointerDownCell,
  onPointerEnterCell,
}: TileMeshProps) {
  const meshRef = useRef<THREE.Mesh | null>(null);
  const spireRef = useRef<THREE.Mesh | null>(null);
  const baseHeight = getTileHeight(cell);

  useFrame((clockState) => {
    const t = clockState.clock.elapsedTime;
    if (meshRef.current && cell.inFrontier && cell.type !== 'wall') {
      meshRef.current.position.y = baseHeight / 2 + Math.sin(t * 5.2 + cell.x + cell.y) * 0.05;
    } else if (meshRef.current) {
      meshRef.current.position.y = baseHeight / 2;
    }
    if (spireRef.current) {
      spireRef.current.rotation.y = t * 1.35;
      spireRef.current.position.y = baseHeight + 0.62 + Math.sin(t * 2.8) * 0.07;
    }
  });

  const { bodyColor, emissive, emissiveIntensity, trimColor, trimIntensity } = useMemo(() => {
    if (cell.type === 'wall') {
      return {
        bodyColor: '#172035',
        emissive: '#334155',
        emissiveIntensity: 0.25,
        trimColor: '#64748B',
        trimIntensity: 0.65,
      };
    }
    if (cell.type === 'start') {
      return {
        bodyColor: '#0E283B',
        emissive: '#38BDF8',
        emissiveIntensity: 1.35,
        trimColor: '#38BDF8',
        trimIntensity: 1.45,
      };
    }
    if (cell.type === 'goal') {
      return {
        bodyColor: '#0E2A22',
        emissive: '#34D399',
        emissiveIntensity: 1.4,
        trimColor: '#34D399',
        trimIntensity: 1.5,
      };
    }
    if (cell.inPath) {
      return {
        bodyColor: '#0E2D24',
        emissive: '#34D399',
        emissiveIntensity: 1.3,
        trimColor: '#34D399',
        trimIntensity: 1.45,
      };
    }
    if (cell.inFrontier) {
      if (cell.visitedBy === 'goal') {
        return {
          bodyColor: '#2B163D',
          emissive: '#C084FC',
          emissiveIntensity: 1.35,
          trimColor: '#C084FC',
          trimIntensity: 1.48,
        };
      }
      return {
        bodyColor: '#102940',
        emissive: '#38BDF8',
        emissiveIntensity: 1.35,
        trimColor: '#38BDF8',
        trimIntensity: 1.48,
      };
    }
    if (cell.visited) {
      if (cell.visitedBy === 'goal') {
        return {
          bodyColor: '#24173B',
          emissive: '#A78BFA',
          emissiveIntensity: 1.05,
          trimColor: '#C084FC',
          trimIntensity: 1.2,
        };
      }
      return {
        bodyColor: '#162242',
        emissive: '#6366F1',
        emissiveIntensity: 0.95,
        trimColor: '#38BDF8',
        trimIntensity: 1.1,
      };
    }
    if (cell.type === 'weighted') {
      return {
        bodyColor: '#2B2110',
        emissive: '#FBBF24',
        emissiveIntensity: 0.78,
        trimColor: '#FBBF24',
        trimIntensity: 1.18,
      };
    }
    if (cell.type === 'relay') {
      return {
        bodyColor: '#221738',
        emissive: '#A78BFA',
        emissiveIntensity: 1.15,
        trimColor: '#A78BFA',
        trimIntensity: 1.3,
      };
    }
    return {
      bodyColor: '#131E34',
      emissive: '#1E293B',
      emissiveIntensity: 0.14,
      trimColor: null,
      trimIntensity: 0,
    };
  }, [cell.type, cell.inPath, cell.inFrontier, cell.visited, cell.visitedBy]);

  const handleDown = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    onPointerDownCell(cell.x, cell.y);
  };

  const handleEnter = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
    onPointerEnterCell(cell.x, cell.y);
  };

  const handleOut = () => {
    document.body.style.cursor = 'auto';
  };

  return (
    <group position={[xPos, 0, zPos]}>
      <mesh
        ref={meshRef}
        position={[0, baseHeight / 2, 0]}
        castShadow={cell.type === 'wall' || cell.type === 'weighted'}
        receiveShadow
        onPointerDown={handleDown}
        onPointerEnter={handleEnter}
        onPointerOut={handleOut}
      >
        <boxGeometry args={[TILE_FOOTPRINT, baseHeight, TILE_FOOTPRINT]} />
        <meshStandardMaterial
          color={bodyColor}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity * 0.42}
          roughness={cell.type === 'wall' ? 0.5 : 0.36}
          metalness={cell.type === 'wall' ? 0.68 : 0.58}
        />
      </mesh>

      {/* Beveled metallic collar + luminous trim cap */}
      {trimColor && (
        <group position={[0, baseHeight, 0]}>
          <mesh position={[0, 0.015, 0]}>
            <boxGeometry args={[TILE_FOOTPRINT * 0.94, 0.03, TILE_FOOTPRINT * 0.94]} />
            <meshStandardMaterial color="#192742" roughness={0.35} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.038, 0]}>
            <boxGeometry args={[TILE_FOOTPRINT * 0.86, 0.03, TILE_FOOTPRINT * 0.86]} />
            <meshStandardMaterial
              color={trimColor}
              emissive={trimColor}
              emissiveIntensity={Math.min(1.55, trimIntensity)}
              toneMapped={cell.type === 'wall'}
              roughness={0.25}
            />
          </mesh>
        </group>
      )}

      {/* Weighted cost indicator */}
      {cell.type === 'weighted' && (
        <CanvasLabel
          text={String(cell.weight)}
          position={[0, baseHeight + 0.38, 0]}
          scale={0.32}
          fontSize={34}
          color="#FDE68A"
          background="rgba(26, 20, 10, 0.88)"
          borderColor="#FBBF24"
        />
      )}

      {/* Start / Goal Beacon Spires */}
      {(cell.type === 'start' || cell.type === 'goal') && (
        <>
          <mesh ref={spireRef} position={[0, baseHeight + 0.62, 0]}>
            <octahedronGeometry args={[0.3, 0]} />
            <meshStandardMaterial
              color={cell.type === 'start' ? '#38BDF8' : '#34D399'}
              emissive={cell.type === 'start' ? '#38BDF8' : '#34D399'}
              emissiveIntensity={1.5}
              toneMapped={false}
              roughness={0.18}
            />
          </mesh>
          <CanvasLabel
            text={cell.type === 'start' ? 'START' : 'GOAL'}
            position={[0, baseHeight + 1.28, 0]}
            scale={0.34}
            fontSize={32}
            color={cell.type === 'start' ? '#38BDF8' : '#34D399'}
            borderColor={cell.type === 'start' ? '#38BDF8' : '#34D399'}
          />
        </>
      )}
    </group>
  );
}

function PathSplineRibbon({ state }: { state: PathfindingWorldState }) {
  const orbRef = useRef<THREE.Mesh | null>(null);
  const orbPos = useMemo(() => new THREE.Vector3(), []);

  const { curve, geometry } = useMemo(() => {
    if (!state.pathFound) return { curve: null, geometry: null };

    const pathCells = state.cells.filter((c) => c.inPath || c.type === 'start' || c.type === 'goal');
    if (pathCells.length < 2) return { curve: null, geometry: null };

    const cellMap = new Map<string, GridCell>();
    for (const c of pathCells) {
      cellMap.set(`${c.x},${c.y}`, c);
    }

    // Reconstruct ordered path from start -> goal over inPath cells
    const startKey = `${state.start[0]},${state.start[1]}`;
    const goalKey = `${state.goal[0]},${state.goal[1]}`;
    const queue: string[] = [startKey];
    const parent = new Map<string, string | null>([[startKey, null]]);
    const dirs = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];

    let foundGoal = false;
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (curr === goalKey) {
        foundGoal = true;
        break;
      }
      const [cx, cy] = curr.split(',').map(Number);
      for (const [dx, dy] of dirs) {
        const nk = `${cx + dx},${cy + dy}`;
        if (!parent.has(nk) && cellMap.has(nk)) {
          parent.set(nk, curr);
          queue.push(nk);
        }
      }
    }

    if (!foundGoal) return { curve: null, geometry: null };

    const ordered: GridCell[] = [];
    let cur: string | null = goalKey;
    while (cur) {
      const cell = cellMap.get(cur);
      if (cell) ordered.push(cell);
      cur = parent.get(cur) ?? null;
    }
    ordered.reverse();

    if (ordered.length < 2) return { curve: null, geometry: null };

    const ox = ((state.width - 1) * CELL_SIZE) / 2;
    const oz = ((state.height - 1) * CELL_SIZE) / 2;

    const points = ordered.map((c) => {
      const h = getTileHeight(c);
      return new THREE.Vector3(c.x * CELL_SIZE - ox, h + 0.36, c.y * CELL_SIZE - oz);
    });

    const c = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.25);
    const tube = new THREE.TubeGeometry(c, Math.max(24, ordered.length * 8), 0.085, 8, false);
    return { curve: c, geometry: tube };
  }, [state]);

  useEffect(() => {
    return () => {
      geometry?.dispose();
    };
  }, [geometry]);

  useFrame((clockState) => {
    if (!curve || !orbRef.current) return;
    const t = (clockState.clock.elapsedTime * 0.42) % 1;
    curve.getPointAt(t, orbPos);
    orbRef.current.position.copy(orbPos);
  });

  if (!geometry || !curve) return null;

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color="#34D399"
          emissive="#34D399"
          emissiveIntensity={1.45}
          toneMapped={false}
          roughness={0.22}
        />
      </mesh>
      <mesh ref={orbRef}>
        <sphereGeometry args={[0.16, 12, 12]} />
        <meshStandardMaterial
          color="#F8FAFC"
          emissive="#34D399"
          emissiveIntensity={1.55}
          toneMapped={false}
          roughness={0.15}
        />
      </mesh>
    </group>
  );
}

export function PathfindingScene3D({
  state,
  interactive,
  paintTool = 'wall',
  onDirectAction,
}: PathfindingScene3DProps) {
  const isPaintingRef = useRef(false);
  const lastPaintedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const endPaint = () => {
      isPaintingRef.current = false;
      lastPaintedKeyRef.current = null;
    };
    window.addEventListener('pointerup', endPaint);
    return () => window.removeEventListener('pointerup', endPaint);
  }, []);

  const emitCellToggle = (x: number, y: number) => {
    const key = `${x},${y}`;
    if (lastPaintedKeyRef.current === key) return;
    lastPaintedKeyRef.current = key;
    soundEngine.playSelect();
    onDirectAction?.({
      world: 'pathfinding',
      type: 'TOGGLE_CELL',
      payload: { x, y, tool: paintTool },
    });
  };

  const handlePointerDownCell = (x: number, y: number) => {
    isPaintingRef.current = true;
    lastPaintedKeyRef.current = null;
    emitCellToggle(x, y);
  };

  const handlePointerEnterCell = (x: number, y: number) => {
    if (!isPaintingRef.current) return;
    emitCellToggle(x, y);
  };

  const offsetX = ((state.width - 1) * CELL_SIZE) / 2;
  const offsetZ = ((state.height - 1) * CELL_SIZE) / 2;

  return (
    <group>
      {/* Terrain frame plinth */}
      <mesh position={[0, -0.01, 0]} receiveShadow>
        <boxGeometry
          args={[state.width * CELL_SIZE + 0.56, 0.08, state.height * CELL_SIZE + 0.56]}
        />
        <meshStandardMaterial color="#11192B" roughness={0.48} metalness={0.65} />
      </mesh>

      {/* Extruded Isometric Terrain Tiles */}
      {state.cells.map((cell) => (
        <TileMesh
          key={`${cell.x},${cell.y}`}
          cell={cell}
          xPos={cell.x * CELL_SIZE - offsetX}
          zPos={cell.y * CELL_SIZE - offsetZ}
          interactive={interactive}
          onPointerDownCell={handlePointerDownCell}
          onPointerEnterCell={handlePointerEnterCell}
        />
      ))}

      {/* Elevated Emerald Path Spline Ribbon */}
      <PathSplineRibbon state={state} />
    </group>
  );
}
