import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { TreeNode, TreesWorldState } from '../../engine/types';
import type { DirectAction } from '../IsometricCanvas';
import { CanvasLabel } from '../CanvasLabel';
import { soundEngine } from '../../audio/soundEngine';

export interface TreesScene3DProps {
  state: TreesWorldState;
  interactive: boolean;
  onDirectAction?: (action: DirectAction) => void;
}

interface TreeBranchProps {
  from: [number, number, number];
  to: [number, number, number];
  side: 'left' | 'right';
  highlighted: boolean;
  isPreview?: boolean;
}

function TreeBranch({
  from,
  to,
  side,
  highlighted,
  isPreview = false,
}: TreeBranchProps) {
  const pulseRef = useRef<THREE.Mesh | null>(null);
  const pulsePos = useMemo(() => new THREE.Vector3(), []);

  const color = side === 'left' ? '#38BDF8' : '#A78BFA';

  const { curve, coreGeometry, sheathGeometry } = useMemo(() => {
    const start = new THREE.Vector3(from[0], from[1] + 0.95, from[2]);
    const end = new THREE.Vector3(to[0], to[1] + 0.95, to[2]);
    const mid = start.clone().lerp(end, 0.5);
    const dist = start.distanceTo(end);
    mid.y += Math.min(0.85, 0.28 + dist * 0.09);

    const c = new THREE.CatmullRomCurve3([start, mid, end]);
    const segments = isPreview ? 18 : 26;
    const coreTube = new THREE.TubeGeometry(c, segments, isPreview ? 0.026 : 0.042, 8, false);
    const sheathTube = new THREE.TubeGeometry(c, segments, isPreview ? 0.052 : 0.084, 8, false);
    return { curve: c, coreGeometry: coreTube, sheathGeometry: sheathTube };
  }, [from, to, isPreview]);

  useEffect(() => {
    return () => {
      coreGeometry.dispose();
      sheathGeometry.dispose();
    };
  }, [coreGeometry, sheathGeometry]);

  useFrame((clockState) => {
    if (!pulseRef.current || isPreview) return;
    const speed = highlighted ? 0.85 : 0.45;
    const t = (clockState.clock.elapsedTime * speed) % 1;
    curve.getPointAt(t, pulsePos);
    pulseRef.current.position.copy(pulsePos);
  });

  return (
    <group>
      <mesh geometry={coreGeometry}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isPreview ? 0.85 : highlighted ? 1.45 : 1.15}
          toneMapped={false}
          transparent={isPreview}
          opacity={isPreview ? 0.42 : 1}
          roughness={0.25}
        />
      </mesh>
      <mesh geometry={sheathGeometry}>
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={isPreview ? 0.3 : 0.5}
          transparent
          opacity={isPreview ? 0.1 : 0.16}
          roughness={0.2}
          depthWrite={false}
        />
      </mesh>
      {!isPreview && (
        <mesh ref={pulseRef}>
          <sphereGeometry args={[highlighted ? 0.115 : 0.095, 10, 10]} />
          <meshStandardMaterial
            color="#F8FAFC"
            emissive={color}
            emissiveIntensity={1.5}
            toneMapped={false}
            roughness={0.18}
          />
        </mesh>
      )}
    </group>
  );
}

interface CanopyNodeProps {
  node: TreeNode;
  isRoot: boolean;
  isSelected: boolean;
  isFound: boolean;
  isHovered: boolean;
  showBalanceFactor: boolean;
  interactive: boolean;
  onHover: (id: string | null) => void;
  onClick: (id: string) => void;
}

