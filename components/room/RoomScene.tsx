"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import * as THREE from "three";
import styles from "@/components/room/room.module.css";

export type RoomInteractionState = {
  dragging: boolean;
  targetPitch: number;
  targetYaw: number;
  currentPitch: number;
  currentYaw: number;
  releasePitchVelocity: number;
  releaseYawVelocity: number;
  releaseVersion: number;
};

type RoomSceneProps = {
  interactionRef: MutableRefObject<RoomInteractionState>;
  reducedMotion: boolean;
};

type Vector3Tuple = [number, number, number];

type BoxProps = {
  size: Vector3Tuple;
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  color: string;
  roughness?: number;
  metalness?: number;
  emissive?: string;
  emissiveIntensity?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
};

const palette = {
  black: "#07090c",
  charcoal: "#11151b",
  graphite: "#1b2028",
  steel: "#252b34",
  wall: "#141922",
  wallSide: "#10151d",
  floorDark: "#17130f",
  floorLight: "#241b14",
  walnut: "#3a271c",
  walnutLight: "#5a3927",
  fabric: "#252b35",
  linen: "#b7afa1",
  cream: "#d3cec4",
  cobalt: "#5fc2ff",
  cobaltDeep: "#173d5c",
  amber: "#d48b45",
  rubber: "#0b0d10",
};

