import { Grid } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

export interface NeonEnvironmentProps {
  graphicsQuality: 'high' | 'eco';
}

export function NeonEnvironment({ graphicsQuality }: NeonEnvironmentProps) {
  return (
    <>
      <color attach="background" args={['#0B101C']} />
      <fog attach="fog" args={['#0B101C', 40, 90]} />

      {/* Warm-cool 3-point studio lighting: soft sky-blue ambient + warm-white key + gentle cyan/violet rims */}
      <ambientLight intensity={0.5} color="#93B4E2" />
      <hemisphereLight args={['#7AA2D8', '#0B101C', 0.42]} />

      <directionalLight
        position={[14, 24, 14]}
        intensity={1.15}
        color="#FFF5E6"
        castShadow={graphicsQuality === 'high'}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-camera-left={-18}
        shadow-camera-right={18}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-bias={-0.0005}
      />

      {/* Gentle sky-cyan & soft lavender-violet rim lights (no blinding hotspots) */}
      <pointLight position={[-15, 11, -11]} intensity={10} distance={48} decay={1.7} color="#38BDF8" />
      <pointLight position={[15, 10, -14]} intensity={9} distance={48} decay={1.7} color="#A78BFA" />
      <pointLight position={[0, 8, 16]} intensity={5.5} distance={42} decay={1.8} color="#64748B" />

      {/* Deep Midnight Slate studio floor plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#0B101C" roughness={0.88} metalness={0.18} />
      </mesh>

      {/* Architectural concentric circuit rings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.028, 0]}>
        <ringGeometry args={[6.35, 6.46, 64]} />
        <meshBasicMaterial color="#1E2D45" transparent opacity={0.38} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.026, 0]}>
        <ringGeometry args={[10.8, 10.96, 72]} />
        <meshBasicMaterial color="#273754" transparent opacity={0.44} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.027, 0]}>
        <ringGeometry args={[15.55, 15.67, 80]} />
        <meshBasicMaterial color="#1B263B" transparent opacity={0.32} />
      </mesh>

      {/* Calmer illuminated isometric circuit grid */}
      <Grid
        position={[0, -0.015, 0]}
        args={[80, 80]}
        cellSize={1}
        cellThickness={0.55}
        cellColor="#1B263B"
        sectionSize={4}
        sectionThickness={1.05}
        sectionColor="#273754"
        fadeDistance={46}
        fadeStrength={1.5}
        infiniteGrid
      />

      {/* Refined velvety Bloom ONLY in High quality mode; Eco mode skips post-processing */}
      {graphicsQuality === 'high' && (
        <EffectComposer multisampling={0}>
          <Bloom
            mipmapBlur
            luminanceThreshold={1.18}
            luminanceSmoothing={0.28}
            intensity={0.42}
          />
        </EffectComposer>
      )}
    </>
  );
}