function CanopyNode({
  node,
  isRoot,
  isSelected,
  isFound,
  isHovered,
  showBalanceFactor,
  interactive,
  onHover,
  onClick,
}: CanopyNodeProps) {
  const outerGroupRef = useRef<THREE.Group | null>(null);
  const floatGroupRef = useRef<THREE.Group | null>(null);
  const bfRingMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  const crownRef = useRef<THREE.Mesh | null>(null);
  const warnRingRef = useRef<THREE.Mesh | null>(null);
  const initializedRef = useRef(false);

  const bf = node.balanceFactor ?? 0;
  const isUnbalanced = Math.abs(bf) > 1;
  const isVisited = node.visitedOrder !== undefined;

  const primaryColor = isFound
    ? '#34D399'
    : node.corrupted
      ? '#FB7185'
      : isSelected
        ? '#38BDF8'
        : node.highlighted
          ? '#FBBF24'
          : isVisited
            ? '#34D399'
            : isHovered
              ? '#5EEAD4'
              : '#2DD4BF';

  const chassisColor = node.corrupted ? '#2A1420' : isFound ? '#0E2922' : '#131E34';
  const capColor = node.corrupted ? '#351A28' : isFound ? '#14362D' : '#192742';

  useFrame((clockState, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clockState.clock.elapsedTime;

    if (outerGroupRef.current) {
      if (!initializedRef.current) {
        outerGroupRef.current.position.set(node.pos[0], node.pos[1], node.pos[2]);
        initializedRef.current = true;
      } else {
        const alpha = 1 - Math.exp(-dt * 9.5);
        outerGroupRef.current.position.x = THREE.MathUtils.lerp(
          outerGroupRef.current.position.x,
          node.pos[0],
          alpha
        );
        outerGroupRef.current.position.y = THREE.MathUtils.lerp(
          outerGroupRef.current.position.y,
          node.pos[1],
          alpha
        );
        outerGroupRef.current.position.z = THREE.MathUtils.lerp(
          outerGroupRef.current.position.z,
          node.pos[2],
          alpha
        );
      }
    }

    if (floatGroupRef.current) {
      const bob = Math.sin(t * 2.1 + node.pos[0] * 0.75 + node.pos[2] * 0.5) * 0.07;
      const lift = isSelected ? 0.16 : isHovered ? 0.09 : 0;
      floatGroupRef.current.position.y = 0.95 + bob + lift;
    }

    if (crownRef.current) {
      crownRef.current.rotation.y = t * 1.1;
    }

    if (warnRingRef.current) {
      warnRingRef.current.rotation.z = t * 1.8;
    }

    if (bfRingMatRef.current && isUnbalanced) {
      bfRingMatRef.current.emissiveIntensity = 1.15 + Math.sin(t * 5.2) * 0.35;
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
    onClick(node.id);
  };

  const bfLabel = bf > 0 ? `BF +${bf}` : `BF ${bf}`;
  const bfColor = isUnbalanced ? '#FB7185' : '#34D399';
  const floorOffsetY = -node.pos[1] + 0.03;

  return (
    <group ref={outerGroupRef}>
      {/* Subtle ground anchor ring directly below floating canopy node */}
      <group position={[0, floorOffsetY, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.38, 0.46, 6]} />
          <meshStandardMaterial
            color={primaryColor}
            emissive={primaryColor}
            emissiveIntensity={0.55}
            transparent
            opacity={0.45}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Floating layered crystalline-hex / octahedral canopy node */}
      <group
        ref={floatGroupRef}
        position={[0, 0.95, 0]}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        {/* Lower chamfered metallic slate chassis */}
        <mesh position={[0, -0.2, 0]} castShadow>
          <cylinderGeometry args={[0.56, 0.44, 0.18, 6]} />
          <meshStandardMaterial color={chassisColor} roughness={0.34} metalness={0.68} />
        </mesh>

        {/* Middle frosted crystalline octahedral core */}
        <mesh position={[0, 0, 0]} castShadow>
          <cylinderGeometry args={[0.5, 0.5, 0.24, 6]} />
          <meshStandardMaterial
            color={chassisColor}
            emissive={primaryColor}
            emissiveIntensity={isSelected || isFound ? 0.65 : isHovered ? 0.52 : 0.38}
            roughness={0.22}
            metalness={0.28}
            transparent
            opacity={0.92}
          />
        </mesh>

        {/* Luminous waist collar trim */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.585, 0.585, 0.055, 6]} />
          <meshStandardMaterial
            color={primaryColor}
            emissive={primaryColor}
            emissiveIntensity={isSelected || isFound ? 1.5 : isHovered ? 1.35 : 1.15}
            toneMapped={false}
            roughness={0.22}
          />
        </mesh>

        {/* Upper beveled metallic cap */}
        <mesh position={[0, 0.2, 0]} castShadow>
          <cylinderGeometry args={[0.5, 0.58, 0.16, 6]} />
          <meshStandardMaterial color={capColor} roughness={0.3} metalness={0.68} />
        </mesh>

        {/* Crisp top glowing hex inlay ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.285, 0]}>
          <ringGeometry args={[0.36, 0.46, 6]} />
          <meshStandardMaterial
            color={primaryColor}
            emissive={primaryColor}
            emissiveIntensity={isSelected || isFound ? 1.5 : 1.2}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Subtle faceted octahedral crystal crest on root or found node */}
        {(isRoot || isFound) && (
          <mesh ref={crownRef} position={[0, 0.44, 0]}>
            <octahedronGeometry args={[0.16, 0]} />
            <meshStandardMaterial
              color={isFound ? '#34D399' : '#2DD4BF'}
              emissive={isFound ? '#34D399' : '#2DD4BF'}
              emissiveIntensity={1.45}
              toneMapped={false}
              roughness={0.18}
            />
          </mesh>
        )}

        {/* Selection halo */}
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

        {/* Corrupted node rotating coral warning ring */}
        {node.corrupted && (
          <mesh ref={warnRingRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]}>
            <ringGeometry args={[0.72, 0.84, 6]} />
            <meshStandardMaterial
              color="#FB7185"
              emissive="#FB7185"
              emissiveIntensity={1.45}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* AVL Balance-Factor Ring */}
        {showBalanceFactor && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.14, 0]}>
            <ringGeometry args={[0.82, 0.92, 24]} />
            <meshStandardMaterial
              ref={bfRingMatRef}
              color={bfColor}
              emissive={bfColor}
              emissiveIntensity={isUnbalanced ? 1.45 : 1.08}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* Primary Value Label */}
        <CanvasLabel
          text={String(node.value)}
          position={[0, 0.72, 0]}
          scale={0.44}
          fontSize={44}
          color="#F8FAFC"
          borderColor={primaryColor}
        />

        {/* ROOT Beacon */}
        {isRoot && (
          <CanvasLabel
            text="ROOT"
            position={[0, 1.26, 0]}
            scale={0.34}
            fontSize={32}
            color="#2DD4BF"
            background="rgba(11, 24, 28, 0.9)"
            borderColor="#2DD4BF"
          />
        )}

        {/* Traversal Visit Order Badge (#1, #2, ...) */}
        {isVisited && (
          <CanvasLabel
            text={`#${node.visitedOrder}`}
            position={[0.68, 0.52, 0]}
            scale={0.32}
            fontSize={34}
            color="#34D399"
            background="rgba(10, 26, 22, 0.92)"
            borderColor="#34D399"
          />
        )}

        {/* AVL Balance Factor Badge */}
        {showBalanceFactor && (
          <CanvasLabel
            text={bfLabel}
            position={[0, -0.34, 0.82]}
            scale={0.28}
            fontSize={30}
            color={bfColor}
            background={isUnbalanced ? 'rgba(38, 14, 24, 0.92)' : 'rgba(10, 24, 20, 0.9)'}
            borderColor={bfColor}
          />
        )}
      </group>
    </group>
  );
}

