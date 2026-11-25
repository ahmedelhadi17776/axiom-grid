import { useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { ArraySlot, ArraySlotState, ArraysWorldState } from '../../engine/types';
import type { DirectAction } from '../IsometricCanvas';
import { CanvasLabel } from '../CanvasLabel';
import { soundEngine } from '../../audio/soundEngine';

export interface ArraysScene3DProps {
  state: ArraysWorldState;
  interactive: boolean;
  onDirectAction?: (action: DirectAction) => void;
}

const SLOT_SPACING = 1.65;

function getSlotVisuals(
  slotState: ArraySlotState,
  isSelected: boolean,
  isHovered: boolean,
  inWindow: boolean,
  isShielded: boolean,
  isFoundProbe: boolean
): { bodyColor: string; emissive: string; intensity: number; capColor: string } {
  if (isFoundProbe) {
    return {
      bodyColor: '#0E2B22',
      emissive: '#34D399',
      intensity: 1.5,
      capColor: '#34D399',
    };
  }
  if (isShielded) {
    return {
      bodyColor: isHovered ? '#1A2740' : '#121B2E',
      emissive: isHovered ? '#38BDF8' : '#334155',
      intensity: isHovered ? 1.2 : 0.32,
      capColor: isHovered ? '#38BDF8' : '#475569',
    };
  }
  if (isSelected) {
    return {
      bodyColor: '#112842',
      emissive: '#38BDF8',
      intensity: 1.5,
      capColor: '#38BDF8',
    };
  }
  switch (slotState) {
    case 'swapping':
      return { bodyColor: '#2B210E', emissive: '#FBBF24', intensity: 1.5, capColor: '#FBBF24' };
    case 'comparing':
      return { bodyColor: '#261E0F', emissive: '#FBBF24', intensity: 1.35, capColor: '#FBBF24' };
    case 'sorted':
      return { bodyColor: '#0E2921', emissive: '#34D399', intensity: 1.4, capColor: '#34D399' };
    case 'active':
      return { bodyColor: '#10263D', emissive: '#38BDF8', intensity: 1.35, capColor: '#38BDF8' };
    case 'window':
      return { bodyColor: '#11253B', emissive: '#38BDF8', intensity: 1.25, capColor: '#38BDF8' };
    case 'corrupted':
    case 'error':
      return { bodyColor: '#2E1320', emissive: '#FB7185', intensity: 1.5, capColor: '#FB7185' };
    default:
      if (inWindow) {
        return { bodyColor: '#12243A', emissive: '#38BDF8', intensity: 1.15, capColor: '#38BDF8' };
      }
      return {
        bodyColor: isHovered ? '#1A2844' : '#131E34',
        emissive: isHovered ? '#38BDF8' : '#3B82F6',
        intensity: isHovered ? 1.25 : 0.48,
        capColor: isHovered ? '#38BDF8' : '#60A5FA',
      };
  }
}

interface SlotPedestalProps {
  slot: ArraySlot;
  index: number;
  xPos: number;
  height: number;
  isSelected: boolean;
  isHovered: boolean;
  inWindow: boolean;
  isShielded: boolean;
  isFoundProbe: boolean;
  interactive: boolean;
  onHover: (idx: number | null) => void;
  onClick: (idx: number, shiftKey: boolean) => void;
}

function SlotPedestal({
  slot,
  index,
  xPos,
  height,
  isSelected,
  isHovered,
  inWindow,
  isShielded,
  isFoundProbe,
  interactive,
  onHover,
  onClick,
}: SlotPedestalProps) {
  const groupRef = useRef<THREE.Group | null>(null);
  const visuals = getSlotVisuals(
    slot.state,
    isSelected,
    isHovered,
    inWindow,
    isShielded,
    isFoundProbe
  );

  useFrame((clockState, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const dt = Math.min(delta, 0.05);
    const t = clockState.clock.elapsedTime;

    const targetLift =
      slot.state === 'swapping'
        ? 0.48 + Math.sin(t * 9) * 0.07
        : isSelected || isFoundProbe
          ? 0.3 + Math.sin(t * 4.5) * 0.04
          : isHovered
            ? 0.16
            : slot.state === 'comparing'
              ? 0.14
              : 0;

    group.position.x = THREE.MathUtils.lerp(group.position.x, xPos, 1 - Math.exp(-dt * 12));
    group.position.y = THREE.MathUtils.lerp(group.position.y, targetLift, 1 - Math.exp(-dt * 12));
  });

  const handlePointerOver = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    document.body.style.cursor = 'pointer';
    onHover(index);
    soundEngine.playHover();
  };

  const handlePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    document.body.style.cursor = 'auto';
    onHover(null);
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    onClick(index, e.shiftKey);
  };

  return (
    <group>
      {/* Layered metallic base socket on memory rail */}
      <mesh position={[xPos, 0.07, 0]} receiveShadow>
        <boxGeometry args={[1.3, 0.12, 1.3]} />
        <meshStandardMaterial color="#121B2E" roughness={0.48} metalness={0.68} />
      </mesh>
      <mesh position={[xPos, 0.135, 0]} receiveShadow>
        <boxGeometry args={[1.14, 0.03, 1.14]} />
        <meshStandardMaterial color="#0C1322" roughness={0.55} metalness={0.55} />
      </mesh>

      {/* Index label on front edge */}
      <CanvasLabel
        text={`[${index}]`}
        position={[xPos, 0.14, 0.98]}
        scale={0.33}
        fontSize={36}
        color={isSelected || isFoundProbe ? visuals.capColor : '#94A3B8'}
        background="rgba(11, 16, 28, 0.84)"
        borderColor={isSelected || isFoundProbe ? visuals.capColor : 'rgba(51, 65, 85, 0.7)'}
      />

      {/* Animated collared pedestal block */}
      <group ref={groupRef} position={[xPos, 0, 0]}>
        {/* Lower beveled metallic collar */}
        <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.1, 0.12, 1.1]} />
          <meshStandardMaterial color="#162238" roughness={0.38} metalness={0.72} />
        </mesh>

        {/* Main pedestal column */}
        <mesh
          position={[0, 0.18 + height / 2, 0]}
          castShadow
          receiveShadow
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        >
          <boxGeometry args={[1.0, height, 1.0]} />
          <meshStandardMaterial
            color={visuals.bodyColor}
            emissive={visuals.emissive}
            emissiveIntensity={isShielded ? 0.18 : visuals.intensity * 0.28}
            roughness={0.34}
            metalness={0.68}
          />
        </mesh>

        {/* Upper beveled metallic bezel */}
        <mesh position={[0, 0.18 + height + 0.035, 0]} castShadow>
          <boxGeometry args={[1.08, 0.07, 1.08]} />
          <meshStandardMaterial color="#192742" roughness={0.32} metalness={0.72} />
        </mesh>

        {/* Calm luminous top inlay cap (or shielded dark-slate cap) */}
        <mesh position={[0, 0.18 + height + 0.085, 0]}>
          <boxGeometry args={[0.96, 0.045, 0.96]} />
          <meshStandardMaterial
            color={visuals.capColor}
            emissive={visuals.emissive}
            emissiveIntensity={isShielded ? (isHovered ? 1.1 : 0.25) : Math.min(1.55, visuals.intensity)}
            toneMapped={!isShielded}
            roughness={isShielded ? 0.42 : 0.22}
            metalness={isShielded ? 0.65 : 0.2}
          />
        </mesh>

        {/* Selection or Found Halo Ring */}
        {(isSelected || isFoundProbe) && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.24, 0]}>
            <ringGeometry args={[0.76, 0.89, 4]} />
            <meshStandardMaterial
              color={isFoundProbe ? '#34D399' : '#38BDF8'}
              emissive={isFoundProbe ? '#34D399' : '#38BDF8'}
              emissiveIntensity={1.45}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* Value label (or '?' when shielded in Binary Search mode) */}
        <CanvasLabel
          text={isShielded ? '?' : String(slot.value)}
          position={[0, 0.18 + height + 0.56, 0]}
          scale={0.46}
          fontSize={44}
          color={
            isShielded
              ? isHovered
                ? '#7DD3FC'
                : '#94A3B8'
              : slot.state === 'corrupted'
                ? '#FDA4AF'
                : '#F1F5F9'
          }
          background="rgba(11, 16, 28, 0.88)"
          borderColor={visuals.capColor}
        />
      </group>
    </group>
  );
}

