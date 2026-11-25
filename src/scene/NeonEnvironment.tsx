import { Grid } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

export interface NeonEnvironmentProps {
  graphicsQuality: 'high' | 'eco';
}

export function NeonEnvironment({ graphicsQuality }: NeonEnvironmentProps) {
  return (
    <>
      <color attach="background" args={['#06080F']} />
      <fog attach="fog" args={['#06080F', 38, 86]} />

      {/* Soft ambient + key directional + cyan/violet rim lights */}
      <ambientLight intensity={0.45} color="#8BA6D9" />
      <hemisphereLight args={['#4A73B8', '#06080F', 0.35]} />

      <directionalLight
        position={[14, 24, 14]}
        intensity={1.15}
        color="#DCEEFF"
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

      <pointLight position={[-14, 10, -10]} intensity={20} distance={48} decay={1.6} color="#00F0FF" />
      <pointLight position={[14, 9, -14]} intensity={16} distance={48} decay={1.6} color="#A855F7" />
      <pointLight position={[0, 7, 15]} intensity={10} distance={40} decay={1.8} color="#1E3A8A" />

      {/* Deep obsidian floor plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]} receiveShadow>
        <planeGeometry args={[120, 120]} />
        <meshStandardMaterial color="#06080F" roughness={0.86} metalness={0.22} />
      </mesh>

      {/* Subtle central radial circuit ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.025, 0]}>
        <ringGeometry args={[10.8, 11.0, 64]} />
        <meshBasicMaterial color="#182848" transparent opacity={0.45} />
      </mesh>

      {/* Illuminated isometric circuit grid */}
      <Grid
        position={[0, -0.015, 0]}
        args={[80, 80]}
        cellSize={1}
        cellThickness={0.6}
        cellColor="#162038"
        sectionSize={4}
        sectionThickness={1.15}
        sectionColor="#1E2E52"
        fadeDistance={44}
        fadeStrength={1.6}
        infiniteGrid
      />

      {/* Selective Bloom ONLY in High quality mode; Eco mode skips post-processing */}
      {graphicsQuality === 'high' && (
        <EffectComposer multisampling={0}>
          <Bloom
            mipmapBlur
            luminanceThreshold={1.0}
            luminanceSmoothing={0.22}
            intensity={0.85}
          />
        </EffectComposer>
      )}
    </>
  );
}
