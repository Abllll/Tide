import { useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";

interface WaterSceneProps {
  fillFraction: number;
  tone: "healthy" | "low";
  variant: "intro" | "panel";
}

const TONE_COLORS: Record<"healthy" | "low", { shallow: string; deep: string }> = {
  healthy: { shallow: "#5fd4c8", deep: "#0f6f6a" },
  low: { shallow: "#f2a08a", deep: "#c04a34" },
};

const WAVE_LAYERS = [
  { amp: 0.05, speed: 1.6, freq: 2.4, phase: 0 },
  { amp: 0.03, speed: 2.3, freq: 3.7, phase: 2 },
  { amp: 0.018, speed: 3.1, freq: 5.1, phase: 4 },
];

const PLANE_SEGMENTS = 40;

function displaceWater(geometry: THREE.PlaneGeometry, t: number, amplitude: number) {
  const position = geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const y = position.getY(i);
    let z = 0;
    for (const layer of WAVE_LAYERS) {
      z += Math.sin(x * layer.freq + t * layer.speed + layer.phase) * layer.amp;
      z += Math.cos(y * layer.freq * 0.8 + t * layer.speed * 0.9 + layer.phase) * layer.amp * 0.6;
    }
    position.setZ(i, z * amplitude);
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
}

export function WaterScene({ fillFraction, tone, variant }: WaterSceneProps) {
  const colors = TONE_COLORS[tone];
  const isIntro = variant === "intro";
  const { gl } = useThree();

  const planeWidth = isIntro ? 16 : 1.6;
  const planeDepth = isIntro ? 10 : 1.1;
  const tankHeight = isIntro ? 8 : 1.2;
  const waveAmplitude = isIntro ? 1 : 0.35;

  const waterGeometry = useMemo(
    () => new THREE.PlaneGeometry(planeWidth, planeDepth, PLANE_SEGMENTS, PLANE_SEGMENTS),
    [planeWidth, planeDepth]
  );

  // Reveals left-to-right for the intro instead of translating the mesh,
  // so the wave geometry itself never moves/distorts during the wipe.
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), []);

  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);

  useFrame((state) => {
    displaceWater(waterGeometry, state.clock.elapsedTime, waveAmplitude);

    if (isIntro) {
      const halfWidth = planeWidth / 2;
      clipPlane.constant = -halfWidth + planeWidth * Math.max(fillFraction, 0.02);
    }
  });

  const waterLevelY = isIntro
    ? -0.5
    : -tankHeight / 2 + tankHeight * Math.max(fillFraction, 0.02);

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={isIntro ? [0, 3.5, 9] : [0, 1.1, 3.2]}
        fov={isIntro ? 55 : 40}
      />
      <directionalLight position={[3, 5, 4]} intensity={2.2} color="#fff7ec" />
      <ambientLight intensity={0.4} color="#bfe9e4" />

      <mesh
        geometry={waterGeometry}
        position={[0, waterLevelY, 0]}
        rotation={[-Math.PI / 2.3, 0, 0]}
      >
        <meshPhysicalMaterial
          color={colors.deep}
          sheenColor={colors.shallow}
          sheen={1}
          roughness={0.15}
          metalness={0}
          transmission={0.5}
          thickness={0.6}
          ior={1.33}
          clearcoat={1}
          clearcoatRoughness={0.1}
          clippingPlanes={isIntro ? [clipPlane] : []}
        />
      </mesh>

      {!isIntro && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[planeWidth + 0.15, tankHeight + 0.15, planeDepth + 0.15]} />
          <meshPhysicalMaterial
            color="#eaf7f5"
            transparent
            opacity={0.12}
            roughness={0.05}
            transmission={0.85}
            ior={1.5}
            depthWrite={false}
          />
        </mesh>
      )}
    </>
  );
}