function Box({
  size,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  color,
  roughness = 0.72,
  metalness = 0,
  emissive = "#000000",
  emissiveIntensity = 0,
  castShadow = true,
  receiveShadow = true,
}: BoxProps) {
  return (
    <mesh
      position={position}
      rotation={rotation}
      castShadow={castShadow}
      receiveShadow={receiveShadow}
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

type CylinderProps = {
  radius?: number;
  radiusTop?: number;
  radiusBottom?: number;
  height: number;
  position?: Vector3Tuple;
  rotation?: Vector3Tuple;
  color: string;
  roughness?: number;
  metalness?: number;
  segments?: number;
  emissive?: string;
  emissiveIntensity?: number;
};

function Cylinder({
  radius = 0.1,
  radiusTop,
  radiusBottom,
  height,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  color,
  roughness = 0.62,
  metalness = 0.15,
  segments = 18,
  emissive = "#000000",
  emissiveIntensity = 0,
}: CylinderProps) {
  return (
    <mesh position={position} rotation={rotation} castShadow receiveShadow>
      <cylinderGeometry
        args={[
          radiusTop ?? radius,
          radiusBottom ?? radius,
          height,
          segments,
        ]}
      />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

type BeamProps = {
  start: Vector3Tuple;
  end: Vector3Tuple;
  radius: number;
  color: string;
  metalness?: number;
  roughness?: number;
  emissive?: string;
  emissiveIntensity?: number;
};

function Beam({
  start,
  end,
  radius,
  color,
  metalness = 0.35,
  roughness = 0.48,
  emissive = "#000000",
  emissiveIntensity = 0,
}: BeamProps) {
  const geometry = useMemo(() => {
    const startVector = new THREE.Vector3(...start);
    const endVector = new THREE.Vector3(...end);
    const direction = endVector.clone().sub(startVector);
    const midpoint = startVector.clone().add(endVector).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.clone().normalize(),
    );

    return {
      midpoint,
      quaternion,
      length: direction.length(),
    };
  }, [end, start]);

  return (
    <mesh
      position={geometry.midpoint}
      quaternion={geometry.quaternion}
      castShadow
      receiveShadow
    >
      <cylinderGeometry args={[radius, radius, geometry.length, 12]} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        emissive={emissive}
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  );
}

function useScreenTexture(kind: "desktop" | "laptop") {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = kind === "desktop" ? 960 : 640;
    canvas.height = kind === "desktop" ? 540 : 420;
    const context = canvas.getContext("2d");

    if (!context) {
      return new THREE.CanvasTexture(canvas);
    }

    const gradient = context.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, kind === "desktop" ? "#071421" : "#0d1620");
    gradient.addColorStop(0.56, kind === "desktop" ? "#0b3049" : "#17324a");
    gradient.addColorStop(1, kind === "desktop" ? "#163f55" : "#664a3d");
    context.fillStyle = gradient;
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (kind === "desktop") {
      context.fillStyle = "rgba(4, 9, 15, 0.78)";
      context.roundRect(42, 38, 876, 464, 22);
      context.fill();
      context.fillStyle = "rgba(85, 190, 255, 0.14)";
      context.fillRect(42, 38, 104, 464);

      for (let index = 0; index < 7; index += 1) {
        context.fillStyle = index === 2 ? "#63c9ff" : "rgba(208, 231, 242, 0.24)";
        context.fillRect(178, 98 + index * 47, 210 + ((index * 73) % 360), 9);
        context.fillStyle = "rgba(128, 164, 182, 0.16)";
        context.fillRect(178, 116 + index * 47, 120 + ((index * 41) % 210), 6);
      }

      context.strokeStyle = "rgba(100, 207, 255, 0.74)";
      context.lineWidth = 6;
      context.beginPath();
      context.moveTo(653, 405);
      context.bezierCurveTo(708, 276, 764, 310, 836, 154);
      context.stroke();
      context.fillStyle = "rgba(96, 203, 255, 0.9)";
      context.beginPath();
      context.arc(837, 153, 10, 0, Math.PI * 2);
      context.fill();
    } else {
      context.strokeStyle = "rgba(148, 217, 255, 0.5)";
      context.lineWidth = 34;
      context.beginPath();
      context.arc(240, 190, 132, 0.2, 4.7);
      context.stroke();
      context.strokeStyle = "rgba(224, 161, 108, 0.62)";
      context.beginPath();
      context.arc(405, 255, 140, 2.9, 7.2);
      context.stroke();
      context.fillStyle = "rgba(238, 247, 250, 0.72)";
      context.beginPath();
      context.arc(325, 215, 25, 0, Math.PI * 2);
      context.fill();
    }

    const textureResult = new THREE.CanvasTexture(canvas);
    textureResult.colorSpace = THREE.SRGBColorSpace;
    textureResult.anisotropy = 8;
    textureResult.needsUpdate = true;
    return textureResult;
  }, [kind]);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function usePosterTexture() {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 560;
    canvas.height = 760;
    const context = canvas.getContext("2d");

    if (!context) {
      return new THREE.CanvasTexture(canvas);
    }

    context.fillStyle = "#ddd7ca";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#101821";
    context.fillRect(34, 34, canvas.width - 68, canvas.height - 68);

    context.strokeStyle = "#6bcaff";
    context.lineWidth = 16;
    context.beginPath();
    context.arc(280, 286, 156, -0.9, Math.PI * 1.18);
    context.stroke();

    context.fillStyle = "#cf8245";
    context.beginPath();
    context.arc(280, 286, 89, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#ece7dc";
    context.font = "700 122px Arial, sans-serif";
    context.textAlign = "center";
    context.fillText("23", 280, 330);
    context.font = "700 33px Arial, sans-serif";
    context.letterSpacing = "9px";
    context.fillText("NIGHT GAME", 280, 610);
    context.fillStyle = "rgba(236, 231, 220, 0.5)";
    context.font = "500 20px Arial, sans-serif";
    context.letterSpacing = "5px";
    context.fillText("WEST SIDE  /  1998", 280, 656);

    const textureResult = new THREE.CanvasTexture(canvas);
    textureResult.colorSpace = THREE.SRGBColorSpace;
    textureResult.anisotropy = 8;
    textureResult.needsUpdate = true;
    return textureResult;
  }, []);

  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function RoomShell() {
  const plankColors = ["#211810", "#291d14", "#1d1610", "#302117"];

  return (
    <group>
      <Box
        size={[13.35, 0.34, 10.25]}
        position={[0, -0.25, 0]}
        color="#070809"
        roughness={0.92}
        receiveShadow
      />

      {Array.from({ length: 19 }, (_, index) => (
        <Box
          key={`floor-plank-${index}`}
          size={[0.66, 0.1, 9.82]}
          position={[-6.18 + index * 0.69, -0.035, 0]}
          color={plankColors[index % plankColors.length]}
          roughness={0.88}
          castShadow={false}
        />
      ))}

      {Array.from({ length: 6 }, (_, index) => (
        <Box
          key={`floor-seam-${index}`}
          size={[12.95, 0.007, 0.018]}
          position={[0, 0.018, -3.92 + index * 1.58]}
          color="#0c0a08"
          roughness={1}
          castShadow={false}
        />
      ))}

      <Box
        size={[13.2, 6.35, 0.2]}
        position={[0, 3.08, -4.96]}
        color={palette.wall}
        roughness={0.96}
        castShadow={false}
      />
      <Box
        size={[0.2, 6.35, 10.02]}
        position={[-6.6, 3.08, 0]}
        color={palette.wallSide}
        roughness={0.96}
        castShadow={false}
      />

      <Box
        size={[13.02, 0.22, 0.15]}
        position={[0, 0.17, -4.82]}
        color="#2a2420"
        roughness={0.78}
      />
      <Box
        size={[0.15, 0.22, 9.78]}
        position={[-6.47, 0.17, 0]}
        color="#241f1c"
        roughness={0.78}
      />
      <Box
        size={[13.35, 0.26, 0.12]}
        position={[0, -0.16, 5.07]}
        color="#101318"
        roughness={0.76}
      />
      <Box
        size={[0.12, 0.26, 10.18]}
        position={[6.62, -0.16, 0]}
        color="#101318"
        roughness={0.76}
      />

      <Box
        size={[4.95, 0.045, 0.05]}
        position={[2.96, 1.63, -4.81]}
        color={palette.cobalt}
        emissive={palette.cobalt}
        emissiveIntensity={4.2}
        roughness={0.35}
        castShadow={false}
      />
      <pointLight
        position={[2.7, 1.72, -4.35]}
        color="#4ebcff"
        intensity={8}
        distance={5.5}
        decay={2}
      />
    </group>
  );
}

function Rug() {
  return (
    <group position={[-0.05, 0.045, 0.55]}>
      <Box
        size={[5.55, 0.07, 3.52]}
        color="#24272c"
        roughness={1}
        castShadow={false}
      />
      <Box
        size={[5.18, 0.012, 3.15]}
        position={[0, 0.043, 0]}
        color="#14171c"
        roughness={1}
        castShadow={false}
      />
      {[-1.05, -0.35, 0.35, 1.05].map((z, index) => (
        <Box
          key={`rug-stripe-${z}`}
          size={[4.72 - index * 0.08, 0.01, 0.055]}
          position={[0, 0.052, z]}
          color={index % 2 === 0 ? "#39404a" : "#303640"}
          roughness={1}
          castShadow={false}
        />
      ))}
    </group>
  );
}

function Bed() {
  return (
    <group position={[-4.25, 0, -0.55]}>
      <Box
        size={[3.58, 0.48, 5.9]}
        position={[0, 0.46, 0]}
        color={palette.walnut}
        roughness={0.8}
      />
      <Box
        size={[3.4, 0.5, 5.62]}
        position={[0, 0.86, 0]}
        color="#9e9a91"
        roughness={1}
      />
      <Box
        size={[3.32, 0.36, 3.72]}
        position={[0, 1.25, 0.73]}
        color="#1e2936"
        roughness={1}
      />
      <Box
        size={[3.33, 0.09, 0.56]}
        position={[0, 1.475, -1.02]}
        color="#aa8d70"
        roughness={1}
      />
      <Box
        size={[3.5, 2.2, 0.28]}
        position={[0, 1.48, -2.83]}
        color="#3c281d"
        roughness={0.76}
      />
      {[-1.16, -0.58, 0, 0.58, 1.16].map((x) => (
        <Box
          key={`headboard-panel-${x}`}
          size={[0.055, 1.75, 0.04]}
          position={[x, 1.48, -2.665]}
          color="#5b3a28"
          roughness={0.72}
        />
      ))}

      {[-1.42, 1.42].flatMap((x) =>
        [-2.42, 2.42].map((z) => (
          <Box
            key={`bed-leg-${x}-${z}`}
            size={[0.2, 0.56, 0.2]}
            position={[x, 0.22, z]}
            color="#1a1715"
            roughness={0.64}
          />
        )),
      )}

      {[-0.82, 0.82].map((x) => (
        <mesh
          key={`pillow-${x}`}
          position={[x, 1.5, -1.94]}
          rotation={[-0.08, 0, 0]}
          scale={[1.02, 0.28, 0.62]}
          castShadow
          receiveShadow
        >
          <sphereGeometry args={[1, 24, 16]} />
          <meshStandardMaterial color={palette.cream} roughness={1} />
        </mesh>
      ))}

      <Box
        size={[2.96, 0.15, 0.52]}
        position={[0, 1.53, 2.22]}
        color="#936442"
        roughness={0.96}
      />
    </group>
  );
}

function Monitor() {
  const texture = useScreenTexture("desktop");
  const lightRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (lightRef.current) {
      lightRef.current.intensity = 7.5 + Math.sin(clock.elapsedTime * 1.35) * 0.55;
    }
  });

  return (
    <group>
      <Cylinder
        radius={0.07}
        height={1.02}
        position={[0, 0.53, -0.08]}
        color="#20262e"
        roughness={0.36}
        metalness={0.65}
      />
      <Box
        size={[0.92, 0.08, 0.46]}
        position={[0, 0.05, 0.05]}
        color="#161b21"
        roughness={0.42}
        metalness={0.55}
      />
      <Box
        size={[2.42, 1.45, 0.14]}
        position={[0, 1.34, -0.02]}
        color="#0a0d11"
        roughness={0.35}
        metalness={0.36}
      />
      <mesh position={[0, 1.34, 0.055]}>
        <planeGeometry args={[2.24, 1.25]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <pointLight
        ref={lightRef}
        position={[0, 1.28, 0.55]}
        color="#60c6ff"
        intensity={7.5}
        distance={4.4}
        decay={2}
      />
    </group>
  );
}

