import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { LinkedListNode, LinkedListWorldState } from '../../engine/types';
import type { DirectAction } from '../IsometricCanvas';
import { CanvasLabel } from '../CanvasLabel';
import { soundEngine } from '../../audio/soundEngine';

export interface LinkedListScene3DProps {
  state: LinkedListWorldState;
  interactive: boolean;
  onDirectAction?: (action: DirectAction) => void;
}

interface EnergyConduitProps {
  from: [number, number, number];
  to: [number, number, number];
  isSelfLoop: boolean;
  isCycleOrBack: boolean;
  isPreview?: boolean;
  color: string;
}

function EnergyConduit({
  from,
  to,
  isSelfLoop,
  isCycleOrBack,
  isPreview = false,
  color,
}: EnergyConduitProps) {
  const pulseRef = useRef<THREE.Mesh | null>(null);
  const pulsePos = useMemo(() => new THREE.Vector3(), []);

  const { curve, geometry } = useMemo(() => {
    const start = new THREE.Vector3(from[0], from[1] + 1.15, from[2]);
    const end = new THREE.Vector3(to[0], to[1] + 1.15, to[2]);

    let c: THREE.CatmullRomCurve3;
    if (isSelfLoop) {
      c = new THREE.CatmullRomCurve3([
        start.clone().add(new THREE.Vector3(0.45, 0.1, 0)),
        start.clone().add(new THREE.Vector3(1.15, 0.95, 0.7)),
        start.clone().add(new THREE.Vector3(0, 1.55, 1.15)),
        start.clone().add(new THREE.Vector3(-1.15, 0.95, 0.7)),
        start.clone().add(new THREE.Vector3(-0.45, 0.1, 0)),
      ]);
    } else {
      const mid = start.clone().lerp(end, 0.5);
      const dist = start.distanceTo(end);
      const archY = isCycleOrBack ? Math.min(2.6, 1.05 + dist * 0.22) : Math.min(1.1, 0.35 + dist * 0.1);
      const sideOffset = isCycleOrBack ? 0.85 : 0;
      const dir = end.clone().sub(start).normalize();
      const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(sideOffset);

      mid.y += archY;
      mid.add(perp);

      c = new THREE.CatmullRomCurve3([start, mid, end]);
    }

    const tube = new THREE.TubeGeometry(c, isSelfLoop ? 32 : 24, isPreview ? 0.045 : 0.06, 8, false);
    return { curve: c, geometry: tube };
  }, [from, to, isSelfLoop, isCycleOrBack, isPreview]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  useFrame((clockState) => {
    if (!pulseRef.current) return;
    const speed = isPreview ? 1.4 : 0.58;
    const t = (clockState.clock.elapsedTime * speed) % 1;
    curve.getPointAt(t, pulsePos);
    pulseRef.current.position.copy(pulsePos);
  });

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isPreview ? 2.2 : 1.7}
          toneMapped={false}
          transparent={isPreview}
          opacity={isPreview ? 0.75 : 1}
        />
      </mesh>
      <mesh ref={pulseRef}>
        <sphereGeometry args={[isPreview ? 0.11 : 0.14, 10, 10]} />
        <meshStandardMaterial
          color="#FFFFFF"
          emissive={color}
          emissiveIntensity={2.6}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

interface HexNodeProps {
  node: LinkedListNode;
  isHead: boolean;
  isSelected: boolean;
  isHovered: boolean;
  cursors: string[];
  interactive: boolean;
  onHover: (id: string | null) => void;
  onClick: (id: string, altKey: boolean) => void;
  onContextMenu: (id: string) => void;
}

function HexNode({
  node,
  isHead,
  isSelected,
  isHovered,
  cursors,
  interactive,
  onHover,
  onClick,
  onContextMenu,
}: HexNodeProps) {
  const coreRef = useRef<THREE.Group | null>(null);
  const warnRingRef = useRef<THREE.Mesh | null>(null);

  const primaryColor = node.leaked
    ? '#FF2A5F'
    : node.corrupted
      ? '#FF5533'
      : isSelected
        ? '#00F0FF'
        : isHead
          ? '#00FF9D'
          : isHovered
            ? '#38BDF8'
            : '#00F0FF';

  useFrame((clockState) => {
    const t = clockState.clock.elapsedTime;
    if (coreRef.current) {
      if (node.leaked) {
        coreRef.current.position.y = 0.48 + Math.sin(t * 22) * 0.03;
        coreRef.current.position.x = Math.sin(t * 31) * 0.035;
      } else {
        const bob = Math.sin(t * 2.2 + node.pos[0] * 0.9) * 0.09;
        coreRef.current.position.y = 1.15 + bob + (isSelected ? 0.18 : 0);
        coreRef.current.position.x = 0;
      }
    }
    if (warnRingRef.current) {
      warnRingRef.current.rotation.z = t * 2.4;
    }
  });

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
    onHover(node.id);
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
    onClick(node.id, e.altKey);
  };

  const handleContext = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    e.nativeEvent.preventDefault();
    onContextMenu(node.id);
  };

  return (
    <group position={[node.pos[0], node.pos[1], node.pos[2]]}>
      {/* Floor address pad */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, 0]}>
        <ringGeometry args={[0.52, 0.68, 6]} />
        <meshStandardMaterial
          color={primaryColor}
          emissive={primaryColor}
          emissiveIntensity={node.leaked ? 1.8 : 1.1}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Node ID badge on floor */}
      <CanvasLabel
        text={node.id}
        position={[0, 0.12, 0.92]}
        scale={0.3}
        fontSize={32}
        color={node.leaked ? '#FF6B8E' : '#8BA6D9'}
        borderColor={primaryColor}
      />

      {/* Floating hexagonal memory core */}
      <group ref={coreRef} position={[0, 1.15, 0]}>
        <mesh
          castShadow
          onPointerOver={handleOver}
          onPointerOut={handleOut}
          onClick={handleClick}
          onContextMenu={handleContext}
        >
          <cylinderGeometry args={[0.62, 0.62, 0.56, 6]} />
          <meshStandardMaterial
            color={node.leaked ? '#2D0A14' : node.corrupted ? '#331208' : '#0E1B33'}
            emissive={primaryColor}
            emissiveIntensity={isSelected ? 0.7 : 0.25}
            roughness={0.3}
            metalness={0.65}
          />
        </mesh>

        {/* Glowing neon hex top rim */}
        <mesh position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.64, 0.64, 0.06, 6]} />
          <meshStandardMaterial
            color={primaryColor}
            emissive={primaryColor}
            emissiveIntensity={isSelected ? 2.4 : 1.8}
            toneMapped={false}
          />
        </mesh>

        {/* Selection / Rewire Halo */}
        {isSelected && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <ringGeometry args={[0.78, 0.92, 6]} />
            <meshStandardMaterial
              color="#00F0FF"
              emissive="#00F0FF"
              emissiveIntensity={2.4}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* Corrupted warning ring */}
        {(node.corrupted || node.leaked) && (
          <mesh ref={warnRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
            <ringGeometry args={[0.76, 0.88, 6]} />
            <meshStandardMaterial
              color="#FF2A5F"
              emissive="#FF2A5F"
              emissiveIntensity={2.2}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* Value label */}
        <CanvasLabel
          text={String(node.value)}
          position={[0, 0.72, 0]}
          scale={0.46}
          fontSize={44}
          color="#F8FAFC"
          borderColor={primaryColor}
        />

        {/* HEAD Crown Beacon */}
        {isHead && (
          <CanvasLabel
            text="HEAD"
            position={[0, 1.32, 0]}
            scale={0.38}
            fontSize={34}
            color="#00FF9D"
            background="rgba(4, 24, 18, 0.92)"
            borderColor="#00FF9D"
          />
        )}

        {/* Floating Cursor Rings (slow, fast, prev, curr) */}
        {cursors.map((cursorName, idx) => {
          const lower = cursorName.toLowerCase();
          const cColor =
            lower === 'fast'
              ? '#A855F7'
              : lower === 'prev'
                ? '#FFB800'
                : lower === 'slow' || lower === 'curr'
                  ? '#00F0FF'
                  : '#38BDF8';
          const yOff = (isHead ? 1.88 : 1.32) + idx * 0.52;
          return (
            <group key={cursorName}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.34 + idx * 0.14, 0]}>
                <ringGeometry args={[0.7 + idx * 0.1, 0.77 + idx * 0.1, 24]} />
                <meshStandardMaterial
                  color={cColor}
                  emissive={cColor}
                  emissiveIntensity={2.0}
                  toneMapped={false}
                  side={THREE.DoubleSide}
                />
              </mesh>
              <CanvasLabel
                text={cursorName.toUpperCase()}
                position={[0, yOff, 0]}
                scale={0.34}
                fontSize={32}
                color={cColor}
                borderColor={cColor}
              />
            </group>
          );
        })}
      </group>
    </group>
  );
}

