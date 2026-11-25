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

  const { curve, coreGeometry, sheathGeometry } = useMemo(() => {
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

    const segments = isSelfLoop ? 36 : 28;
    const coreTube = new THREE.TubeGeometry(c, segments, isPreview ? 0.036 : 0.046, 10, false);
    const sheathTube = new THREE.TubeGeometry(c, segments, isPreview ? 0.072 : 0.092, 10, false);
    return { curve: c, coreGeometry: coreTube, sheathGeometry: sheathTube };
  }, [from, to, isSelfLoop, isCycleOrBack, isPreview]);

  useEffect(() => {
    return () => {
      coreGeometry.dispose();
      sheathGeometry.dispose();
    };
  }, [coreGeometry, sheathGeometry]);

  useFrame((clockState) => {
    if (!pulseRef.current) return;
    const speed = isPreview ? 1.3 : 0.55;
    const t = (clockState.clock.elapsedTime * speed) % 1;
    curve.getPointAt(t, pulsePos);
    pulseRef.current.position.copy(pulsePos);
  });

  return (
    <group>
      {/* Inner luminous energy filament */}
      <mesh geometry={coreGeometry}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isPreview ? 1.45 : 1.2}
          toneMapped={false}
          transparent={isPreview}
          opacity={isPreview ? 0.8 : 1}
          roughness={0.25}
        />
      </mesh>
      {/* Subtle translucent outer energy sheath */}
      <mesh geometry={sheathGeometry}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.55}
          transparent
          opacity={isPreview ? 0.22 : 0.18}
          roughness={0.18}
          depthWrite={false}
        />
      </mesh>
      {/* Traveling data pulse orb */}
      <mesh ref={pulseRef}>
        <sphereGeometry args={[isPreview ? 0.1 : 0.125, 12, 12]} />
        <meshStandardMaterial
          color="#F8FAFC"
          emissive={color}
          emissiveIntensity={1.55}
          toneMapped={false}
          roughness={0.15}
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
    ? '#FB7185'
    : node.corrupted
      ? '#F97316'
      : isSelected
        ? '#38BDF8'
        : isHead
          ? '#34D399'
          : isHovered
            ? '#7DD3FC'
            : '#38BDF8';

  const chassisColor = node.leaked ? '#2A1420' : node.corrupted ? '#2B1912' : '#131E34';
  const capColor = node.leaked ? '#331926' : node.corrupted ? '#352017' : '#192742';

  useFrame((clockState) => {
    const t = clockState.clock.elapsedTime;
    if (coreRef.current) {
      if (node.leaked) {
        coreRef.current.position.y = 0.48 + Math.sin(t * 20) * 0.025;
        coreRef.current.position.x = Math.sin(t * 28) * 0.03;
      } else {
        const bob = Math.sin(t * 2.0 + node.pos[0] * 0.9) * 0.08;
        coreRef.current.position.y = 1.15 + bob + (isSelected ? 0.16 : 0);
        coreRef.current.position.x = 0;
      }
    }
    if (warnRingRef.current) {
      warnRingRef.current.rotation.z = t * 2.0;
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
      {/* Soft recessed floor address pad */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[0.64, 0.72, 0.04, 6]} />
        <meshStandardMaterial color="#121B2E" roughness={0.55} metalness={0.55} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.045, 0]}>
        <ringGeometry args={[0.53, 0.63, 6]} />
        <meshStandardMaterial
          color={primaryColor}
          emissive={primaryColor}
          emissiveIntensity={node.leaked ? 1.25 : 0.85}
          toneMapped={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Node ID badge on floor */}
      <CanvasLabel
        text={node.id}
        position={[0, 0.14, 0.94]}
        scale={0.3}
        fontSize={32}
        color={node.leaked ? '#FDA4AF' : '#94A3B8'}
        borderColor={primaryColor}
      />

      {/* Multi-layered floating hexagonal memory plinth */}
      <group
        ref={coreRef}
        position={[0, 1.15, 0]}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
        onContextMenu={handleContext}
      >
        {/* Lower chamfered metallic chassis */}
        <mesh position={[0, -0.2, 0]} castShadow>
          <cylinderGeometry args={[0.6, 0.52, 0.18, 6]} />
          <meshStandardMaterial
            color={chassisColor}
            roughness={0.34}
            metalness={0.72}
          />
        </mesh>

        {/* Middle frosted crystal core */}
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.54, 0.54, 0.24, 6]} />
          <meshStandardMaterial
            color={chassisColor}
            emissive={primaryColor}
            emissiveIntensity={isSelected ? 0.85 : isHovered ? 0.65 : 0.45}
            roughness={0.22}
            metalness={0.25}
            transparent
            opacity={0.92}
          />
        </mesh>

        {/* Recessed glowing waist accent ring */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.625, 0.625, 0.055, 6]} />
          <meshStandardMaterial
            color={primaryColor}
            emissive={primaryColor}
            emissiveIntensity={isSelected ? 1.55 : isHovered ? 1.35 : 1.15}
            toneMapped={false}
            roughness={0.25}
          />
        </mesh>

        {/* Upper beveled metallic cap */}
        <mesh position={[0, 0.2, 0]} castShadow>
          <cylinderGeometry args={[0.56, 0.62, 0.16, 6]} />
          <meshStandardMaterial
            color={capColor}
            roughness={0.3}
            metalness={0.7}
          />
        </mesh>

        {/* Crisp top glowing hex inlay ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.285, 0]}>
          <ringGeometry args={[0.42, 0.52, 6]} />
          <meshStandardMaterial
            color={primaryColor}
            emissive={primaryColor}
            emissiveIntensity={isSelected ? 1.55 : 1.2}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Selection / Rewire Halo */}
        {isSelected && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
            <ringGeometry args={[0.78, 0.9, 6]} />
            <meshStandardMaterial
              color="#38BDF8"
              emissive="#38BDF8"
              emissiveIntensity={1.5}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* Corrupted / leaked warning ring */}
        {(node.corrupted || node.leaked) && (
          <mesh ref={warnRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
            <ringGeometry args={[0.76, 0.87, 6]} />
            <meshStandardMaterial
              color="#FB7185"
              emissive="#FB7185"
              emissiveIntensity={1.45}
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
            color="#34D399"
            background="rgba(11, 24, 24, 0.9)"
            borderColor="#34D399"
          />
        )}

        {/* Floating Cursor Rings (slow, fast, prev, curr) */}
        {cursors.map((cursorName, idx) => {
          const lower = cursorName.toLowerCase();
          const cColor =
            lower === 'fast'
              ? '#A78BFA'
              : lower === 'prev'
                ? '#FBBF24'
                : lower === 'slow' || lower === 'curr'
                  ? '#38BDF8'
                  : '#2DD4BF';
          const yOff = (isHead ? 1.88 : 1.32) + idx * 0.52;
          return (
            <group key={cursorName}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.34 + idx * 0.14, 0]}>
                <ringGeometry args={[0.7 + idx * 0.1, 0.76 + idx * 0.1, 24]} />
                <meshStandardMaterial
                  color={cColor}
                  emissive={cColor}
                  emissiveIntensity={1.3}
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
          ? '#FB7185'
          : isCycleOrBack || isSelfLoop
            ? '#FBBF24'
            : '#38BDF8';

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
          color="#38BDF8"
        />
      )}

      {/* Refined Multi-Tiered NULL Docking Pad */}
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
        {/* Outer metallic hex foundation */}
        <mesh position={[0, 0.08, 0]} receiveShadow>
          <cylinderGeometry args={[0.76, 0.88, 0.16, 6]} />
          <meshStandardMaterial
            color={rewireFromId && nullHovered ? '#251D3D' : '#141D31'}
            roughness={0.4}
            metalness={0.68}
          />
        </mesh>
        {/* Recessed inner docking socket */}
        <mesh position={[0, 0.17, 0]}>
          <cylinderGeometry args={[0.52, 0.56, 0.04, 6]} />
          <meshStandardMaterial
            color="#0D1424"
            emissive={rewireFromId ? '#A78BFA' : '#475569'}
            emissiveIntensity={rewireFromId && nullHovered ? 1.1 : rewireFromId ? 0.55 : 0.18}
            roughness={0.35}
            metalness={0.5}
          />
        </mesh>
        {/* Luminous docking collar ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.175, 0]}>
          <ringGeometry args={[0.64, 0.75, 6]} />
          <meshStandardMaterial
            color={rewireFromId ? '#A78BFA' : '#64748B'}
            emissive={rewireFromId ? '#A78BFA' : '#64748B'}
            emissiveIntensity={rewireFromId && nullHovered ? 1.5 : rewireFromId ? 1.2 : 0.45}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>
        <CanvasLabel
          text="NULL"
          position={[0, 0.85, 0]}
          scale={0.42}
          fontSize={38}
          color={rewireFromId ? '#DDD6FE' : '#94A3B8'}
          borderColor={rewireFromId ? '#A78BFA' : '#475569'}
        />
      </group>
    </group>
  );
}