function Laptop() {
  const texture = useScreenTexture("laptop");

  return (
    <group>
      <Box
        size={[1.58, 0.075, 1.02]}
        position={[0, 0.055, 0]}
        color="#969da3"
        roughness={0.28}
        metalness={0.76}
      />
      <Box
        size={[1.38, 0.026, 0.77]}
        position={[0, 0.102, 0.03]}
        color="#15191e"
        roughness={0.58}
      />
      {Array.from({ length: 5 }, (_, row) =>
        Array.from({ length: 9 }, (_, column) => (
          <Box
            key={`laptop-key-${row}-${column}`}
            size={[0.108, 0.012, 0.085]}
            position={[-0.5 + column * 0.126, 0.123, -0.19 + row * 0.106]}
            color="#313740"
            roughness={0.58}
            castShadow={false}
          />
        )),
      )}
      <Box
        size={[0.44, 0.012, 0.26]}
        position={[0, 0.124, 0.34]}
        color="#747b80"
        roughness={0.32}
        metalness={0.62}
        castShadow={false}
      />

      <group position={[0, 0.08, -0.49]} rotation={[-0.12, 0, 0]}>
        <Box
          size={[1.58, 1.02, 0.065]}
          position={[0, 0.51, 0]}
          color="#8e9499"
          roughness={0.26}
          metalness={0.74}
        />
        <mesh position={[0, 0.51, 0.037]}>
          <planeGeometry args={[1.43, 0.87]} />
          <meshBasicMaterial map={texture} toneMapped={false} />
        </mesh>
        <Box
          size={[0.22, 0.035, 0.01]}
          position={[0, 0.973, 0.04]}
          color="#0a0d11"
          roughness={0.4}
          castShadow={false}
        />
      </group>
    </group>
  );
}

