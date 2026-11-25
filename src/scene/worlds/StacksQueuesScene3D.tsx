import { useMemo, useRef, useState } from 'react';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { PacketItem, PipelineBuffer, StacksQueuesWorldState } from '../../engine/types';
import type { DirectAction } from '../IsometricCanvas';
import { CanvasLabel } from '../CanvasLabel';
import { soundEngine } from '../../audio/soundEngine';

export interface StacksQueuesScene3DProps {
  state: StacksQueuesWorldState;
  interactive: boolean;
  onDirectAction?: (action: DirectAction) => void;
}

type SelectionState = null | { kind: 'input' } | { kind: 'buffer'; bufferId: string };

function PacketCube({
  item,
  position,
  scale = 0.68,
  overrideColor,
}: {
  item: PacketItem;
  position: [number, number, number];
  scale?: number;
  overrideColor?: string;
}) {
  const color = overrideColor ?? item.color ?? '#38BDF8';
  const bodyH = scale * 0.74;

  return (
    <group position={position}>
      {/* Bottom metallic bevel foot */}
      <mesh position={[0, -bodyH * 0.5 - 0.025, 0]} castShadow>
        <boxGeometry args={[scale * 0.94, 0.05, scale * 0.94]} />
        <meshStandardMaterial color="#101829" roughness={0.35} metalness={0.75} />
      </mesh>

      {/* Main metallic packet chassis */}
      <mesh castShadow>
        <boxGeometry args={[scale, bodyH, scale]} />
        <meshStandardMaterial
          color="#142038"
          emissive={color}
          emissiveIntensity={0.32}
          roughness={0.3}
          metalness={0.68}
        />
      </mesh>

      {/* Recessed luminous collar strip */}
      <mesh position={[0, bodyH * 0.5 + 0.024, 0]}>
        <boxGeometry args={[scale * 1.02, 0.048, scale * 1.02]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.25}
          toneMapped={false}
          roughness={0.22}
        />
      </mesh>

      {/* Top metallic bevel cap */}
      <mesh position={[0, bodyH * 0.5 + 0.068, 0]} castShadow>
        <boxGeometry args={[scale * 0.88, 0.04, scale * 0.88]} />
        <meshStandardMaterial color="#1A2946" roughness={0.28} metalness={0.72} />
      </mesh>

      <CanvasLabel
        text={item.value}
        position={[0, scale * 0.74, 0]}
        scale={0.34}
        fontSize={36}
        color="#F8FAFC"
        background="rgba(11, 16, 28, 0.88)"
        borderColor={color}
      />
    </group>
  );
}

interface BufferChamberProps {
  buffer: PipelineBuffer;
  position: [number, number, number];
  isSelected: boolean;
  isIntakeTarget: boolean;
  interactive: boolean;
  onClickBuffer: (bufferId: string) => void;
  onQuickIntake: (bufferId: string) => void;
}

