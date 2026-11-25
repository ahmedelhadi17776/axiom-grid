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

function traceRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

/**
 * 100% offline, zero-external-font procedural high-DPI label rendered via CanvasTexture.
 * Uses Sprite by default (billboard=true) so labels stay crisp and legible from any
 * isometric camera angle, or a flat Plane mesh when billboard=false.
 */
export function CanvasLabel({
  text,
  position = [0, 0, 0],
  color = '#F1F5F9',
  background = 'rgba(11, 16, 28, 0.88)',
  borderColor = 'rgba(56, 189, 248, 0.42)',
  scale = 0.65,
  fontSize = 44,
  bold = true,
  rotation,
  billboard = true,
}: CanvasLabelProps) {
  const { texture, aspect } = useMemo(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const dpr = 2;
    const padX = 34;
    const padY = 18;
    const fontWeight = bold ? '700' : '500';
    const fontFamily = '"JetBrains Mono", "Space Grotesk", ui-monospace, SFMono-Regular, monospace';
    const fontStr = `${fontWeight} ${fontSize}px ${fontFamily}`;

    let measuredWidth = fontSize * Math.max(1, text.length * 0.64);
    if (ctx) {
      ctx.font = fontStr;
      measuredWidth = ctx.measureText(text).width;
    }

    const logicalWidth = Math.max(104, Math.ceil(measuredWidth + padX * 2));
    const logicalHeight = Math.max(68, Math.ceil(fontSize + padY * 2));

    canvas.width = logicalWidth * dpr;
    canvas.height = logicalHeight * dpr;

    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, logicalWidth, logicalHeight);

      if (background !== 'transparent') {
        const inset = 2.5;
        const boxW = logicalWidth - inset * 2;
        const boxH = logicalHeight - inset * 2;
        const radius = Math.min(boxH * 0.34, 18);

        // Soft matte slate pill/rounded-rect fill
        traceRoundedRect(ctx, inset, inset, boxW, boxH, radius);
        ctx.fillStyle = background;
        ctx.fill();

        // Subtle top-down inner sheen for crisp studio legibility
        const sheen = ctx.createLinearGradient(0, inset, 0, inset + boxH);
        sheen.addColorStop(0, 'rgba(255, 255, 255, 0.08)');
        sheen.addColorStop(0.45, 'rgba(255, 255, 255, 0.015)');
        sheen.addColorStop(1, 'rgba(0, 0, 0, 0.12)');
        ctx.fillStyle = sheen;
        ctx.fill();

        // Subtle inner top rim highlight
        traceRoundedRect(ctx, inset + 1.5, inset + 1.5, boxW - 3, boxH - 3, Math.max(2, radius - 1.5));
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
        ctx.stroke();

        // Outer semantic accent border
        if (borderColor && borderColor !== 'transparent') {
          traceRoundedRect(ctx, inset, inset, boxW, boxH, radius);
          ctx.lineWidth = 2.5;
          ctx.strokeStyle = borderColor;
          ctx.stroke();
        }
      }

      ctx.font = fontStr;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(4, 8, 18, 0.7)';
      ctx.shadowBlur = 4;
      ctx.shadowOffsetY = 1;
      ctx.fillStyle = color;
      ctx.fillText(text, logicalWidth / 2, logicalHeight / 2 + 1);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = 4;
    tex.generateMipmaps = false;
    tex.needsUpdate = true;

    return { texture: tex, aspect: logicalWidth / logicalHeight };
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