function KeyboardAndMouse() {
  return (
    <group>
      <Box
        size={[2.08, 0.025, 0.83]}
        position={[0.32, 0, 0]}
        color="#0d1014"
        roughness={0.9}
      />
      <Box
        size={[1.34, 0.075, 0.47]}
        position={[0, 0.055, 0]}
        color="#151a20"
        roughness={0.58}
      />
      {Array.from({ length: 4 }, (_, row) =>
        Array.from({ length: 11 }, (_, column) => (
          <Box
            key={`desk-key-${row}-${column}`}
            size={[0.085, 0.018, 0.075]}
            position={[-0.46 + column * 0.094, 0.104, -0.14 + row * 0.093]}
            color={column === 10 && row === 0 ? palette.cobaltDeep : "#353c44"}
            roughness={0.52}
            emissive={column === 10 && row === 0 ? palette.cobalt : "#000000"}
            emissiveIntensity={column === 10 && row === 0 ? 1.5 : 0}
            castShadow={false}
          />
        )),
      )}
      <mesh position={[1.02, 0.09, 0.03]} scale={[0.17, 0.09, 0.25]} castShadow>
        <sphereGeometry args={[1, 18, 12]} />
        <meshStandardMaterial color="#262d35" roughness={0.48} metalness={0.18} />
      </mesh>
      <Box
        size={[0.018, 0.09, 0.24]}
        position={[1.02, 0.125, -0.03]}
        color="#59636f"
        roughness={0.45}
        castShadow={false}
      />
    </group>
  );
}

function PcTower() {
  const fans = [-0.42, 0.35];

  return (
    <group>
      <Box
        size={[1.08, 1.72, 1.38]}
        position={[0, 0.86, 0]}
        color="#0b0e12"
        roughness={0.38}
        metalness={0.48}
      />
      <mesh position={[0.548, 0.86, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.22, 1.52]} />
        <meshPhysicalMaterial
          color="#203243"
          transparent
          opacity={0.34}
          roughness={0.12}
          metalness={0.18}
          transmission={0.12}
        />
      </mesh>
      {fans.map((y) => (
        <group key={`pc-fan-${y}`} position={[0, 0.95 + y, 0.704]}>
          <mesh>
            <torusGeometry args={[0.285, 0.034, 10, 28]} />
            <meshStandardMaterial
              color="#1a536f"
              emissive={palette.cobalt}
              emissiveIntensity={1.35}
              roughness={0.32}
            />
          </mesh>
          <Cylinder
            radius={0.085}
            height={0.03}
            rotation={[Math.PI / 2, 0, 0]}
            color="#5bc4f5"
            emissive={palette.cobalt}
            emissiveIntensity={1.35}
          />
          {[0, Math.PI / 2, Math.PI, (Math.PI * 3) / 2].map((angle) => (
            <Box
              key={`fan-blade-${angle}`}
              size={[0.21, 0.045, 0.02]}
              position={[Math.cos(angle) * 0.105, Math.sin(angle) * 0.105, 0.018]}
              rotation={[0, 0, angle]}
              color="#3e899e"
              emissive="#24667e"
              emissiveIntensity={1.2}
              castShadow={false}
            />
          ))}
        </group>
      ))}
      <Box
        size={[0.55, 0.055, 0.03]}
        position={[0, 1.6, 0.71]}
        color="#35647a"
        emissive={palette.cobalt}
        emissiveIntensity={1.3}
        castShadow={false}
      />
    </group>
  );
}

function Desk() {
  return (
    <group position={[2.95, 0, -3.76]}>
      <Box
        size={[5.42, 0.23, 1.62]}
        position={[0, 1.94, 0]}
        color={palette.walnutLight}
        roughness={0.64}
      />
      <Box
        size={[5.25, 0.045, 1.49]}
        position={[0, 2.075, 0]}
        color="#62402b"
        roughness={0.56}
      />
      <Box
        size={[0.94, 1.68, 1.38]}
        position={[-2.06, 0.94, -0.02]}
        color="#20242a"
        roughness={0.68}
      />
      {[0.55, 0.96, 1.37].map((y) => (
        <group key={`drawer-${y}`}>
          <Box
            size={[0.76, 0.32, 0.045]}
            position={[-2.06, y, 0.69]}
            color="#2b3037"
            roughness={0.62}
          />
          <Box
            size={[0.28, 0.025, 0.045]}
            position={[-2.06, y, 0.724]}
            color="#727984"
            roughness={0.28}
            metalness={0.7}
          />
        </group>
      ))}

      {[-1.48, 1.74].map((x) => (
        <group key={`desk-leg-${x}`}>
          <Beam
            start={[x, 0.12, -0.54]}
            end={[x, 1.82, -0.54]}
            radius={0.055}
            color="#11151a"
            metalness={0.58}
          />
          <Beam
            start={[x, 0.12, 0.54]}
            end={[x, 1.82, 0.54]}
            radius={0.055}
            color="#11151a"
            metalness={0.58}
          />
          <Beam
            start={[x, 0.12, -0.54]}
            end={[x, 0.12, 0.54]}
            radius={0.065}
            color="#11151a"
            metalness={0.58}
          />
        </group>
      ))}

      <group position={[0.15, 2.08, 0.18]}>
        <Monitor />
      </group>
      <group position={[-1.28, 2.095, 0.24]} rotation={[0, 0.08, 0]}>
        <Laptop />
      </group>
      <group position={[0.28, 2.105, 0.56]}>
        <KeyboardAndMouse />
      </group>
      <group position={[2.04, 2.08, -0.02]}>
        <PcTower />
      </group>

      <Cylinder
        radius={0.19}
        height={0.045}
        position={[-2.3, 2.125, 0.34]}
        color="#1c2229"
        roughness={0.42}
      />
      <Cylinder
        radius={0.045}
        height={0.55}
        position={[-2.3, 2.42, 0.34]}
        color="#222a32"
        metalness={0.5}
      />
      <Box
        size={[0.38, 0.3, 0.08]}
        position={[-2.3, 2.71, 0.34]}
        rotation={[0.12, 0, 0]}
        color="#7fcaf0"
        emissive="#5ebce9"
        emissiveIntensity={1.5}
        roughness={0.36}
      />
    </group>
  );
}

