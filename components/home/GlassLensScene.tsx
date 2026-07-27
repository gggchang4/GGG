"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  CanvasTexture,
  Color,
  Group,
  LinearFilter,
  PMREMGenerator,
  PointLight,
  Scene,
  SRGBColorSpace,
  Texture,
  Vector2,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import type { DiscController } from "@/lib/discPhysics";
import { stepDiscPhysics } from "@/lib/discPhysics";
import styles from "@/components/home/home.module.css";

const CAMERA_CONFIG = {
  position: [0, 0, 6.2] as [number, number, number],
  fov: 44,
  near: 0.1,
  far: 30,
};

const DPR_RANGE: [number, number] = [1, 1.5];

const GL_CONFIG = {
  alpha: true,
  antialias: true,
  powerPreference: "high-performance" as const,
};

const LENS_RADIUS = 2.34;
const LENS_CENTER_HALF_THICKNESS = 0.23;
const LENS_EDGE_HALF_THICKNESS = 0.048;
const LENS_PROFILE_SEGMENTS = 48;

function setSceneEnvironment(scene: Scene, environment: Texture | null) {
  scene.environment = environment;
}

function createLensProfile() {
  const points: Vector2[] = [];

  for (let index = 0; index <= LENS_PROFILE_SEGMENTS; index += 1) {
    const ratio = index / LENS_PROFILE_SEGMENTS;
    const radius = LENS_RADIUS * ratio;
    const curve = Math.pow(Math.max(0, 1 - ratio * ratio), 1.25);
    const halfThickness =
      LENS_EDGE_HALF_THICKNESS +
      (LENS_CENTER_HALF_THICKNESS - LENS_EDGE_HALF_THICKNESS) * curve;

    points.push(new Vector2(radius, -halfThickness));
  }

  for (let index = LENS_PROFILE_SEGMENTS; index >= 0; index -= 1) {
    const ratio = index / LENS_PROFILE_SEGMENTS;
    const radius = LENS_RADIUS * ratio;
    const curve = Math.pow(Math.max(0, 1 - ratio * ratio), 1.25);
    const halfThickness =
      LENS_EDGE_HALF_THICKNESS +
      (LENS_CENTER_HALF_THICKNESS - LENS_EDGE_HALF_THICKNESS) * curve;

    points.push(new Vector2(radius, halfThickness));
  }

  return points;
}