export function LinkedListScene3D({
  state,
  interactive,
  onDirectAction,
}: LinkedListScene3DProps) {
  const [rewireFromId, setRewireFromId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [nullHovered, setNullHovered] = useState(false);

  const nodeList = useMemo(() => Object.values(state.nodes), [state.nodes]);

  const nullPadPos = useMemo<[number, number, number]>(() => {
    if (nodeList.length === 0) return [3.5, 0, 0];
    let maxX = -Infinity;
    for (const n of nodeList) {
      if (n.pos[0] > maxX) maxX = n.pos[0];
    }
    return [maxX + 2.8, 0, 0];
  }, [nodeList]);

  const cursorsByNode = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [name, targetId] of Object.entries(state.cursors)) {
      if (!targetId) continue;
      const list = map.get(targetId) ?? [];
      list.push(name);
      map.set(targetId, list);
    }
    return map;
  }, [state.cursors]);

  const handleNodeClick = (id: string, altKey: boolean) => {
    if (!interactive) return;

    if (altKey) {
      setRewireFromId(null);
      soundEngine.playSelect();
      onDirectAction?.({
        world: 'linked-lists',
        type: 'SET_HEAD',
        payload: { nodeId: id },
      });
      return;
    }

    if (rewireFromId === null) {
      setRewireFromId(id);
      soundEngine.playSelect();
      return;
    }

    if (rewireFromId === id) {
      setRewireFromId(null);
      soundEngine.playHover();
      return;
    }

    const fromId = rewireFromId;
    setRewireFromId(null);
    soundEngine.playLink();
    onDirectAction?.({
      world: 'linked-lists',
      type: 'LINK',
      payload: { fromId, toId: id },
    });
  };

  const handleSetHead = (id: string) => {
    if (!interactive) return;
    setRewireFromId(null);
    soundEngine.playSelect();
    onDirectAction?.({
      world: 'linked-lists',
      type: 'SET_HEAD',
      payload: { nodeId: id },
    });
  };

  const handleNullClick = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive || !rewireFromId) return;
    e.stopPropagation();
    const fromId = rewireFromId;
    setRewireFromId(null);
    soundEngine.playLink();
    onDirectAction?.({
      world: 'linked-lists',
      type: 'LINK',
      payload: { fromId, toId: null },
    });
  };

  const previewTargetPos = useMemo<[number, number, number] | null>(() => {
    if (!rewireFromId) return null;
    if (nullHovered) return nullPadPos;
    if (hoveredId && hoveredId !== rewireFromId && state.nodes[hoveredId]) {
      return state.nodes[hoveredId].pos;
    }
    return null;
  }, [rewireFromId, hoveredId, nullHovered, state.nodes, nullPadPos]);

  return (
    <group>
      {/* Floating Hexagonal Memory Cores */}
      {nodeList.map((node) => (
        <HexNode
          key={node.id}
          node={node}
          isHead={state.headId === node.id}
          isSelected={rewireFromId === node.id}
          isHovered={hoveredId === node.id}
          cursors={cursorsByNode.get(node.id) ?? []}
          interactive={interactive}
          onHover={setHoveredId}
          onClick={handleNodeClick}
          onContextMenu={handleSetHead}
        />
      ))}

      {/* Animated Curved Energy Conduits */}
      {nodeList.map((node) => {
        if (!node.nextId) return null;
        const target = state.nodes[node.nextId];
        if (!target) return null;
        const isSelfLoop = node.id === target.id;
        const isCycleOrBack = target.pos[0] <= node.pos[0] || Boolean(state.hasCycle && target.pos[0] < node.pos[0]);
        const conduitColor = node.leaked
          ? '#FF2A5F'
          : isCycleOrBack || isSelfLoop
            ? '#FFB800'
            : '#00F0FF';

        return (
          <EnergyConduit
            key={`${node.id}->${target.id}`}
            from={node.pos}
            to={target.pos}
            isSelfLoop={isSelfLoop}
            isCycleOrBack={isCycleOrBack}
            color={conduitColor}
          />
        );
      })}

      {/* Rewire Mode Live Preview Beam */}
      {rewireFromId && state.nodes[rewireFromId] && previewTargetPos && (
        <EnergyConduit
          from={state.nodes[rewireFromId].pos}
          to={previewTargetPos}
          isSelfLoop={false}
          isCycleOrBack={false}
          isPreview
          color="#00F0FF"
        />
      )}

      {/* Floating Glowing NULL Ground Pad */}
      <group
        position={nullPadPos}
        onClick={handleNullClick}
        onPointerOver={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          setNullHovered(true);
          if (rewireFromId) {
            document.body.style.cursor = 'pointer';
            soundEngine.playHover();
          }
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setNullHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.72, 0.82, 0.16, 6]} />
          <meshStandardMaterial
            color={rewireFromId && nullHovered ? '#2A1238' : '#121526'}
            emissive={rewireFromId ? '#A855F7' : '#475569'}
            emissiveIntensity={rewireFromId && nullHovered ? 2.0 : rewireFromId ? 1.1 : 0.35}
            toneMapped={false}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.2, 0]}>
          <ringGeometry args={[0.68, 0.82, 6]} />
          <meshStandardMaterial
            color={rewireFromId ? '#A855F7' : '#64748B'}
            emissive={rewireFromId ? '#A855F7' : '#64748B'}
            emissiveIntensity={rewireFromId ? 1.9 : 0.6}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <CanvasLabel
          text="NULL"
          position={[0, 0.85, 0]}
          scale={0.42}
          fontSize={38}
          color={rewireFromId ? '#E9D5FF' : '#94A3B8'}
          borderColor={rewireFromId ? '#A855F7' : '#475569'}
        />
      </group>
    </group>
  );
}
