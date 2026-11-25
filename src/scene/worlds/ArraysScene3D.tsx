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
  inWindow: boolean
): { bodyColor: string; emissive: string; intensity: number; capColor: string } {
  if (isSelected) {
    return {
      bodyColor: '#0A2538',
      emissive: '#00F0FF',
      intensity: 2.2,
      capColor: '#00F0FF',
    };
  }
  switch (slotState) {
    case 'swapping':
      return { bodyColor: '#2B1F06', emissive: '#FFB800', intensity: 2.3, capColor: '#FFB800' };
    case 'comparing':
      return { bodyColor: '#261C08', emissive: '#FFB800', intensity: 1.9, capColor: '#FFB800' };
    case 'sorted':
      return { bodyColor: '#08291E', emissive: '#00FF9D', intensity: 1.85, capColor: '#00FF9D' };
    case 'active':
      return { bodyColor: '#0A2436', emissive: '#00F0FF', intensity: 1.8, capColor: '#00F0FF' };
    case 'window':
      return { bodyColor: '#0B2338', emissive: '#00F0FF', intensity: 1.5, capColor: '#38BDF8' };
    case 'corrupted':
    case 'error':
      return { bodyColor: '#2E0A16', emissive: '#FF2A5F', intensity: 2.1, capColor: '#FF2A5F' };
    default:
      if (inWindow) {
        return { bodyColor: '#0D2136', emissive: '#00F0FF', intensity: 1.35, capColor: '#38BDF8' };
      }
      return {
        bodyColor: isHovered ? '#162442' : '#0E162B',
        emissive: isHovered ? '#00F0FF' : '#2563EB',
        intensity: isHovered ? 1.4 : 0.45,
        capColor: isHovered ? '#00F0FF' : '#3B82F6',
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
  interactive,
  onHover,
  onClick,
}: SlotPedestalProps) {
  const groupRef = useRef<THREE.Group | null>(null);
  const visuals = getSlotVisuals(slot.state, isSelected, isHovered, inWindow);

  useFrame((clockState, delta) => {
    const group = groupRef.current;
    if (!group) return;
    const dt = Math.min(delta, 0.05);
    const t = clockState.clock.elapsedTime;

    const targetLift =
      slot.state === 'swapping'
        ? 0.52 + Math.sin(t * 10) * 0.08
        : isSelected
          ? 0.36 + Math.sin(t * 5) * 0.05
          : isHovered
            ? 0.2
            : slot.state === 'comparing'
              ? 0.16
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
      {/* Fixed base socket on memory rail */}
      <mesh position={[xPos, 0.08, 0]} receiveShadow>
        <boxGeometry args={[1.26, 0.14, 1.26]} />
        <meshStandardMaterial color="#0A1020" roughness={0.6} metalness={0.5} />
      </mesh>

      {/* Index label on front edge */}
      <CanvasLabel
        text={`[${index}]`}
        position={[xPos, 0.12, 0.96]}
        scale={0.34}
        fontSize={36}
        color={isSelected ? '#00F0FF' : '#7C93B8'}
        background="rgba(6, 10, 20, 0.72)"
        borderColor={isSelected ? '#00F0FF' : 'rgba(30, 46, 82, 0.7)'}
      />

      {/* Animated pedestal block */}
      <group ref={groupRef} position={[xPos, 0, 0]}>
        <mesh
          position={[0, 0.15 + height / 2, 0]}
          castShadow
          receiveShadow
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        >
          <boxGeometry args={[1.06, height, 1.06]} />
          <meshStandardMaterial
            color={visuals.bodyColor}
            emissive={visuals.emissive}
            emissiveIntensity={visuals.intensity * 0.25}
            roughness={0.32}
            metalness={0.55}
          />
        </mesh>

        {/* Glowing neon top cap */}
        <mesh position={[0, 0.15 + height + 0.045, 0]}>
          <boxGeometry args={[1.08, 0.09, 1.08]} />
          <meshStandardMaterial
            color={visuals.capColor}
            emissive={visuals.emissive}
            emissiveIntensity={visuals.intensity}
            toneMapped={false}
            roughness={0.18}
          />
        </mesh>

        {/* Selection ring around base */}
        {isSelected && (
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.22, 0]}>
            <ringGeometry args={[0.76, 0.9, 4]} />
            <meshStandardMaterial
              color="#00F0FF"
              emissive="#00F0FF"
              emissiveIntensity={2.2}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* Value label floating above pedestal */}
        <CanvasLabel
          text={String(slot.value)}
          position={[0, 0.15 + height + 0.56, 0]}
          scale={0.48}
          fontSize={44}
          color={slot.state === 'corrupted' ? '#FF6B8E' : '#F0F9FF'}
          background="rgba(6, 10, 20, 0.88)"
          borderColor={visuals.capColor}
        />
      </group>
    </group>
  );
}

function getPointerColor(name: string): string {
  const lower = name.toLowerCase();
  if (lower === 'l' || lower === 'left' || lower === 'read' || lower === 'i') return '#00F0FF';
  if (lower === 'r' || lower === 'right' || lower === 'write' || lower === 'j') return '#A855F7';
  return '#FFB800';
}

export function ArraysScene3D({ state, interactive, onDirectAction }: ArraysScene3DProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const count = state.slots.length;
  const railWidth = Math.max(4, count * SLOT_SPACING + 1.0);
  const startOffset = ((count - 1) * SLOT_SPACING) / 2;

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
      {/* Contiguous Memory Rail Baseplate */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <boxGeometry args={[railWidth, 0.08, 2.2]} />
        <meshStandardMaterial color="#0A1124" roughness={0.5} metalness={0.6} />
      </mesh>

      {/* Glowing cyan rail trim bars */}
      <mesh position={[0, 0.07, 1.08]}>
        <boxGeometry args={[railWidth, 0.05, 0.06]} />
        <meshStandardMaterial
          color="#00F0FF"
          emissive="#00F0FF"
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.07, -1.08]}>
        <boxGeometry args={[railWidth, 0.05, 0.06]} />
        <meshStandardMaterial
          color="#00F0FF"
          emissive="#00F0FF"
          emissiveIntensity={1.6}
          toneMapped={false}
        />
      </mesh>

      {/* Memory Slot Pedestals */}
      {state.slots.map((slot, idx) => {
        const xPos = idx * SLOT_SPACING - startOffset;
        const norm = (slot.value - minVal) / valSpan;
        const height = slot.value === 0 ? 0.32 : 0.55 + norm * 2.15;
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
              isSelected={selectedIdx === idx}
              isHovered={hoveredIdx === idx}
              inWindow={inWindow}
              interactive={interactive}
              onHover={setHoveredIdx}
              onClick={handleSlotClick}
            />

            {/* Floating Neon Pointer Beacons */}
            {slotPointers &&
              slotPointers.map((ptrName, pIdx) => {
                const ptrColor = getPointerColor(ptrName);
                const yBeacon = 0.15 + height + 1.25 + pIdx * 0.68;
                return (
                  <group key={ptrName} position={[xPos, yBeacon, 0]}>
                    <mesh rotation={[Math.PI, 0, 0]} position={[0, -0.22, 0]}>
                      <coneGeometry args={[0.16, 0.3, 4]} />
                      <meshStandardMaterial
                        color={ptrColor}
                        emissive={ptrColor}
                        emissiveIntensity={2.0}
                        toneMapped={false}
                      />
                    </mesh>
                    <CanvasLabel
                      text={ptrName.toUpperCase()}
                      position={[0, 0.18, 0]}
                      scale={0.36}
                      fontSize={34}
                      color={ptrColor}
                      background="rgba(6, 10, 20, 0.9)"
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
              color="#00F0FF"
              emissive="#00F0FF"
              emissiveIntensity={0.65}
              transparent
              opacity={0.11}
              depthWrite={false}
            />
          </mesh>
          {/* Glowing top/bottom window frame rails */}
          <mesh position={[0, 3.0, 0.78]}>
            <boxGeometry args={[windowVisual.width, 0.06, 0.06]} />
            <meshStandardMaterial
              color="#00F0FF"
              emissive="#00F0FF"
              emissiveIntensity={2.0}
              toneMapped={false}
            />
          </mesh>
          <mesh position={[0, 3.0, -0.78]}>
            <boxGeometry args={[windowVisual.width, 0.06, 0.06]} />
            <meshStandardMaterial
              color="#00F0FF"
              emissive="#00F0FF"
              emissiveIntensity={2.0}
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
                <coneGeometry args={[0.24, 0.42, 4]} />
                <meshStandardMaterial
                  color="#00F0FF"
                  emissive="#00F0FF"
                  emissiveIntensity={2.1}
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
                <coneGeometry args={[0.24, 0.42, 4]} />
                <meshStandardMaterial
                  color="#00F0FF"
                  emissive="#00F0FF"
                  emissiveIntensity={2.1}
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
            color="#A855F7"
            borderColor="#A855F7"
          />
          {state.auxSlots.map((val, i) => {
            const ax = (i - (state.auxSlots!.length - 1) / 2) * 1.3;
            return (
              <group key={i} position={[ax, 0.28, 0]}>
                <mesh castShadow>
                  <boxGeometry args={[0.92, 0.48, 0.92]} />
                  <meshStandardMaterial
                    color="#1E1038"
                    emissive="#A855F7"
                    emissiveIntensity={1.2}
                    toneMapped={false}
                  />
                </mesh>
                <CanvasLabel
                  text={String(val)}
                  position={[0, 0.58, 0]}
                  scale={0.38}
                  fontSize={38}
                  color="#E9D5FF"
                  borderColor="#A855F7"
                />
              </group>
            );
          })}
        </group>
      )}
    </group>
  );
}
