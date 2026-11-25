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
  const color = overrideColor ?? item.color ?? '#00F0FF';
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[scale, scale * 0.82, scale]} />
        <meshStandardMaterial
          color="#0F1B33"
          emissive={color}
          emissiveIntensity={0.75}
          roughness={0.28}
          metalness={0.55}
        />
      </mesh>
      <mesh position={[0, scale * 0.42, 0]}>
        <boxGeometry args={[scale * 1.02, 0.06, scale * 1.02]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.9}
          toneMapped={false}
        />
      </mesh>
      <CanvasLabel
        text={item.value}
        position={[0, scale * 0.72, 0]}
        scale={0.34}
        fontSize={36}
        color="#F8FAFC"
        background="rgba(6, 10, 20, 0.86)"
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
      ? '#FF2A5F'
      : ratio >= 0.65
        ? '#FFB800'
        : '#00F0FF';

  const ringColor = isSelected ? '#00FF9D' : isIntakeTarget || hovered ? '#00F0FF' : pressureColor;

  useFrame((clockState) => {
    if (ruptureRef.current && buffer.overflowed) {
      const s = 1 + Math.sin(clockState.clock.elapsedTime * 14) * 0.12;
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
        {/* Generous clickable pedestal & translucent vertical LIFO cylinder */}
        <mesh
          position={[0, 0.12, 0]}
          onPointerOver={handleOver}
          onPointerOut={handleOut}
          onClick={handleClick}
        >
          <cylinderGeometry args={[1.18, 1.28, 0.24, 24]} />
          <meshStandardMaterial color="#0D162B" roughness={0.45} metalness={0.65} />
        </mesh>

        {/* Pressure ring */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.26, 0]}>
          <ringGeometry args={[1.15, 1.32, 32]} />
          <meshStandardMaterial
            color={ringColor}
            emissive={ringColor}
            emissiveIntensity={isSelected || hovered ? 2.2 : 1.5}
            toneMapped={false}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Translucent glass cylinder */}
        <mesh
          position={[0, 0.24 + cylHeight / 2, 0]}
          onPointerOver={handleOver}
          onPointerOut={handleOut}
          onClick={handleClick}
        >
          <cylinderGeometry args={[0.92, 0.92, cylHeight, 24, 1, true]} />
          <meshStandardMaterial
            color={pressureColor}
            emissive={pressureColor}
            emissiveIntensity={buffer.overflowed ? 1.4 : 0.45}
            transparent
            opacity={buffer.overflowed ? 0.34 : 0.16}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>

        {/* Top pressure rim */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.24 + cylHeight, 0]}>
          <torusGeometry args={[0.92, 0.045, 10, 32]} />
          <meshStandardMaterial
            color={pressureColor}
            emissive={pressureColor}
            emissiveIntensity={2.0}
            toneMapped={false}
          />
        </mesh>

        {/* Overflow rupture flash ring */}
        {buffer.overflowed && (
          <mesh ref={ruptureRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.24 + cylHeight, 0]}>
            <ringGeometry args={[1.05, 1.45, 24]} />
            <meshStandardMaterial
              color="#FF2A5F"
              emissive="#FF2A5F"
              emissiveIntensity={2.5}
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
          color={buffer.overflowed ? '#FF6B8E' : '#E2E8F0'}
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
              <boxGeometry args={[1.15, 0.14, 0.56]} />
              <meshStandardMaterial
                color="#0A2538"
                emissive="#00F0FF"
                emissiveIntensity={1.3}
                toneMapped={false}
              />
            </mesh>
            <CanvasLabel
              text="+ PUSH"
              position={[0, 0.34, 0]}
              scale={0.28}
              fontSize={30}
              color="#00F0FF"
              borderColor="#00F0FF"
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
      {/* Conveyor base */}
      <mesh
        position={[0, 0.14, 0]}
        onPointerOver={handleOver}
        onPointerOut={handleOut}
        onClick={handleClick}
      >
        <boxGeometry args={[channelLen, 0.24, 1.38]} />
        <meshStandardMaterial color="#0D162B" roughness={0.45} metalness={0.65} />
      </mesh>

      {/* Side neon rails */}
      <mesh position={[0, 0.3, 0.68]}>
        <boxGeometry args={[channelLen, 0.08, 0.06]} />
        <meshStandardMaterial
          color={ringColor}
          emissive={ringColor}
          emissiveIntensity={1.8}
          toneMapped={false}
        />
      </mesh>
      <mesh position={[0, 0.3, -0.68]}>
        <boxGeometry args={[channelLen, 0.08, 0.06]} />
        <meshStandardMaterial
          color={ringColor}
          emissive={ringColor}
          emissiveIntensity={1.8}
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
            <boxGeometry args={[1.25, 0.14, 0.52]} />
            <meshStandardMaterial
              color="#0A2538"
              emissive="#A855F7"
              emissiveIntensity={1.3}
              toneMapped={false}
            />
          </mesh>
          <CanvasLabel
            text="+ ENQ"
            position={[0, 0.34, 0]}
            scale={0.28}
            fontSize={30}
            color="#E9D5FF"
            borderColor="#A855F7"
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
        <mesh position={[0, 0.1, 0]} receiveShadow>
          <boxGeometry args={[2.1, 0.18, 6.4]} />
          <meshStandardMaterial color="#0A1326" roughness={0.5} metalness={0.6} />
        </mesh>
        <mesh position={[1.04, 0.22, 0]}>
          <boxGeometry args={[0.07, 0.06, 6.4]} />
          <meshStandardMaterial
            color="#00F0FF"
            emissive="#00F0FF"
            emissiveIntensity={selection?.kind === 'input' || inputHovered ? 2.4 : 1.3}
            toneMapped={false}
          />
        </mesh>
        <CanvasLabel
          text={`INPUT (${state.inputStream.length})`}
          position={[0, 1.55, -2.9]}
          scale={0.4}
          fontSize={36}
          color="#00F0FF"
          borderColor={selection?.kind === 'input' ? '#00FF9D' : '#00F0FF'}
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
        <mesh position={[0, 0.1, 0]} receiveShadow>
          <boxGeometry args={[2.2, 0.18, 6.4]} />
          <meshStandardMaterial color="#0A1326" roughness={0.5} metalness={0.6} />
        </mesh>
        <mesh position={[-1.08, 0.22, 0]}>
          <boxGeometry args={[0.07, 0.06, 6.4]} />
          <meshStandardMaterial
            color="#00FF9D"
            emissive="#00FF9D"
            emissiveIntensity={outputHovered || selection?.kind === 'buffer' ? 2.3 : 1.3}
            toneMapped={false}
          />
        </mesh>
        <CanvasLabel
          text={`OUTPUT (${state.outputEmitted.length}/${state.targetManifest.length})`}
          position={[0, 1.55, -2.9]}
          scale={0.4}
          fontSize={36}
          color="#00FF9D"
          borderColor="#00FF9D"
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
                overrideColor={matched ? '#00FF9D' : '#FF2A5F'}
              />
            );
          }

          return (
            <group key={`target-${idx}`} position={[0, 0.5, zSlot]}>
              <mesh>
                <boxGeometry args={[0.62, 0.5, 0.62]} />
                <meshStandardMaterial
                  color="#00FF9D"
                  emissive="#00FF9D"
                  emissiveIntensity={0.6}
                  wireframe
                  transparent
                  opacity={0.45}
                />
              </mesh>
              <CanvasLabel
                text={expectedVal}
                position={[0, 0.54, 0]}
                scale={0.3}
                fontSize={32}
                color="#6EE7B7"
                background="rgba(4, 24, 18, 0.72)"
                borderColor="rgba(0, 255, 157, 0.45)"
              />
            </group>
          );
        })}
      </group>
    </group>
  );
}
