"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Mesh } from "three";

function FloatingObject() {
  const coreRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);

  useFrame(({ clock, pointer }) => {
    const elapsed = clock.getElapsedTime();

    if (coreRef.current) {
      coreRef.current.rotation.x = elapsed * 0.28 + pointer.y * 0.18;
      coreRef.current.rotation.y = elapsed * 0.36 + pointer.x * 0.18;
    }

    if (ringRef.current) {
      ringRef.current.rotation.z = elapsed * 0.22;
      ringRef.current.rotation.x = Math.PI / 2 + pointer.y * 0.12;
    }
  });

  return (
    <group>
      <mesh ref={coreRef}>
        <icosahedronGeometry args={[1.18, 2]} />
        <meshStandardMaterial color="#d7ff69" metalness={0.2} roughness={0.32} wireframe />
      </mesh>
      <mesh ref={ringRef}>
        <torusGeometry args={[1.74, 0.012, 16, 128]} />
        <meshStandardMaterial color="#66e3ff" emissive="#66e3ff" emissiveIntensity={0.18} />
      </mesh>
      <mesh rotation={[0.8, 0.2, 0.4]}>
        <torusGeometry args={[2.05, 0.006, 12, 128]} />
        <meshStandardMaterial color="#f5f5f0" transparent opacity={0.42} />
      </mesh>
    </group>
  );
}

export function HeroScene() {
  return (
    <div className="relative h-full min-h-96 overflow-hidden rounded-md bg-[linear-gradient(180deg,var(--surface),var(--background))]">
      <div className="absolute inset-6 rounded-full border border-primary/20" />
      <div className="absolute inset-14 rounded-full border border-accent/20" />
      <div className="absolute left-1/2 top-1/2 size-32 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-primary/40 bg-primary/5" />
      <Canvas className="relative" camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 1.5]}>
        <ambientLight intensity={0.8} />
        <directionalLight position={[3, 4, 5]} intensity={1.8} />
        <pointLight position={[-3, -2, 3]} color="#66e3ff" intensity={2.6} />
        <FloatingObject />
      </Canvas>
    </div>
  );
}