function GamingChair() {
  return (
    <group position={[3.12, 0, -1.65]} rotation={[0, -0.06, 0]}>
      <Cylinder
        radius={0.105}
        height={0.92}
        position={[0, 0.73, 0]}
        color="#242b33"
        roughness={0.32}
        metalness={0.72}
      />
      <Cylinder
        radiusTop={0.42}
        radiusBottom={0.2}
        height={0.12}
        position={[0, 0.27, 0]}
        color="#1a2027"
        roughness={0.38}
        metalness={0.64}
      />
      {Array.from({ length: 5 }, (_, index) => {
        const angle = (index / 5) * Math.PI * 2;
        return (
          <group key={`chair-leg-${index}`}>
            <Beam
              start={[0, 0.3, 0]}
              end={[Math.cos(angle) * 0.72, 0.18, Math.sin(angle) * 0.72]}
              radius={0.045}
              color="#181d23"
              metalness={0.62}
            />
            <Cylinder
              radius={0.09}
              height={0.09}
              position={[Math.cos(angle) * 0.76, 0.13, Math.sin(angle) * 0.76]}
              rotation={[Math.PI / 2, 0, angle]}
              color="#080a0d"
              roughness={0.9}
            />
          </group>
        );
      })}
      <Box
        size={[1.05, 0.22, 1.04]}
        position={[0, 1.24, 0]}
        color="#181e25"
        roughness={0.88}
      />
      <Box
        size={[0.72, 0.055, 0.78]}
        position={[0, 1.38, -0.01]}
        color="#303944"
        roughness={0.94}
      />
      <group position={[0, 1.3, 0.44]} rotation={[-0.13, 0, 0]}>
        <Box
          size={[1.14, 1.82, 0.24]}
          position={[0, 0.92, 0]}
          color="#171d24"
          roughness={0.88}
        />
        <Box
          size={[0.08, 1.5, 0.035]}
          position={[0, 0.9, -0.14]}
          color="#35779a"
          emissive="#256885"
          emissiveIntensity={0.75}
          roughness={0.72}
        />
        <Box
          size={[0.72, 0.25, 0.12]}
          position={[0, 1.46, -0.18]}
          color="#303945"
          roughness={0.86}
        />
        <Box
          size={[0.54, 0.23, 0.11]}
          position={[0, 0.72, -0.18]}
          color="#252e38"
          roughness={0.86}
        />
      </group>
      {[-0.66, 0.66].map((x) => (
        <group key={`armrest-${x}`}>
          <Box
            size={[0.13, 0.65, 0.13]}
            position={[x, 1.55, 0]}
            color="#171c22"
            roughness={0.62}
          />
          <Box
            size={[0.22, 0.1, 0.62]}
            position={[x, 1.9, -0.02]}
            color="#222931"
            roughness={0.78}
          />
        </group>
      ))}
    </group>
  );
}

