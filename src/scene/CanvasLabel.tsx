import { useEffect, useMemo } from 'react';
import * as THREE from 'three';

export interface CanvasLabelProps {
  text: string;
  position?: [number, number, number];
  color?: string;
  background?: string;
  borderColor?: string;
  scale?: number;
  fontSize?: number;
  bold?: boolean;
  rotation?: [number, number, number];
  billboard?: boolean;
}

/**
 * 100% offline, zero-external-font procedural high-DPI label rendered via CanvasTexture.
 * Uses Sprite by default (billboard=true) so labels stay crisp and legible from any
 * isometric camera angle, or a flat Plane mesh when billboard=false.
 */
export function CanvasLabel({
  text,
  position = [0, 0, 0],
  color = '#E6F4FF',
  background = 'rgba(6, 10, 20, 0.82)',
  borderColor = 'rgba(0, 240, 255, 0.45)',
  scale = 0.65,
  fontSize = 44,
  bold = true,
  rotation,
  billboard = true,
}: CanvasLabelProps) {
  const { texture, aspect } = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const padX = 28;
    const padY = 16;
    const fontWeight = bold ? '700' : '500';
    const fontFamily = '"JetBrains Mono", "Space Grotesk", ui-monospace, SFMono-Regular, monospace';
    const fontStr = `${fontWeight} ${fontSize}px ${fontFamily}`;

    let measuredWidth = fontSize * Math.max(1, text.length * 0.65);
    if (ctx) {
      ctx.font = fontStr;
      measuredWidth = ctx.measureText(text).width;
    }

    const width = Math.max(96, Math.ceil(measuredWidth + padX * 2));
    const height = Math.max(64, Math.ceil(fontSize + padY * 2));

    canvas.width = width;
    canvas.height = height;

    if (ctx) {
      ctx.clearRect(0, 0, width, height);

      if (background !== 'transparent') {
        const r = 14;
        ctx.beginPath();
        ctx.moveTo(r, 2);
        ctx.lineTo(width - r, 2);
        ctx.quadraticCurveTo(width - 2, 2, width - 2, r);
        ctx.lineTo(width - 2, height - r);
        ctx.quadraticCurveTo(width - 2, height - 2, width - r, height - 2);
        ctx.lineTo(r, height - 2);
        ctx.quadraticCurveTo(2, height - 2, 2, height - r);
        ctx.lineTo(2, r);
        ctx.quadraticCurveTo(2, 2, r, 2);
        ctx.closePath();

        ctx.fillStyle = background;
        ctx.fill();

        if (borderColor && borderColor !== 'transparent') {
          ctx.lineWidth = 3;
          ctx.strokeStyle = borderColor;
          ctx.stroke();
        }
      }

      ctx.font = fontStr;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.fillText(text, width / 2, height / 2 + 1);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;

    return { texture: tex, aspect: width / height };
  }, [text, color, background, borderColor, fontSize, bold]);

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  const widthWorld = scale * aspect;
  const heightWorld = scale;

  if (billboard) {
    return (
      <sprite position={position} scale={[widthWorld, heightWorld, 1]} renderOrder={10}>
        <spriteMaterial
          map={texture}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </sprite>
    );
  }

  return (
    <mesh position={position} rotation={rotation ?? [-Math.PI / 2, 0, 0]} renderOrder={5}>
      <planeGeometry args={[widthWorld, heightWorld]} />
      <meshBasicMaterial
        map={texture}
        transparent
        depthWrite={false}
        toneMapped={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