interface DropSocketProps {
  parentId: string | null;
  parentPos: [number, number, number] | null;
  side: 'left' | 'right';
  position: [number, number, number];
  nextKey: number;
  interactive: boolean;
  onDock: (parentId: string | null, side: 'left' | 'right') => void;
}

function DropSocket({
  parentId,
  parentPos,
  side,
  position,
  nextKey,
  interactive,
  onDock,
}: DropSocketProps) {
  const [hovered, setHovered] = useState(false);
  const ringRef = useRef<THREE.Mesh | null>(null);
  const padRef = useRef<THREE.Group | null>(null);

  const isRootSocket = parentId === null;
  const accentColor = isRootSocket ? '#2DD4BF' : side === 'left' ? '#38BDF8' : '#A78BFA';

  useFrame((clockState) => {
    const t = clockState.clock.elapsedTime;
    if (ringRef.current) {
      const pulse = 1 + Math.sin(t * 3.6 + position[0]) * 0.06;
      ringRef.current.scale.set(pulse, pulse, 1);
    }
    if (padRef.current) {
      padRef.current.position.y = 0.95 + Math.sin(t * 2.4 + position[0]) * 0.05;
    }
  });

  return (
    <group>
      {parentPos && (
        <TreeBranch
          from={parentPos}
          to={position}
          side={side}
          highlighted={hovered}
          isPreview
        />
      )}

      <group position={position}>
        <group
          ref={padRef}
          position={[0, 0.95, 0]}
          onPointerOver={(e) => {
            if (!interactive) return;
            e.stopPropagation();
            setHovered(true);
            document.body.style.cursor = 'pointer';
            soundEngine.playHover();
          }}
          onPointerOut={(e) => {
            e.stopPropagation();
            setHovered(false);
            document.body.style.cursor = 'auto';
          }}
          onClick={(e) => {
            if (!interactive) return;
            e.stopPropagation();
            onDock(parentId, side);
          }}
        >
          {/* Translucent clickable hex drop pad */}
          <mesh>
            <cylinderGeometry args={[0.42, 0.42, 0.1, 6]} />
            <meshStandardMaterial
              color={hovered ? '#1B2D4A' : '#111A2E'}
              emissive={accentColor}
              emissiveIntensity={hovered ? 0.85 : 0.35}
              transparent
              opacity={hovered ? 0.85 : 0.55}
              roughness={0.35}
              metalness={0.5}
            />
          </mesh>

          {/* Pulsing outer docking ring */}
          <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]}>
            <ringGeometry args={[0.38, 0.48, 6]} />
            <meshStandardMaterial
              color={accentColor}
              emissive={accentColor}
              emissiveIntensity={hovered ? 1.5 : 1.15}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>

          <CanvasLabel
            text={
              hovered
                ? `+${nextKey}`
                : isRootSocket
                  ? 'ROOT'
                  : side === 'left'
                    ? '+L'
                    : '+R'
            }
            position={[0, 0.44, 0]}
            scale={hovered ? 0.36 : 0.3}
            fontSize={34}
            color={hovered ? '#F8FAFC' : accentColor}
            background={hovered ? 'rgba(14, 28, 46, 0.92)' : 'rgba(11, 16, 28, 0.82)'}
            borderColor={accentColor}
          />
        </group>
      </group>
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
    gemRef.current.position.y = -0.36 + Math.sin(t * 2.6) * 0.06;
  });

  return (
    <group position={position}>
      <mesh ref={gemRef} position={[0, -0.36, 0]}>
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
        position={[0, 0.14, 0]}
        scale={0.42}
        fontSize={36}
        color="#F8FAFC"
        background="rgba(11, 18, 32, 0.92)"
        borderColor={color}
      />
    </group>
  );
}