function Dumbbell({ position, scale = 1 }: { position: Vector3Tuple; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <Cylinder
        radius={0.065}
        height={0.52}
        rotation={[0, 0, Math.PI / 2]}
        color="#68717a"
        metalness={0.7}
        roughness={0.3}
      />
      {[-0.26, -0.17, 0.17, 0.26].map((x, index) => (
        <Cylinder
          key={`dumbbell-plate-${x}`}
          radius={index === 0 || index === 3 ? 0.18 : 0.15}
          height={0.08}
          position={[x, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
          color="#101317"
          roughness={0.86}
          metalness={0.14}
          segments={14}
        />
      ))}
    </group>
  );
}

function GymCorner() {
  const postCoordinates: Array<[number, number]> = [
    [-1.62, -0.66],
    [1.62, -0.66],
    [-1.62, 0.66],
    [1.62, 0.66],
  ];

  return (
    <group position={[4.25, 0, 3.45]} scale={0.86}>
      <Box
        size={[4.28, 0.045, 2.85]}
        position={[0, 0.035, -0.18]}
        color="#0e1217"
        roughness={1}
        castShadow={false}
      />
      {postCoordinates.map(([x, z]) => (
        <group key={`rack-post-${x}-${z}`}>
          <Box
            size={[0.16, 4.48, 0.16]}
            position={[x, 2.3, z]}
            color="#1a2026"
            roughness={0.43}
            metalness={0.55}
          />
          {Array.from({ length: 9 }, (_, index) => (
            <Cylinder
              key={`rack-hole-${x}-${z}-${index}`}
              radius={0.025}
              height={0.012}
              position={[x, 0.74 + index * 0.42, z + (z > 0 ? 0.087 : -0.087)]}
              rotation={[Math.PI / 2, 0, 0]}
              color="#050608"
              roughness={0.7}
              segments={10}
            />
          ))}
        </group>
      ))}

      {[-0.66, 0.66].map((z) => (
        <group key={`rack-frame-${z}`}>
          <Box
            size={[3.42, 0.15, 0.15]}
            position={[0, 4.5, z]}
            color="#20262d"
            roughness={0.4}
            metalness={0.58}
          />
          <Box
            size={[3.72, 0.12, 0.36]}
            position={[0, 0.08, z]}
            color="#12171c"
            roughness={0.58}
            metalness={0.46}
          />
        </group>
      ))}
      {[-1.62, 1.62].map((x) => (
        <Box
          key={`rack-side-top-${x}`}
          size={[0.15, 0.15, 1.48]}
          position={[x, 4.5, 0]}
          color="#20262d"
          roughness={0.4}
          metalness={0.58}
        />
      ))}

      <Cylinder
        radius={0.055}
        height={3.78}
        position={[0, 3.98, -0.74]}
        rotation={[0, 0, Math.PI / 2]}
        color="#8a9197"
        metalness={0.88}
        roughness={0.22}
      />

      {[-1.86, 1.86].map((x) => (
        <group key={`barbell-side-${x}`}>
          <Cylinder
            radius={0.31}
            height={0.12}
            position={[x, 3.98, -0.74]}
            rotation={[0, 0, Math.PI / 2]}
            color="#13171c"
            roughness={0.78}
            metalness={0.2}
            segments={20}
          />
          <Cylinder
            radius={0.24}
            height={0.1}
            position={[x + (x < 0 ? 0.12 : -0.12), 3.98, -0.74]}
            rotation={[0, 0, Math.PI / 2]}
            color="#293039"
            roughness={0.72}
            metalness={0.24}
            segments={20}
          />
        </group>
      ))}

      {[-1.33, 1.33].map((x) => (
        <group key={`weight-stack-${x}`} position={[x, 0.33, 0.53]}>
          {Array.from({ length: 8 }, (_, index) => (
            <Box
              key={`weight-stack-plate-${x}-${index}`}
              size={[0.46, 0.085, 0.38]}
              position={[0, index * 0.105, 0]}
              color={index % 2 === 0 ? "#15191e" : "#20252b"}
              roughness={0.7}
              metalness={0.36}
            />
          ))}
        </group>
      ))}

      <Cylinder
        radius={0.13}
        height={0.12}
        position={[-1.5, 4.12, 0.57]}
        rotation={[Math.PI / 2, 0, 0]}
        color="#77808a"
        metalness={0.7}
        roughness={0.32}
      />
      <Cylinder
        radius={0.13}
        height={0.12}
        position={[1.5, 4.12, 0.57]}
        rotation={[Math.PI / 2, 0, 0]}
        color="#77808a"
        metalness={0.7}
        roughness={0.32}
      />
      <Beam
        start={[-1.5, 4.05, 0.57]}
        end={[-0.42, 1.25, -0.38]}
        radius={0.018}
        color="#79828a"
        metalness={0.6}
      />
      <Beam
        start={[1.5, 4.05, 0.57]}
        end={[0.42, 1.25, -0.38]}
        radius={0.018}
        color="#79828a"
        metalness={0.6}
      />
      <Beam
        start={[-0.42, 1.25, -0.38]}
        end={[0.42, 1.25, -0.38]}
        radius={0.035}
        color="#4e5962"
        metalness={0.72}
      />

      <group position={[-0.15, 0, -1.55]}>
        <Beam
          start={[-1.25, 0.06, -0.34]}
          end={[-0.88, 0.9, 0.1]}
          radius={0.055}
          color="#171c21"
          metalness={0.56}
        />
        <Beam
          start={[1.25, 0.06, -0.34]}
          end={[0.88, 0.9, 0.1]}
          radius={0.055}
          color="#171c21"
          metalness={0.56}
        />
        <Box
          size={[2.52, 0.12, 0.4]}
          position={[0, 0.86, 0.04]}
          rotation={[-0.12, 0, 0]}
          color="#20262c"
          roughness={0.62}
          metalness={0.4}
        />
        <Dumbbell position={[-0.82, 1.06, -0.03]} scale={1.12} />
        <Dumbbell position={[0, 1.06, -0.03]} scale={0.98} />
        <Dumbbell position={[0.8, 1.06, -0.03]} scale={0.84} />
      </group>

      {[0, 1, 2].map((index) => (
        <Cylinder
          key={`loose-plate-${index}`}
          radius={0.48 - index * 0.08}
          height={0.12}
          position={[1.9 + index * 0.13, 0.52 - index * 0.04, 0.48 - index * 0.2]}
          rotation={[Math.PI / 2, 0.12 + index * 0.05, 0]}
          color={index === 1 ? "#242b32" : "#12161a"}
          roughness={0.8}
          metalness={0.18}
          segments={20}
        />
      ))}
      <pointLight
        position={[0.3, 3.15, -0.15]}
        color="#9db5c8"
        intensity={5.2}
        distance={5.4}
        decay={2}
      />
    </group>
  );
}

function WallDecor() {
  const poster = usePosterTexture();

  return (
    <group>
      <group position={[-3.76, 4.4, -4.82]}>
        <Box
          size={[2.12, 1.66, 0.12]}
          color="#080a0d"
          roughness={0.5}
          metalness={0.28}
        />
        <mesh position={[0, 0, 0.066]}>
          <planeGeometry args={[1.92, 1.46]} />
          <meshStandardMaterial map={poster} roughness={0.84} />
        </mesh>
      </group>

      <group position={[-6.45, 3.65, 1.85]} rotation={[0.08, 0, -0.12]}>
        <Box
          size={[0.08, 1.68, 0.4]}
          color="#926442"
          roughness={0.74}
        />
        {[-0.66, 0.66].map((y) => (
          <group key={`skate-truck-${y}`} position={[0.08, y, 0]}>
            <Cylinder
              radius={0.065}
              height={0.56}
              rotation={[Math.PI / 2, 0, 0]}
              color="#6f7880"
              metalness={0.72}
              roughness={0.3}
            />
            {[-0.31, 0.31].map((z) => (
              <Cylinder
                key={`skate-wheel-${y}-${z}`}
                radius={0.11}
                height={0.08}
                position={[0.13, 0, z]}
                rotation={[Math.PI / 2, 0, 0]}
                color="#bd8a5e"
                roughness={0.7}
              />
            ))}
          </group>
        ))}
      </group>

      <group position={[-6.42, 2.5, -2.05]}>
        <Box size={[0.34, 0.12, 2.2]} color="#4b3223" roughness={0.7} />
        {[0, 1, 2, 3].map((index) => (
          <Box
            key={`shelf-book-${index}`}
            size={[0.19, 0.72 + index * 0.08, 0.33]}
            position={[0.2, 0.42 + index * 0.04, -0.72 + index * 0.43]}
            rotation={[0, 0, index === 3 ? 0.12 : 0]}
            color={["#8f5c3d", "#354f61", "#8b887d", "#513b32"][index]}
            roughness={0.88}
          />
        ))}
      </group>

      <group position={[0.15, 4.55, -4.79]}>
        <Beam
          start={[-0.78, 0.48, 0]}
          end={[-0.2, 0.08, 0]}
          radius={0.027}
          color={palette.cobalt}
          emissive={palette.cobalt}
          emissiveIntensity={4}
        />
        <Beam
          start={[-0.2, 0.08, 0]}
          end={[-0.46, -0.05, 0]}
          radius={0.027}
          color={palette.cobalt}
          emissive={palette.cobalt}
          emissiveIntensity={4}
        />
        <Beam
          start={[-0.46, -0.05, 0]}
          end={[0.62, -0.55, 0]}
          radius={0.027}
          color={palette.cobalt}
          emissive={palette.cobalt}
          emissiveIntensity={4}
        />
        <pointLight color="#63c9ff" intensity={5.5} distance={3.2} decay={2} />
      </group>
    </group>
  );
}

function SideTableAndLamp() {
  return (
    <group position={[-1.9, 0, -3.35]}>
      <Box
        size={[1.05, 0.15, 0.9]}
        position={[0, 0.94, 0]}
        color="#493022"
        roughness={0.68}
      />
      {[-0.4, 0.4].flatMap((x) =>
        [-0.32, 0.32].map((z) => (
          <Box
            key={`side-table-leg-${x}-${z}`}
            size={[0.09, 0.9, 0.09]}
            position={[x, 0.48, z]}
            color="#29221e"
            roughness={0.76}
          />
        )),
      )}
      <Cylinder
        radius={0.17}
        height={0.07}
        position={[0, 1.05, 0]}
        color="#171c22"
        metalness={0.48}
        roughness={0.42}
      />
      <Cylinder
        radius={0.035}
        height={0.86}
        position={[0, 1.5, 0]}
        color="#444b51"
        metalness={0.72}
        roughness={0.3}
      />
      <Cylinder
        radiusTop={0.2}
        radiusBottom={0.36}
        height={0.55}
        position={[0, 2.02, 0]}
        color="#9a7657"
        emissive="#b16f35"
        emissiveIntensity={0.35}
        roughness={0.82}
        segments={24}
      />
      <pointLight
        position={[0, 1.92, 0.2]}
        color="#f0aa68"
        intensity={8}
        distance={4.2}
        decay={2}
      />
    </group>
  );
}

function SceneLighting() {
  return (
    <group>
      <ambientLight intensity={0.3} color="#8fa0b8" />
      <hemisphereLight args={["#70869f", "#100d0b", 0.58]} />
      <directionalLight
        position={[7, 10, 8]}
        color="#c8d8e8"
        intensity={1.4}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={0.5}
        shadow-camera-far={35}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-bias={-0.00025}
      />
      <spotLight
        position={[-1.5, 9, 6.5]}
        target-position={[0, 0, 0]}
        color="#d49b69"
        intensity={72}
        distance={28}
        angle={0.54}
        penumbra={0.88}
        decay={2}
      />
    </group>
  );
}

function CameraSetup() {
  const { camera } = useThree();

  useLayoutEffect(() => {
    camera.position.set(13.4, 9.7, 15.8);
    camera.lookAt(0, 1.7, -0.05);
    camera.updateProjectionMatrix();
  }, [camera]);

  return null;
}

function Diorama({
  interactionRef,
  reducedMotion,
}: RoomSceneProps) {
  const rootRef = useRef<THREE.Group>(null);
  const { size } = useThree();
  const velocityRef = useRef({ pitch: 0, yaw: 0 });
  const releaseVersionRef = useRef(-1);
  const entranceRef = useRef(reducedMotion ? 1 : 0);
  const aspect = size.width / Math.max(size.height, 1);
  const responsiveScale = Math.min(1, Math.max(0.46, aspect * 0.72));

  useFrame(({ clock }, frameDelta) => {
    const root = rootRef.current;
    if (!root) {
      return;
    }

    const delta = Math.min(frameDelta, 0.035);
    const interaction = interactionRef.current;

    if (releaseVersionRef.current !== interaction.releaseVersion) {
      releaseVersionRef.current = interaction.releaseVersion;
      velocityRef.current.pitch = reducedMotion
        ? 0
        : interaction.releasePitchVelocity * 0.56;
      velocityRef.current.yaw = reducedMotion
        ? 0
        : interaction.releaseYawVelocity * 0.56;
    }

    if (interaction.dragging) {
      velocityRef.current.pitch = 0;
      velocityRef.current.yaw = 0;
      interaction.currentPitch = THREE.MathUtils.damp(
        interaction.currentPitch,
        interaction.targetPitch,
        17,
        delta,
      );
      interaction.currentYaw = THREE.MathUtils.damp(
        interaction.currentYaw,
        interaction.targetYaw,
        17,
        delta,
      );
    } else if (reducedMotion) {
      interaction.currentPitch = THREE.MathUtils.damp(
        interaction.currentPitch,
        0,
        20,
        delta,
      );
      interaction.currentYaw = THREE.MathUtils.damp(
        interaction.currentYaw,
        0,
        20,
        delta,
      );
    } else {
      const stiffness = 31;
      const damping = 7.4;

      velocityRef.current.pitch +=
        (-stiffness * interaction.currentPitch - damping * velocityRef.current.pitch) *
        delta;
      velocityRef.current.yaw +=
        (-stiffness * interaction.currentYaw - damping * velocityRef.current.yaw) *
        delta;
      interaction.currentPitch += velocityRef.current.pitch * delta;
      interaction.currentYaw += velocityRef.current.yaw * delta;

      if (
        Math.abs(interaction.currentPitch) < 0.0001 &&
        Math.abs(velocityRef.current.pitch) < 0.0002
      ) {
        interaction.currentPitch = 0;
        velocityRef.current.pitch = 0;
      }
      if (
        Math.abs(interaction.currentYaw) < 0.0001 &&
        Math.abs(velocityRef.current.yaw) < 0.0002
      ) {
        interaction.currentYaw = 0;
        velocityRef.current.yaw = 0;
      }
    }

    entranceRef.current = reducedMotion
      ? 1
      : THREE.MathUtils.damp(entranceRef.current, 1, 4.6, delta);

    const entrance = entranceRef.current;
    const idleLift = reducedMotion ? 0 : Math.sin(clock.elapsedTime * 0.58) * 0.025;
    root.position.y = -0.34 - (1 - entrance) * 0.7 + idleLift;
    root.rotation.set(
      interaction.currentPitch * 0.82,
      interaction.currentYaw,
      -interaction.currentYaw * 0.024,
      "YXZ",
    );
    root.scale.setScalar(responsiveScale * (0.92 + entrance * 0.08));
  });

  return (
    <group
      ref={rootRef}
      position={[0, reducedMotion ? -0.34 : -1.04, 0]}
      scale={responsiveScale * (reducedMotion ? 1 : 0.92)}
    >
      <RoomShell />
      <Rug />
      <Bed />
      <SideTableAndLamp />
      <Desk />
      <GamingChair />
      <GymCorner />
      <WallDecor />
    </group>
  );
}

export function RoomScene({ interactionRef, reducedMotion }: RoomSceneProps) {
  return (
    <Canvas
      className={styles.canvas}
      shadows
      dpr={[1, 1.75]}
      camera={{
        position: [13.4, 9.7, 15.8],
        fov: 31,
        near: 0.1,
        far: 70,
      }}
      gl={{
        antialias: true,
        alpha: false,
        powerPreference: "high-performance",
      }}
      onCreated={({ gl }) => {
        gl.setClearColor("#000000", 1);
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.05;
        gl.shadowMap.type = THREE.PCFShadowMap;
      }}
    >
      <color attach="background" args={["#000000"]} />
      <fog attach="fog" args={["#000000", 26, 46]} />
      <CameraSetup />
      <SceneLighting />
      <Diorama interactionRef={interactionRef} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
