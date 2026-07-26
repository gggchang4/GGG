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
  Texture,
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

function setSceneEnvironment(scene: Scene, environment: Texture | null) {
  scene.environment = environment;
}

function createBrushedTexture() {
  const size = 512;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = size;
  canvas.height = size;

  if (!context) {
    return null;
  }

  const image = context.createImageData(size, size);
  const center = size / 2;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const radius = Math.hypot(x - center, y - center);
      const grain = Math.sin(radius * 1.7) * 18 + Math.sin(radius * 0.37) * 7;
      const value = Math.max(42, Math.min(214, Math.round(128 + grain)));
      const offset = (y * size + x) * 4;

      image.data[offset] = value;
      image.data[offset + 1] = value;
      image.data[offset + 2] = value;
      image.data[offset + 3] = 255;
    }
  }

  context.putImageData(image, 0, 0);

  const texture = new CanvasTexture(canvas);
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

function Disc({
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
  const brushedTexture = useMemo(() => createBrushedTexture(), []);

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

  useEffect(() => {
    return () => brushedTexture?.dispose();
  }, [brushedTexture]);

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
      lightRef.current.position.x = 2.8 + controller.orientation.y * 5.4;
      lightRef.current.position.y = 3.1 - controller.orientation.x * 4.2;
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
      <pointLight ref={lightRef} position={[2.8, 3.1, 4.2]} intensity={34} color="#fffdf4" />
      <pointLight position={[-3.8, -2.6, 2.2]} intensity={15} color="#b9ccff" />

      <group ref={groupRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[2.38, 2.38, 0.18, 160, 2, false]} />
          <meshPhysicalMaterial
            attach="material-0"
            color="#5d605f"
            metalness={1}
            roughness={0.24}
            clearcoat={0.32}
            clearcoatRoughness={0.18}
          />
          <meshPhysicalMaterial
            attach="material-1"
            color="#bfc2bf"
            bumpMap={brushedTexture ?? undefined}
            bumpScale={0.018}
            metalness={1}
            roughness={0.23}
            clearcoat={0.38}
            clearcoatRoughness={0.16}
            anisotropy={0.72}
          />
          <meshPhysicalMaterial
            attach="material-2"
            color="#898c8a"
            metalness={1}
            roughness={0.28}
          />
        </mesh>

        <mesh position={[0, 0, 0.098]}>
          <ringGeometry args={[2.28, 2.305, 160]} />
          <meshStandardMaterial color="#5a5d5b" metalness={1} roughness={0.38} />
        </mesh>

        {[0.82, 1.24, 1.68, 2.08].map((radius) => (
          <mesh key={radius} position={[0, 0, 0.101]}>
            <ringGeometry args={[radius, radius + 0.006, 160]} />
            <meshBasicMaterial color="#343633" transparent opacity={0.2} />
          </mesh>
        ))}

        <mesh position={[0, 0, 0.108]}>
          <circleGeometry args={[0.125, 64]} />
          <meshPhysicalMaterial
            color="#d6d8d4"
            metalness={1}
            roughness={0.15}
            clearcoat={0.7}
          />
        </mesh>

        <mesh position={[0, 0, 0.115]}>
          <ringGeometry args={[0.035, 0.052, 48]} />
          <meshBasicMaterial color="#c9f24a" toneMapped={false} />
        </mesh>
      </group>
    </>
  );
}

type MetalDiscSceneProps = {
  controllerRef: RefObject<DiscController>;
  onSettled: () => void;
};

export function MetalDiscScene({ controllerRef, onSettled }: MetalDiscSceneProps) {
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
        gl.toneMappingExposure = 1.06;
      }}
    >
      <Environment />
      <ambientLight intensity={0.42} />
      <directionalLight position={[-2, 4, 5]} intensity={3.2} color="#ffffff" />
      <Disc controllerRef={controllerRef} onSettled={onSettled} />
    </Canvas>
  );
}