function createOpticalBackdropTexture() {
  const size = 1024;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = size;
  canvas.height = size;

  if (!context) {
    return null;
  }

  context.fillStyle = "#ebeae4";
  context.fillRect(0, 0, size, size);

  const centerGlow = context.createRadialGradient(
    size * 0.47,
    size * 0.42,
    0,
    size * 0.5,
    size * 0.48,
    size * 0.62,
  );
  centerGlow.addColorStop(0, "rgba(255, 255, 252, 0.76)");
  centerGlow.addColorStop(0.42, "rgba(248, 249, 245, 0.54)");
  centerGlow.addColorStop(1, "rgba(235, 234, 228, 0)");
  context.fillStyle = centerGlow;
  context.fillRect(0, 0, size, size);

  const mintGlow = context.createRadialGradient(
    size * 0.69,
    size * 0.66,
    0,
    size * 0.69,
    size * 0.66,
    size * 0.32,
  );
  mintGlow.addColorStop(0, "rgba(163, 222, 215, 0.25)");
  mintGlow.addColorStop(0.5, "rgba(189, 226, 225, 0.1)");
  mintGlow.addColorStop(1, "rgba(189, 226, 225, 0)");
  context.fillStyle = mintGlow;
  context.fillRect(0, 0, size, size);

  const blueGlow = context.createRadialGradient(
    size * 0.28,
    size * 0.31,
    0,
    size * 0.28,
    size * 0.31,
    size * 0.25,
  );
  blueGlow.addColorStop(0, "rgba(172, 197, 231, 0.19)");
  blueGlow.addColorStop(1, "rgba(172, 197, 231, 0)");
  context.fillStyle = blueGlow;
  context.fillRect(0, 0, size, size);

  context.lineWidth = 1;
  context.strokeStyle = "rgba(20, 21, 18, 0.045)";

  for (let index = 1; index < 8; index += 1) {
    const position = Math.round((size / 8) * index) + 0.5;
    context.beginPath();
    context.moveTo(position, 0);
    context.lineTo(position, size);
    context.stroke();
  }

  context.strokeStyle = "rgba(20, 21, 18, 0.18)";
  context.beginPath();
  context.moveTo(size / 2 + 0.5, 0);
  context.lineTo(size / 2 + 0.5, size);
  context.stroke();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

function Environment() {
  const gl = useThree((state) => state.gl);
  const scene = useThree((state) => state.scene);

  useEffect(() => {
    const generator = new PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const environment = generator.fromScene(room, 0.04).texture;

    setSceneEnvironment(scene, environment);

    return () => {
      if (scene.environment === environment) {
        setSceneEnvironment(scene, null);
      }

      environment.dispose();
      generator.dispose();
    };
  }, [gl, scene]);

  return null;
}

function OpticalBackdrop() {
  const texture = useMemo(() => createOpticalBackdropTexture(), []);

  useEffect(() => {
    return () => texture?.dispose();
  }, [texture]);

  if (!texture) {
    return null;
  }

  return (
    <mesh position={[0, 0, -3.15]} renderOrder={-2}>
      <planeGeometry args={[8.5, 8.5]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.36}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

function Lens({
  controllerRef,
  onSettled,
}: {
  controllerRef: RefObject<DiscController>;
  onSettled: () => void;
}) {
  const groupRef = useRef<Group>(null);
  const lightRef = useRef<PointLight>(null);
  const wasMovingRef = useRef(false);
  const { invalidate } = useThree();
  const lensProfile = useMemo(() => createLensProfile(), []);

  useEffect(() => {
    const controller = controllerRef.current;
    controller.requestFrame = invalidate;
    invalidate();

    return () => {
      if (controller.requestFrame === invalidate) {
        controller.requestFrame = undefined;
      }
    };
  }, [controllerRef, invalidate]);

  useFrame((_state, delta) => {
    const controller = controllerRef.current;
    const continueAnimating = stepDiscPhysics(controller, delta);

    if (controller.pointerDown || continueAnimating) {
      wasMovingRef.current = true;
    }

    if (groupRef.current) {
      groupRef.current.quaternion.copy(controller.orientation);
    }

    if (lightRef.current) {
      lightRef.current.position.x = 3.2 + controller.orientation.y * 1.2;
      lightRef.current.position.y = 3.6 - controller.orientation.x * 0.9;
    }

    if (continueAnimating) {
      invalidate();
    } else if (!controller.pointerDown && wasMovingRef.current) {
      wasMovingRef.current = false;
      onSettled();
    }
  });

  return (
    <>
      <pointLight
        ref={lightRef}
        position={[3.2, 3.6, 4.8]}
        intensity={26}
        color="#fffaf0"
      />
      <pointLight position={[-3.6, -2, 1.6]} intensity={12} color="#b8d8ff" />
      <pointLight position={[0, 2, -2.8]} intensity={18} color="#d7fff7" />

      <group ref={groupRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]} renderOrder={1}>
          <latheGeometry args={[lensProfile, 128]} />
          <meshPhysicalMaterial
            color="#dcf5f2"
            metalness={0}
            roughness={0.042}
            transmission={0.94}
            transparent
            opacity={0.54}
            depthWrite={false}
            ior={1.46}
            thickness={0.58}
            attenuationColor="#d8f5f2"
            attenuationDistance={4.5}
            clearcoat={0.82}
            clearcoatRoughness={0.025}
            specularIntensity={1}
            specularColor="#ffffff"
            envMapIntensity={1.68}
          />
        </mesh>

        <mesh renderOrder={2}>
          <torusGeometry args={[2.326, 0.018, 14, 128]} />
          <meshPhysicalMaterial
            color="#bedfdd"
            metalness={0}
            roughness={0.08}
            transparent
            opacity={0.52}
            depthWrite={false}
            clearcoat={1}
            clearcoatRoughness={0.02}
            envMapIntensity={1.8}
          />
        </mesh>

        <mesh position={[0, 0, 0.032]} rotation={[0, 0, 2.28]} renderOrder={3}>
          <torusGeometry args={[2.304, 0.022, 10, 72, Math.PI * 0.58]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.48}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        <mesh position={[0, 0, -0.026]} rotation={[0, 0, -0.68]} renderOrder={3}>
          <torusGeometry args={[2.308, 0.015, 10, 64, Math.PI * 0.42]} />
          <meshBasicMaterial
            color="#b7e9ec"
            transparent
            opacity={0.34}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>

        <mesh position={[0.72, -0.48, 0.04]} renderOrder={4}>
          <sphereGeometry args={[0.038, 24, 16]} />
          <meshPhysicalMaterial
            color="#c9f24a"
            emissive="#c9f24a"
            emissiveIntensity={0.12}
            roughness={0.08}
            transmission={0.42}
            thickness={0.12}
            ior={1.38}
          />
        </mesh>
      </group>
    </>
  );
}

type GlassLensSceneProps = {
  controllerRef: RefObject<DiscController>;
  onSettled: () => void;
};

export function GlassLensScene({ controllerRef, onSettled }: GlassLensSceneProps) {
  return (
    <Canvas
      aria-hidden="true"
      className={styles.discCanvas}
      camera={CAMERA_CONFIG}
      dpr={DPR_RANGE}
      frameloop="demand"
      gl={GL_CONFIG}
      onCreated={({ gl }) => {
        gl.setClearColor(new Color("#ebeae4"), 0);
        gl.toneMappingExposure = 0.99;
      }}
    >
      <Environment />
      <OpticalBackdrop />
      <ambientLight intensity={0.18} />
      <directionalLight position={[-2, 4, 5]} intensity={1.6} color="#ffffff" />
      <Lens controllerRef={controllerRef} onSettled={onSettled} />
    </Canvas>
  );
}
