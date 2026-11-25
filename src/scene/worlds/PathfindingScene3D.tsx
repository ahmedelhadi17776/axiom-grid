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
      return 1.35;
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
      meshRef.current.position.y = baseHeight / 2 + Math.sin(t * 6 + cell.x + cell.y) * 0.06;
    } else if (meshRef.current) {
      meshRef.current.position.y = baseHeight / 2;
    }
    if (spireRef.current) {
      spireRef.current.rotation.y = t * 1.4;
      spireRef.current.position.y = baseHeight + 0.62 + Math.sin(t * 3) * 0.08;
    }
  });

  const { bodyColor, emissive, emissiveIntensity, trimColor } = useMemo(() => {
    if (cell.type === 'wall') {
      return {
        bodyColor: '#131526',
        emissive: '#312E81',
        emissiveIntensity: 0.35,
        trimColor: '#6366F1',
      };
    }
    if (cell.type === 'start') {
      return {
        bodyColor: '#072A38',
        emissive: '#00F0FF',
        emissiveIntensity: 1.85,
        trimColor: '#00F0FF',
      };
    }
    if (cell.type === 'goal') {
      return {
        bodyColor: '#072B1F',
        emissive: '#00FF9D',
        emissiveIntensity: 1.95,
        trimColor: '#00FF9D',
      };
    }
    if (cell.inPath) {
      return {
        bodyColor: '#093023',
        emissive: '#00FF9D',
        emissiveIntensity: 1.7,
        trimColor: '#00FF9D',
      };
    }
    if (cell.inFrontier) {
      return {
        bodyColor: '#0A2C40',
        emissive: '#00F0FF',
        emissiveIntensity: 1.85,
        trimColor: '#00F0FF',
      };
    }
    if (cell.visited) {
      return {
        bodyColor: '#1A1B4B',
        emissive: '#4F46E5',
        emissiveIntensity: 1.15,
        trimColor: '#6366F1',
      };
    }
    if (cell.type === 'weighted') {
      return {
        bodyColor: '#2B1D08',
        emissive: '#FFB800',
        emissiveIntensity: 0.95,
        trimColor: '#FFB800',
      };
    }
    if (cell.type === 'relay') {
      return {
        bodyColor: '#221238',
        emissive: '#A855F7',
        emissiveIntensity: 1.5,
        trimColor: '#A855F7',
      };
    }
    return {
      bodyColor: '#0D1324',
      emissive: '#1E293B',
      emissiveIntensity: 0.18,
      trimColor: null,
    };
  }, [cell.type, cell.inPath, cell.inFrontier, cell.visited]);

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
          emissiveIntensity={emissiveIntensity * 0.45}
          roughness={cell.type === 'wall' ? 0.65 : 0.35}
          metalness={0.5}
        />
      </mesh>

      {/* Crisp neon top trim for walls, weighted, frontier, path, start, goal */}
      {trimColor && (
        <mesh position={[0, baseHeight + 0.025, 0]}>
          <boxGeometry args={[TILE_FOOTPRINT * 0.96, 0.05, TILE_FOOTPRINT * 0.96]} />
          <meshStandardMaterial
            color={trimColor}
            emissive={trimColor}
            emissiveIntensity={cell.type === 'wall' ? 1.15 : 1.75}
            toneMapped={false}
          />
        </mesh>
      )}

      {/* Weighted cost indicator */}
      {cell.type === 'weighted' && (
        <CanvasLabel
          text={String(cell.weight)}
          position={[0, baseHeight + 0.36, 0]}
          scale={0.32}
          fontSize={34}
          color="#FDE68A"
          background="rgba(30, 18, 4, 0.85)"
          borderColor="#FFB800"
        />
      )}

      {/* Start / Goal Beacon Spires */}
      {(cell.type === 'start' || cell.type === 'goal') && (
        <>
          <mesh ref={spireRef} position={[0, baseHeight + 0.62, 0]}>
            <octahedronGeometry args={[0.32, 0]} />
            <meshStandardMaterial
              color={cell.type === 'start' ? '#00F0FF' : '#00FF9D'}
              emissive={cell.type === 'start' ? '#00F0FF' : '#00FF9D'}
              emissiveIntensity={2.2}
              toneMapped={false}
            />
          </mesh>
          <CanvasLabel
            text={cell.type === 'start' ? 'START' : 'GOAL'}
            position={[0, baseHeight + 1.28, 0]}
            scale={0.34}
            fontSize={32}
            color={cell.type === 'start' ? '#00F0FF' : '#00FF9D'}
            borderColor={cell.type === 'start' ? '#00F0FF' : '#00FF9D'}
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

    // Reconstruct ordered path from start -> goal via BFS over inPath cells
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
    const tube = new THREE.TubeGeometry(c, Math.max(24, ordered.length * 8), 0.09, 8, false);
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
          color="#00FF9D"
          emissive="#00FF9D"
          emissiveIntensity={2.3}
          toneMapped={false}
        />
      </mesh>
      <mesh ref={orbRef}>
        <sphereGeometry args={[0.18, 12, 12]} />
        <meshStandardMaterial
          color="#FFFFFF"
          emissive="#00FF9D"
          emissiveIntensity={2.8}
          toneMapped={false}
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
          args={[state.width * CELL_SIZE + 0.5, 0.06, state.height * CELL_SIZE + 0.5]}
        />
        <meshStandardMaterial color="#090F1F" roughness={0.6} metalness={0.5} />
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