function BufferChamber({
  buffer,
  position,
  isSelected,
  isIntakeTarget,
  interactive,
  onClickBuffer,
  onQuickIntake,
}: BufferChamberProps) {
  const [hovered, setHovered] = useState(false);
  const ruptureRef = useRef<THREE.Mesh | null>(null);

  const ratio = buffer.capacity > 0 ? buffer.items.length / buffer.capacity : 0;
  const pressureColor =
    buffer.overflowed || ratio >= 1
      ? '#FB7185'
      : ratio >= 0.65
        ? '#FBBF24'
        : '#38BDF8';

  const ringColor = isSelected ? '#34D399' : isIntakeTarget || hovered ? '#38BDF8' : pressureColor;

  const capacitySlots = useMemo(
    () => Array.from({ length: Math.max(0, buffer.capacity) }, (_, idx) => idx),
    [buffer.capacity],
  );

  useFrame((clockState) => {
    if (ruptureRef.current && buffer.overflowed) {
      const s = 1 + Math.sin(clockState.clock.elapsedTime * 12) * 0.1;
      ruptureRef.current.scale.set(s, s, 1);
    }
  });

  const handleOver = (e: ThreeEvent<PointerEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
    soundEngine.playHover();
  };

  const handleOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    onClickBuffer(buffer.id);
  };

  if (buffer.kind === 'stack') {
    const cylHeight = Math.max(2.2, buffer.capacity * 0.74 + 0.55);

    return (
      <group position={position}>
        {/* Tiered metallic pedestal base */}
        <mesh
          position={[0, 0.1, 0]}
          receiveShadow
          onPointerOver={handleOver}
          onPointerOut={handleOut}
          onClick={handleClick}
        >
          <cylinderGeometry args={[1.18, 1.32, 0.2, 24]} />
          <meshStandardMaterial color="#131E34" roughness={0.4} metalness={0.7} />
        </mesh>
        <mesh position={[0, 0.23, 0]}>
          <cylinderGeometry args={[1.02, 1.12, 0.08, 24]} />
          <meshStandardMaterial color="#1B2A47" roughness={0.35} metalness={0.72} />
        </mesh>

        {/* Pressure status ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.215, 0]}>
          <ringGeometry args={[1.15, 1.29, 32]} />
          <meshStandardMaterial
            color={ringColor}
            emissive={ringColor}
            emissiveIntensity={isSelected || hovered ? 1.45 : 1.1}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Refined frosted glass containment cylinder */}
        <mesh
          position={[0, 0.24 + cylHeight / 2, 0]}
          onPointerOver={handleOver}
          onPointerOut={handleOut}
          onClick={handleClick}
        >
          <cylinderGeometry args={[0.92, 0.92, cylHeight, 28, 1, true]} />
          <meshStandardMaterial
            color={pressureColor}
            emissive={pressureColor}
            emissiveIntensity={buffer.overflowed ? 0.85 : 0.28}
            roughness={0.14}
            metalness={0.18}
            transparent
            opacity={buffer.overflowed ? 0.26 : 0.13}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Lower & mid metallic collar rings */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.32, 0]}>
          <torusGeometry args={[0.935, 0.032, 10, 32]} />
          <meshStandardMaterial color="#253654" roughness={0.32} metalness={0.78} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.24 + cylHeight * 0.5, 0]}>
          <torusGeometry args={[0.94, 0.022, 10, 32]} />
          <meshStandardMaterial color="#253654" roughness={0.32} metalness={0.78} />
        </mesh>

        {/* Fill / capacity tick marks along the glass cylinder */}
        {capacitySlots.map((slotIdx) => {
          const filled = slotIdx < buffer.items.length;
          const tickY = 0.62 + slotIdx * 0.72;
          return (
            <mesh key={slotIdx} rotation={[Math.PI / 2, 0, 0]} position={[0, tickY, 0]}>
              <torusGeometry args={[0.935, filled ? 0.018 : 0.012, 8, 32]} />
              <meshStandardMaterial
                color={filled ? pressureColor : '#334155'}
                emissive={filled ? pressureColor : '#1E293B'}
                emissiveIntensity={filled ? 1.15 : 0.2}
                toneMapped={false}
                transparent
                opacity={filled ? 0.9 : 0.55}
              />
            </mesh>
          );
        })}

        {/* Top metallic + luminous pressure rim */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.24 + cylHeight, 0]}>
          <torusGeometry args={[0.93, 0.045, 12, 32]} />
          <meshStandardMaterial
            color={pressureColor}
            emissive={pressureColor}
            emissiveIntensity={1.35}
            toneMapped={false}
            roughness={0.25}
          />
        </mesh>

        {/* Overflow rupture flash ring */}
        {buffer.overflowed && (
          <mesh ref={ruptureRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.24 + cylHeight, 0]}>
            <ringGeometry args={[1.05, 1.38, 28]} />
            <meshStandardMaterial
              color="#FB7185"
              emissive="#FB7185"
              emissiveIntensity={1.55}
              toneMapped={false}
              side={THREE.DoubleSide}
            />
          </mesh>
        )}

        {/* Stacked packet cubes bottom -> top */}
        {buffer.items.map((item, i) => (
          <PacketCube
            key={item.id}
            item={item}
            position={[0, 0.62 + i * 0.72, 0]}
            scale={0.68}
          />
        ))}

        {/* Label + Occupancy */}
        <CanvasLabel
          text={`${buffer.label} (${buffer.items.length}/${buffer.capacity})`}
          position={[0, 0.24 + cylHeight + 0.62, 0]}
          scale={0.38}
          fontSize={34}
          color={buffer.overflowed ? '#FDA4AF' : '#E2E8F0'}
          borderColor={ringColor}
        />

        {/* Quick Intake pad */}
        {interactive && (
          <group
            position={[0, 0.1, 1.62]}
            onClick={(e) => {
              e.stopPropagation();
              onQuickIntake(buffer.id);
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
            <mesh>
              <boxGeometry args={[1.18, 0.12, 0.58]} />
              <meshStandardMaterial color="#132238" roughness={0.36} metalness={0.7} />
            </mesh>
            <mesh position={[0, 0.07, 0]}>
              <boxGeometry args={[1.1, 0.03, 0.5]} />
              <meshStandardMaterial
                color="#38BDF8"
                emissive="#38BDF8"
                emissiveIntensity={1.1}
                toneMapped={false}
              />
            </mesh>
            <CanvasLabel
              text="+ PUSH"
              position={[0, 0.36, 0]}
              scale={0.28}
              fontSize={30}
              color="#38BDF8"
              borderColor="#38BDF8"
            />
          </group>
        )}
      </group>
    );
  }

  // Horizontal FIFO Queue Conveyor Channel
  const channelLen = Math.max(2.6, buffer.capacity * 0.92 + 0.6);

  return (
    <group position={position}>
      {/* Layered metallic conveyor base */}
      <mesh
        position={[0, 0.12, 0]}
        receiveShadow
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        <boxGeometry args={[channelLen, 0.2, 1.42]} />
        <meshStandardMaterial color="#131E34" roughness={0.42} metalness={0.68} />
      </mesh>
      <mesh position={[0, 0.23, 0]}>
        <boxGeometry args={[channelLen - 0.16, 0.03, 1.18]} />
        <meshStandardMaterial color="#0D1526" roughness={0.6} metalness={0.45} />
      </mesh>

      {/* Capacity slot tick marks on the conveyor bed */}
      {capacitySlots.map((slotIdx) => {
        const filled = slotIdx < buffer.items.length;
        const xOff = channelLen / 2 - 0.55 - slotIdx * 0.86;
        return (
          <mesh key={slotIdx} position={[xOff, 0.25, 0]}>
            <boxGeometry args={[0.68, 0.015, 0.96]} />
            <meshStandardMaterial
              color={filled ? pressureColor : '#1E293B'}
              emissive={filled ? pressureColor : '#1E293B'}
              emissiveIntensity={filled ? 0.55 : 0.12}
              transparent
              opacity={filled ? 0.35 : 0.45}
            />
          </mesh>
        );
      })}

      {/* Metallic side guard rails + luminous strips */}
      <mesh position={[0, 0.26, 0.69]}>
        <boxGeometry args={[channelLen, 0.1, 0.09]} />
        <meshStandardMaterial color="#1E2D49" roughness={0.35} metalness={0.75} />
      </mesh>
      <mesh position={[0, 0.32, 0.69]}>
        <boxGeometry args={[channelLen - 0.06, 0.035, 0.045]} />
        <meshStandardMaterial
          color={ringColor}
          emissive={ringColor}
          emissiveIntensity={1.25}
          toneMapped={false}
        />
      </mesh>

      <mesh position={[0, 0.26, -0.69]}>
        <boxGeometry args={[channelLen, 0.1, 0.09]} />
        <meshStandardMaterial color="#1E2D49" roughness={0.35} metalness={0.75} />
      </mesh>
      <mesh position={[0, 0.32, -0.69]}>
        <boxGeometry args={[channelLen - 0.06, 0.035, 0.045]} />
        <meshStandardMaterial
          color={ringColor}
          emissive={ringColor}
          emissiveIntensity={1.25}
          toneMapped={false}
        />
      </mesh>

      {/* Queue items laid out back (left) -> front (right) */}
      {buffer.items.map((item, i) => {
        const xOff = channelLen / 2 - 0.55 - i * 0.86;
        return (
          <PacketCube
            key={item.id}
            item={item}
            position={[xOff, 0.62, 0]}
            scale={0.64}
          />
        );
      })}

      {/* Label + Occupancy */}
      <CanvasLabel
        text={`${buffer.label} (${buffer.items.length}/${buffer.capacity})`}
        position={[0, 1.55, 0]}
        scale={0.38}
        fontSize={34}
        color="#E2E8F0"
        borderColor={ringColor}
      />

      {/* Quick Enqueue pad */}
      {interactive && (
        <group
          position={[0, 0.1, 1.15]}
          onClick={(e) => {
            e.stopPropagation();
            onQuickIntake(buffer.id);
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
          <mesh>
            <boxGeometry args={[1.28, 0.12, 0.54]} />
            <meshStandardMaterial color="#1D1B38" roughness={0.36} metalness={0.7} />
          </mesh>
          <mesh position={[0, 0.07, 0]}>
            <boxGeometry args={[1.2, 0.03, 0.46]} />
            <meshStandardMaterial
              color="#A78BFA"
              emissive="#A78BFA"
              emissiveIntensity={1.1}
              toneMapped={false}
            />
          </mesh>
          <CanvasLabel
            text="+ ENQ"
            position={[0, 0.36, 0]}
            scale={0.28}
            fontSize={30}
            color="#DDD6FE"
            borderColor="#A78BFA"
          />
        </group>
      )}
    </group>
  );
}

export function StacksQueuesScene3D({
  state,
  interactive,
  onDirectAction,
}: StacksQueuesScene3DProps) {
  const [selection, setSelection] = useState<SelectionState>(null);
  const [inputHovered, setInputHovered] = useState(false);
  const [outputHovered, setOutputHovered] = useState(false);

  const bufferList = useMemo(() => Object.values(state.buffers), [state.buffers]);

  const handleInputClick = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive) return;
    e.stopPropagation();
    if (selection?.kind === 'input') {
      setSelection(null);
      soundEngine.playHover();
      return;
    }
    setSelection({ kind: 'input' });
    soundEngine.playSelect();
  };

  const handleBufferClick = (bufferId: string) => {
    if (!interactive) return;

    if (selection?.kind === 'input') {
      setSelection(null);
      soundEngine.playSelect();
      onDirectAction?.({
        world: 'stacks-queues',
        type: 'INTAKE',
        payload: { bufferId },
      });
      return;
    }

    if (selection?.kind === 'buffer') {
      if (selection.bufferId === bufferId) {
        setSelection(null);
        soundEngine.playHover();
        return;
      }
      const fromId = selection.bufferId;
      setSelection(null);
      soundEngine.playSelect();
      onDirectAction?.({
        world: 'stacks-queues',
        type: 'TRANSFER',
        payload: { fromId, toId: bufferId },
      });
      return;
    }

    setSelection({ kind: 'buffer', bufferId });
    soundEngine.playSelect();
  };

  const handleQuickIntake = (bufferId: string) => {
    if (!interactive) return;
    setSelection(null);
    soundEngine.playSelect();
    onDirectAction?.({
      world: 'stacks-queues',
      type: 'INTAKE',
      payload: { bufferId },
    });
  };

  const handleOutputClick = (e: ThreeEvent<MouseEvent>) => {
    if (!interactive) return;
    e.stopPropagation();

    let sourceBufferId: string | null = null;
    if (selection?.kind === 'buffer') {
      sourceBufferId = selection.bufferId;
    } else if (bufferList.length === 1) {
      sourceBufferId = bufferList[0].id;
    }

    if (!sourceBufferId) return;
    setSelection(null);
    soundEngine.playSelect();
    onDirectAction?.({
      world: 'stacks-queues',
      type: 'EMIT',
      payload: { bufferId: sourceBufferId },
    });
  };

  const visibleInput = state.inputStream.slice(0, 6);

  return (
    <group>
      {/* LEFT: Input Stream Conveyor Rail */}
      <group
        position={[-5.6, 0, 0]}
        onClick={handleInputClick}
        onPointerOver={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          setInputHovered(true);
          document.body.style.cursor = 'pointer';
          soundEngine.playHover();
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setInputHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        {/* Deck chassis + recessed lane track */}
        <mesh position={[0, 0.1, 0]} receiveShadow>
          <boxGeometry args={[2.16, 0.18, 6.46]} />
          <meshStandardMaterial color="#121C30" roughness={0.46} metalness={0.65} />
        </mesh>
        <mesh position={[0, 0.195, 0]}>
          <boxGeometry args={[1.68, 0.02, 6.1]} />
          <meshStandardMaterial color="#0C1322" roughness={0.62} metalness={0.4} />
        </mesh>

        {/* Outer metallic guard rail */}
        <mesh position={[-1.04, 0.22, 0]}>
          <boxGeometry args={[0.09, 0.09, 6.46]} />
          <meshStandardMaterial color="#1E2D49" roughness={0.35} metalness={0.75} />
        </mesh>

        {/* Inner luminous intake rail */}
        <mesh position={[1.04, 0.22, 0]}>
          <boxGeometry args={[0.08, 0.07, 6.46]} />
          <meshStandardMaterial
            color="#38BDF8"
            emissive="#38BDF8"
            emissiveIntensity={selection?.kind === 'input' || inputHovered ? 1.5 : 1.05}
            toneMapped={false}
          />
        </mesh>

        <CanvasLabel
          text={`INPUT (${state.inputStream.length})`}
          position={[0, 1.55, -2.9]}
          scale={0.4}
          fontSize={36}
          color="#38BDF8"
          borderColor={selection?.kind === 'input' ? '#34D399' : '#38BDF8'}
        />

        {visibleInput.map((item, idx) => (
          <PacketCube
            key={item.id}
            item={item}
            position={[0, 0.54, 2.2 - idx * 0.92]}
            scale={idx === 0 ? 0.72 : 0.6}
          />
        ))}
      </group>

      {/* CENTER: Stacks & Queues Buffers */}
      {bufferList.map((buf, idx) => {
        const count = bufferList.length;
        const spreadZ = count > 1 ? 3.8 : 0;
        const zPos = count > 1 ? (idx - (count - 1) / 2) * spreadZ : 0;
        return (
          <BufferChamber
            key={buf.id}
            buffer={buf}
            position={[0, 0, zPos]}
            isSelected={selection?.kind === 'buffer' && selection.bufferId === buf.id}
            isIntakeTarget={selection?.kind === 'input'}
            interactive={interactive}
            onClickBuffer={handleBufferClick}
            onQuickIntake={handleQuickIntake}
          />
        );
      })}

      {/* RIGHT: Output Manifest Target Dock */}
      <group
        position={[5.6, 0, 0]}
        onClick={handleOutputClick}
        onPointerOver={(e) => {
          if (!interactive) return;
          e.stopPropagation();
          setOutputHovered(true);
          document.body.style.cursor = 'pointer';
          soundEngine.playHover();
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setOutputHovered(false);
          document.body.style.cursor = 'auto';
        }}
      >
        {/* Deck chassis + recessed lane track */}
        <mesh position={[0, 0.1, 0]} receiveShadow>
          <boxGeometry args={[2.24, 0.18, 6.46]} />
          <meshStandardMaterial color="#121C30" roughness={0.46} metalness={0.65} />
        </mesh>
        <mesh position={[0, 0.195, 0]}>
          <boxGeometry args={[1.76, 0.02, 6.1]} />
          <meshStandardMaterial color="#0C1322" roughness={0.62} metalness={0.4} />
        </mesh>

        {/* Outer metallic guard rail */}
        <mesh position={[1.08, 0.22, 0]}>
          <boxGeometry args={[0.09, 0.09, 6.46]} />
          <meshStandardMaterial color="#1E2D49" roughness={0.35} metalness={0.75} />
        </mesh>

        {/* Inner luminous output rail */}
        <mesh position={[-1.08, 0.22, 0]}>
          <boxGeometry args={[0.08, 0.07, 6.46]} />
          <meshStandardMaterial
            color="#34D399"
            emissive="#34D399"
            emissiveIntensity={outputHovered || selection?.kind === 'buffer' ? 1.5 : 1.05}
            toneMapped={false}
          />
        </mesh>

        <CanvasLabel
          text={`OUTPUT (${state.outputEmitted.length}/${state.targetManifest.length})`}
          position={[0, 1.55, -2.9]}
          scale={0.4}
          fontSize={36}
          color="#34D399"
          borderColor="#34D399"
        />

        {state.targetManifest.slice(0, 6).map((expectedVal, idx) => {
          const emitted = state.outputEmitted[idx];
          const zSlot = 2.2 - idx * 0.92;

          if (emitted) {
            const matched = emitted.value === expectedVal;
            return (
              <PacketCube
                key={emitted.id}
                item={emitted}
                position={[0, 0.54, zSlot]}
                scale={0.64}
                overrideColor={matched ? '#34D399' : '#FB7185'}
              />
            );
          }

          return (
            <group key={`target-${idx}`} position={[0, 0.5, zSlot]}>
              <mesh>
                <boxGeometry args={[0.62, 0.5, 0.62]} />
                <meshStandardMaterial
                  color="#34D399"
                  emissive="#34D399"
                  emissiveIntensity={0.48}
                  wireframe
                  transparent
                  opacity={0.42}
                />
              </mesh>
              <CanvasLabel
                text={expectedVal}
                position={[0, 0.54, 0]}
                scale={0.3}
                fontSize={32}
                color="#6EE7B7"
                background="rgba(11, 24, 24, 0.78)"
                borderColor="rgba(52, 211, 153, 0.45)"
              />
            </group>
          );
        })}
      </group>
    </group>
  );
}