export function TreesScene3D({ state, interactive, onDirectAction }: TreesScene3DProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const { reachableNodes, depthMap } = useMemo(() => {
    const list: TreeNode[] = [];
    const depths = new Map<string, number>();
    const seen = new Set<string>();

    const walk = (id: string | null, depth: number) => {
      if (!id || seen.has(id) || !state.nodes[id]) return;
      seen.add(id);
      depths.set(id, depth);
      const node = state.nodes[id];
      list.push(node);
      walk(node.leftId, depth + 1);
      walk(node.rightId, depth + 1);
    };

    walk(state.rootId, 0);

    // Include any detached nodes if present
    for (const node of Object.values(state.nodes)) {
      if (!seen.has(node.id)) {
        list.push(node);
        depths.set(node.id, 0);
      }
    }

    return { reachableNodes: list, depthMap: depths };
  }, [state.nodes, state.rootId]);

  const showBalanceFactors = Boolean(
    state.showBalanceFactors || state.mode === 'balance' || state.mode === 'sandbox'
  );

  const handleNodeClick = (id: string) => {
    if (!interactive) return;

    if (state.mode === 'search') {
      soundEngine.playStep(0.65);
      onDirectAction?.({
        world: 'trees',
        type: 'PROBE',
        payload: { id },
      });
      return;
    }

    if (state.mode === 'traverse') {
      soundEngine.playStep(0.55);
      onDirectAction?.({
        world: 'trees',
        type: 'VISIT_NODE',
        payload: { id },
      });
      return;
    }

    soundEngine.playSelect();
    onDirectAction?.({
      world: 'trees',
      type: 'SELECT_NODE',
      payload: { id },
    });
  };

  const handleDock = (parentId: string | null, side: 'left' | 'right') => {
    if (!interactive) return;
    soundEngine.playLink();
    onDirectAction?.({
      world: 'trees',
      type: 'INSERT_AT',
      payload: { parentId, side },
    });
  };

  // Compute interactive drop sockets when pendingQueue has keys waiting
  const dropSockets = useMemo(() => {
    if (state.pendingQueue.length === 0) return [];
    const nextKey = state.pendingQueue[0];

    if (!state.rootId || !state.nodes[state.rootId]) {
      return [
        {
          key: 'root-socket',
          parentId: null as string | null,
          parentPos: null as [number, number, number] | null,
          side: 'left' as const,
          position: [0, 0.6, -3.8] as [number, number, number],
          nextKey,
        },
      ];
    }

    const sockets: Array<{
      key: string;
      parentId: string | null;
      parentPos: [number, number, number] | null;
      side: 'left' | 'right';
      position: [number, number, number];
      nextKey: number;
    }> = [];

    for (const node of reachableNodes) {
      const depth = depthMap.get(node.id) ?? 0;
      const xOffset = Math.max(0.85, 1.48 - depth * 0.2);
      const zOffset = 1.65;
      const yNext = Number((node.pos[1] - 0.22).toFixed(3));

      if (node.leftId === null) {
        sockets.push({
          key: `${node.id}:left`,
          parentId: node.id,
          parentPos: node.pos,
          side: 'left',
          position: [
            Number((node.pos[0] - xOffset).toFixed(3)),
            yNext,
            Number((node.pos[2] + zOffset).toFixed(3)),
          ],
          nextKey,
        });
      }
      if (node.rightId === null) {
        sockets.push({
          key: `${node.id}:right`,
          parentId: node.id,
          parentPos: node.pos,
          side: 'right',
          position: [
            Number((node.pos[0] + xOffset).toFixed(3)),
            yNext,
            Number((node.pos[2] + zOffset).toFixed(3)),
          ],
          nextKey,
        });
      }
    }

    return sockets;
  }, [state.pendingQueue, state.rootId, state.nodes, reachableNodes, depthMap]);

  const rootPos = state.rootId && state.nodes[state.rootId] ? state.nodes[state.rootId].pos : [0, 0.6, -3.8];

  return (
    <group>
      {/* Floating TARGET beacon in Search Mode */}
      {state.searchTarget !== undefined && (
        <FloatingBeacon
          text={`TARGET: ${state.searchTarget}`}
          position={[rootPos[0], rootPos[1] + 2.85, rootPos[2] - 1.25]}
          color={state.foundNodeId ? '#34D399' : '#38BDF8'}
        />
      )}

      {/* Floating NEXT KEY emitter when keys are queued */}
      {state.pendingQueue.length > 0 && (
        <FloatingBeacon
          text={
            state.pendingQueue.length > 1
              ? `NEXT KEY: ${state.pendingQueue[0]} (+${state.pendingQueue.length - 1})`
              : `NEXT KEY: ${state.pendingQueue[0]}`
          }
          position={[
            rootPos[0] + (state.searchTarget !== undefined ? 3.2 : 0),
            rootPos[1] + 2.85,
            rootPos[2] - 1.25,
          ]}
          color="#2DD4BF"
        />
      )}

      {/* Arched Energy Branches (Left = Sky Cyan, Right = Violet) */}
      {reachableNodes.map((node) => {
        const leftChild = node.leftId ? state.nodes[node.leftId] : null;
        const rightChild = node.rightId ? state.nodes[node.rightId] : null;

        return (
          <group key={`branches-${node.id}`}>
            {leftChild && (
              <TreeBranch
                from={node.pos}
                to={leftChild.pos}
                side="left"
                highlighted={Boolean(node.highlighted || leftChild.highlighted)}
              />
            )}
            {rightChild && (
              <TreeBranch
                from={node.pos}
                to={rightChild.pos}
                side="right"
                highlighted={Boolean(node.highlighted || rightChild.highlighted)}
              />
            )}
          </group>
        );
      })}

      {/* Floating Crystalline Canopy Nodes */}
      {reachableNodes.map((node) => (
        <CanopyNode
          key={node.id}
          node={node}
          isRoot={state.rootId === node.id}
          isSelected={state.selectedNodeId === node.id}
          isFound={state.foundNodeId === node.id}
          isHovered={hoveredId === node.id}
          showBalanceFactor={showBalanceFactors}
          interactive={interactive}
          onHover={setHoveredId}
          onClick={handleNodeClick}
        />
      ))}

      {/* Interactive Empty L / R / ROOT Drop-Sockets */}
      {dropSockets.map((sock) => (
        <DropSocket
          key={sock.key}
          parentId={sock.parentId}
          parentPos={sock.parentPos}
          side={sock.side}
          position={sock.position}
          nextKey={sock.nextKey}
          interactive={interactive}
          onDock={handleDock}
        />
      ))}
    </group>
  );
}