function getPointerColor(name: string): string {
  const lower = name.toLowerCase();
  if (lower === 'l' || lower === 'left' || lower === 'read' || lower === 'i') return '#38BDF8';
  if (lower === 'r' || lower === 'right' || lower === 'write' || lower === 'j') return '#A78BFA';
  return '#FBBF24';
}

function SearchTargetBeacon({
  target,
  found,
}: {
  target: number;
  found: boolean;
}) {
  const crystalRef = useRef<THREE.Mesh | null>(null);
  const color = found ? '#34D399' : '#38BDF8';

  useFrame((clockState) => {
    if (!crystalRef.current) return;
    const t = clockState.clock.elapsedTime;
    crystalRef.current.rotation.y = t * 1.5;
    crystalRef.current.position.y = 3.55 + Math.sin(t * 2.8) * 0.08;
  });

  return (
    <group position={[0, 0, -1.6]}>
      <mesh ref={crystalRef} position={[0, 3.55, 0]}>
        <octahedronGeometry args={[0.24, 0]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.45}
          toneMapped={false}
          roughness={0.2}
        />
      </mesh>
      <CanvasLabel
        text={found ? `LOCKED: ${target}` : `TARGET: ${target}`}
        position={[0, 4.18, 0]}
        scale={0.46}
        fontSize={38}
        color="#F8FAFC"
        background="rgba(11, 18, 32, 0.92)"
        borderColor={color}
      />
    </group>
  );
}

export function ArraysScene3D({ state, interactive, onDirectAction }: ArraysScene3DProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const count = state.slots.length;
  const railWidth = Math.max(4, count * SLOT_SPACING + 1.1);
  const startOffset = ((count - 1) * SLOT_SPACING) / 2;
  const isProbeMode = state.searchTarget !== undefined;
  const probedSet = useMemo(() => new Set(state.probedIndices ?? []), [state.probedIndices]);
  const isSearchResolved = state.foundIndex !== undefined && state.foundIndex !== null;

  const { minVal, valSpan } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    for (const s of state.slots) {
      if (s.value < min) min = s.value;
      if (s.value > max) max = s.value;
    }
    if (!Number.isFinite(min)) return { minVal: 0, valSpan: 1 };
    return { minVal: Math.min(0, min), valSpan: Math.max(1, max - Math.min(0, min)) };
  }, [state.slots]);

  // Group pointers by index so overlapping pointers stack vertically cleanly
  const pointersByIndex = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const [name, idx] of Object.entries(state.pointers)) {
      if (idx < 0 || idx >= count) continue;
      const list = map.get(idx) ?? [];
      list.push(name);
      map.set(idx, list);
    }
    return map;
  }, [state.pointers, count]);

  const handleSlotClick = (idx: number, shiftKey: boolean) => {
    if (!interactive) return;

    // Binary Search Probe Mode: clicking probes the slot directly
    if (isProbeMode) {
      setSelectedIdx(null);
      soundEngine.playStep(0.6);
      onDirectAction?.({
        world: 'arrays',
        type: 'PROBE',
        payload: { index: idx },
      });
      return;
    }

    // Shift+Click slides the window if this level has an active window
    if (shiftKey && state.window) {
      const [wLeft, wRight] = state.window;
      const winLen = Math.max(1, wRight - wLeft + 1);
      const nextLeft = THREE.MathUtils.clamp(idx, 0, Math.max(0, count - winLen));
      const nextRight = Math.min(count - 1, nextLeft + winLen - 1);
      soundEngine.playSelect();
      onDirectAction?.({
        world: 'arrays',
        type: 'SET_WINDOW',
        payload: { left: nextLeft, right: nextRight },
      });
      return;
    }

    if (selectedIdx === null) {
      setSelectedIdx(idx);
      soundEngine.playSelect();
      return;
    }

    if (selectedIdx === idx) {
      setSelectedIdx(null);
      soundEngine.playHover();
      return;
    }

    const from = selectedIdx;
    setSelectedIdx(null);
    soundEngine.playSelect();
    onDirectAction?.({
      world: 'arrays',
      type: 'SWAP',
      payload: { i: from, j: idx },
    });
  };

  const slideWindow = (delta: -1 | 1) => {
    if (!interactive || !state.window) return;
    const [wLeft, wRight] = state.window;
    const winLen = wRight - wLeft + 1;
    const nextLeft = THREE.MathUtils.clamp(wLeft + delta, 0, Math.max(0, count - winLen));
    const nextRight = nextLeft + winLen - 1;
    if (nextLeft === wLeft && nextRight === wRight) return;
    soundEngine.playSelect();
    onDirectAction?.({
      world: 'arrays',
      type: 'SET_WINDOW',
      payload: { left: nextLeft, right: nextRight },
    });
  };

  const windowVisual = useMemo(() => {
    if (!state.window) return null;
    const [l, r] = state.window;
    const clampedL = THREE.MathUtils.clamp(l, 0, Math.max(0, count - 1));
    const clampedR = THREE.MathUtils.clamp(r, clampedL, Math.max(0, count - 1));
    const leftX = clampedL * SLOT_SPACING - startOffset;
    const rightX = clampedR * SLOT_SPACING - startOffset;
    const centerX = (leftX + rightX) / 2;
    const width = (clampedR - clampedL + 1) * SLOT_SPACING + 0.15;
    return { centerX, width, left: clampedL, right: clampedR };
  }, [state.window, count, startOffset]);

  return (
    <group>
      {/* Floating Binary Search Target Radar Beacon */}
      {isProbeMode && state.searchTarget !== undefined && (
        <SearchTargetBeacon target={state.searchTarget} found={isSearchResolved} />
      )}

      {/* Contiguous Memory Rail Baseplate */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[railWidth, 0.09, 2.28]} />
        <meshStandardMaterial color="#131E34" roughness={0.42} metalness={0.7} />
      </mesh>

      {/* Calm sky-cyan rail trim bars */}
      <mesh position={[0, 0.075, 1.1]}>
        <boxGeometry args={[railWidth, 0.045, 0.055]} />
        <meshStandardMaterial
          color="#38BDF8"
          emissive="#38BDF8"
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.075, -1.1]}>
        <boxGeometry args={[railWidth, 0.045, 0.055]} />
        <meshStandardMaterial
          color="#38BDF8"
          emissive="#38BDF8"
          emissiveIntensity={1.2}
          toneMapped={false}
        />
      </mesh>

      {/* Memory Slot Pedestals */}
      {state.slots.map((slot, idx) => {
        const xPos = idx * SLOT_SPACING - startOffset;
        const isShielded = isProbeMode && !isSearchResolved && !probedSet.has(idx);
        const isFoundProbe = isProbeMode && state.foundIndex === idx;
        const norm = (slot.value - minVal) / valSpan;
        const height = isShielded
          ? 1.15
          : slot.value === 0
            ? 0.34
            : 0.55 + norm * 2.1;
        const inWindow =
          windowVisual !== null && idx >= windowVisual.left && idx <= windowVisual.right;
        const slotPointers = pointersByIndex.get(idx);

        return (
          <group key={slot.id}>
            <SlotPedestal
              slot={slot}
              index={idx}
              xPos={xPos}
              height={height}
              isSelected={!isProbeMode && selectedIdx === idx}
              isHovered={hoveredIdx === idx}
              inWindow={inWindow}
              isShielded={isShielded}
              isFoundProbe={isFoundProbe}
              interactive={interactive}
              onHover={setHoveredIdx}
              onClick={handleSlotClick}
            />

            {/* Floating Pointer Beacons */}
            {slotPointers &&
              slotPointers.map((ptrName, pIdx) => {
                const ptrColor = getPointerColor(ptrName);
                const yBeacon = 0.18 + height + 1.25 + pIdx * 0.68;
                return (
                  <group key={ptrName} position={[xPos, yBeacon, 0]}>
                    <mesh rotation={[Math.PI, 0, 0]} position={[0, -0.22, 0]}>
                      <coneGeometry args={[0.15, 0.28, 4]} />
                      <meshStandardMaterial
                        color={ptrColor}
                        emissive={ptrColor}
                        emissiveIntensity={1.4}
                        toneMapped={false}
                      />
                    </mesh>
                    <CanvasLabel
                      text={ptrName.toUpperCase()}
                      position={[0, 0.18, 0]}
                      scale={0.35}
                      fontSize={34}
                      color={ptrColor}
                      background="rgba(11, 16, 28, 0.9)"
                      borderColor={ptrColor}
                    />
                  </group>
                );
              })}
          </group>
        );
      })}

      {/* Translucent Sliding Window Frame + Interactive Slide Handles */}
      {windowVisual && (
        <group position={[windowVisual.centerX, 0, 0]}>
          <mesh position={[0, 1.55, 0]}>
            <boxGeometry args={[windowVisual.width, 2.9, 1.58]} />
            <meshStandardMaterial
              color="#38BDF8"
              emissive="#38BDF8"
              emissiveIntensity={0.45}
              transparent
              opacity={0.09}
              depthWrite={false}
            />
          </mesh>
          {/* Glowing top window frame rails */}
          <mesh position={[0, 3.0, 0.78]}>
            <boxGeometry args={[windowVisual.width, 0.055, 0.055]} />
            <meshStandardMaterial
              color="#38BDF8"
              emissive="#38BDF8"
              emissiveIntensity={1.35}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, 3.0, -0.78]}>
            <boxGeometry args={[windowVisual.width, 0.055, 0.055]} />
            <meshStandardMaterial
              color="#38BDF8"
              emissive="#38BDF8"
              emissiveIntensity={1.35}
              toneMapped={false}
            />
          </mesh>

          {/* Left Slide Handle */}
          {interactive && windowVisual.left > 0 && (
            <group
              position={[-windowVisual.width / 2 - 0.55, 0.35, 1.45]}
              onClick={(e) => {
                e.stopPropagation();
                slideWindow(-1);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
                soundEngine.playHover();
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'auto';
              }}
            >
              <mesh rotation={[0, 0, Math.PI / 2]}>
                <coneGeometry args={[0.22, 0.4, 4]} />
                <meshStandardMaterial
                  color="#38BDF8"
                  emissive="#38BDF8"
                  emissiveIntensity={1.45}
                  toneMapped={false}
                />
              </mesh>
            </group>
          )}

          {/* Right Slide Handle */}
          {interactive && windowVisual.right < count - 1 && (
            <group
              position={[windowVisual.width / 2 + 0.55, 0.35, 1.45]}
              onClick={(e) => {
                e.stopPropagation();
                slideWindow(1);
              }}
              onPointerOver={(e) => {
                e.stopPropagation();
                document.body.style.cursor = 'pointer';
                soundEngine.playHover();
              }}
              onPointerOut={() => {
                document.body.style.cursor = 'auto';
              }}
            >
              <mesh rotation={[0, 0, -Math.PI / 2]}>
                <coneGeometry args={[0.22, 0.4, 4]} />
                <meshStandardMaterial
                  color="#38BDF8"
                  emissive="#38BDF8"
                  emissiveIntensity={1.45}
                  toneMapped={false}
                />
              </mesh>
            </group>
          )}
        </group>
      )}

      {/* Optional Auxiliary Memory Slots */}
      {state.auxSlots && state.auxSlots.length > 0 && (
        <group position={[0, 0, 2.75]}>
          <CanvasLabel
            text="AUX MEM"
            position={[-((state.auxSlots.length * 1.3) / 2) - 1.1, 0.4, 0]}
            scale={0.34}
            fontSize={32}
            color="#A78BFA"
            borderColor="#A78BFA"
          />
          {state.auxSlots.map((val, i) => {
            const ax = (i - (state.auxSlots!.length - 1) / 2) * 1.3;
            return (
              <group key={i} position={[ax, 0.28, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[0.92, 0.48, 0.92]} />
                  <meshStandardMaterial
                    color="#1E1838"
                    emissive="#A78BFA"
                    emissiveIntensity={0.6}
                    roughness={0.34}
                    metalness={0.62}
                  />
                </mesh>
                <CanvasLabel
                  text={String(val)}
                  position={[0, 0.58, 0]}
                  scale={0.38}
                  fontSize={38}
                  color="#EDE9FE"
                  borderColor="#A78BFA"
                />
              </group>
            );
          })}
        </group>
      )}
    </group>
  );
}
