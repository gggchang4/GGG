"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef, type RefObject } from "react";
import {
  CanvasTexture,
  Color,
  Group,
  LatheGeometry,
  LinearFilter,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  Vector2,
} from "three";
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
const BACK_DEPTH = -0.2178685;
const RIM_RADIUS = 0.12;
const RIM_CENTER_RADIUS = 2.22;
const RIM_CENTER_DEPTH = -0.0978685;
const RIM_JOIN_ANGLE = (80 * Math.PI) / 180;
const FRONT_JOIN_RADIUS = 2.2408378;
const FRONT_JOIN_DEPTH = 0.0203084;
const FRONT_CURVATURE = 0.039343986;
const RIM_SEGMENTS = 32;
const FRONT_SEGMENTS = 64;

const LENS_VERTEX_SHADER = `
  varying vec3 vViewNormal;
  varying vec3 vViewPosition;
  varying vec3 vObjectPosition;
  varying float vRadius;
  varying float vConvex;

  void main() {
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);

    vViewNormal = normalize(normalMatrix * normal);
    vViewPosition = -viewPosition.xyz;
    vObjectPosition = position;
    vRadius = length(position.xy) / ${LENS_RADIUS.toFixed(2)};
    vConvex = smoothstep(-0.05, 0.28, normal.z);

    gl_Position = projectionMatrix * viewPosition;
  }
`;

const LENS_FRAGMENT_SHADER = `
  uniform sampler2D uBackdrop;
  uniform sampler2D uBackdropBlur;
  uniform vec2 uResolution;
  uniform vec2 uPointer;
  uniform float uEnergy;

  varying vec3 vViewNormal;
  varying vec3 vViewPosition;
  varying vec3 vObjectPosition;
  varying float vRadius;
  varying float vConvex;

  float glassLuminance(vec3 color) {
    return dot(color, vec3(0.2126, 0.7152, 0.0722));
  }

  vec2 safeNormalize(vec2 value) {
    return value / max(length(value), 0.0001);
  }

  void main() {
    vec2 screenUv = gl_FragCoord.xy / max(uResolution, vec2(1.0));
    vec3 normal = normalize(vViewNormal);
    vec3 viewDirection = normalize(vViewPosition);
    float facing = clamp(abs(dot(normal, viewDirection)), 0.0, 1.0);
    float fresnel = pow(1.0 - facing, 2.2);
    float outerBand = smoothstep(0.7, 1.0, vRadius);
    float convexResponse = mix(0.34, 1.0, vConvex);

    float warpStrength =
      (0.0025 + outerBand * 0.026 + fresnel * 0.011) *
      convexResponse *
      (1.0 + uEnergy * 0.22);
    vec2 warp = -normal.xy * warpStrength;
    vec2 refractedUv = clamp(screenUv + warp, vec2(0.002), vec2(0.998));

    vec2 bendDirection = safeNormalize(normal.xy);
    vec2 chromaOffset =
      bendDirection *
      (0.0005 + outerBand * 0.0018 + fresnel * 0.0012) *
      convexResponse;

    vec3 centerSample = texture2D(uBackdrop, refractedUv).rgb;
    vec3 originalSample = texture2D(uBackdrop, screenUv).rgb;
    vec3 chromaticSample = vec3(
      texture2D(uBackdrop, clamp(refractedUv + chromaOffset, vec2(0.002), vec2(0.998))).r,
      centerSample.g,
      texture2D(uBackdrop, clamp(refractedUv - chromaOffset, vec2(0.002), vec2(0.998))).b
    );
    vec3 scatteredSample = texture2D(
      uBackdropBlur,
      clamp(screenUv + warp * 0.58, vec2(0.002), vec2(0.998))
    ).rgb;
    float scatter = 0.11 + outerBand * 0.2 + fresnel * 0.08;
    vec3 refracted = mix(chromaticSample, scatteredSample, scatter);
    float lensingDelta = min(length(chromaticSample - originalSample), 0.16);

    float backgroundLuminance = glassLuminance(refracted);
    vec2 rimDirection = safeNormalize(normal.xy);
    float lightMix = 0.5 + 0.5 * dot(rimDirection, normalize(vec2(-0.72, 0.69)));
    vec3 rimColor = mix(vec3(1.0, 0.89, 0.77), vec3(0.7, 0.92, 0.98), lightMix);

    vec3 lightA = normalize(vec3(-0.48, 0.68, 0.56));
    vec3 lightB = normalize(vec3(0.62, -0.42, 0.66));
    float highlightA = pow(max(dot(reflect(-lightA, normal), viewDirection), 0.0), 34.0);
    float highlightB = pow(max(dot(reflect(-lightB, normal), viewDirection), 0.0), 52.0);
    float edgeLight = pow(fresnel, 1.45);
    float causticBand = exp(-pow((vRadius - 0.91) * 13.5, 2.0));

    vec2 localPosition = vObjectPosition.xy / ${LENS_RADIUS.toFixed(2)};
    vec2 localGlintDelta = localPosition - vec2(-0.24, 0.18);
    float localGlint = exp(-dot(localGlintDelta, localGlintDelta) * 34.0);

    float pointerDistance = distance(screenUv, uPointer);
    float pointerGlow = exp(-pointerDistance * pointerDistance * 24.0) * uEnergy;

    float shadowDirection = smoothstep(
      -0.35,
      0.9,
      dot(rimDirection, normalize(vec2(0.58, -0.82)))
    );
    float adaptiveShadow =
      shadowDirection *
      outerBand *
      mix(0.025, 0.065, 1.0 - backgroundLuminance);

    vec3 color = refracted * (1.0 - adaptiveShadow);
    color += rimColor * (outerBand * 0.065 + edgeLight * 0.115 + lensingDelta * 0.5);
    color += rimColor * causticBand * (0.035 + lightMix * 0.035 + uEnergy * 0.025);
    color += vec3(1.0) * (highlightA * 0.13 + highlightB * 0.075);
    color += vec3(1.0, 0.98, 0.9) * pointerGlow * (0.05 + outerBand * 0.055);
    color += vec3(0.86, 0.98, 1.0) * localGlint * (0.018 + uEnergy * 0.022);

    float alpha =
      0.24 +
      outerBand * 0.42 +
      edgeLight * 0.19 +
      causticBand * 0.07 +
      highlightA * 0.05 +
      pointerGlow * 0.06;

    gl_FragColor = vec4(color, clamp(alpha, 0.26, 0.88));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function createPlanoConvexGeometry() {
  const profile: Vector2[] = [
    new Vector2(0, BACK_DEPTH),
    new Vector2(RIM_CENTER_RADIUS, BACK_DEPTH),
  ];
  const rimAngleRange = RIM_JOIN_ANGLE + Math.PI / 2;

  for (let index = 1; index <= RIM_SEGMENTS; index += 1) {
    const angle = -Math.PI / 2 + rimAngleRange * (index / RIM_SEGMENTS);

    profile.push(
      new Vector2(
        RIM_CENTER_RADIUS + RIM_RADIUS * Math.cos(angle),
        RIM_CENTER_DEPTH + RIM_RADIUS * Math.sin(angle),
      ),
    );
  }

  for (let index = 1; index <= FRONT_SEGMENTS; index += 1) {
    const radius = FRONT_JOIN_RADIUS * (1 - index / FRONT_SEGMENTS);
    const depth =
      FRONT_JOIN_DEPTH +
      FRONT_CURVATURE * (FRONT_JOIN_RADIUS ** 2 - radius ** 2);

    profile.push(new Vector2(radius, depth));
  }

  const geometry = new LatheGeometry(profile, 160);
  geometry.rotateX(Math.PI / 2);
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

function createBackdropTexture(size: number, softened = false) {
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
    size * 0.5,
    size * 0.47,
    0,
    size * 0.5,
    size * 0.48,
    size * 0.61,
  );
  centerGlow.addColorStop(0, "rgba(255, 255, 252, 0.88)");
  centerGlow.addColorStop(0.44, "rgba(249, 249, 245, 0.58)");
  centerGlow.addColorStop(1, "rgba(235, 234, 228, 0)");
  context.fillStyle = centerGlow;
  context.fillRect(0, 0, size, size);

  const coolSpill = context.createRadialGradient(
    size * 0.72,
    size * 0.68,
    0,
    size * 0.72,
    size * 0.68,
    size * 0.31,
  );
  coolSpill.addColorStop(0, "rgba(149, 214, 211, 0.2)");
  coolSpill.addColorStop(0.56, "rgba(178, 217, 224, 0.08)");
  coolSpill.addColorStop(1, "rgba(178, 217, 224, 0)");
  context.fillStyle = coolSpill;
  context.fillRect(0, 0, size, size);

  const warmSpill = context.createRadialGradient(
    size * 0.27,
    size * 0.28,
    0,
    size * 0.27,
    size * 0.28,
    size * 0.25,
  );
  warmSpill.addColorStop(0, "rgba(246, 215, 184, 0.14)");
  warmSpill.addColorStop(1, "rgba(246, 215, 184, 0)");
  context.fillStyle = warmSpill;
  context.fillRect(0, 0, size, size);

  context.lineWidth = softened ? 2 : 1;
  context.strokeStyle = softened
    ? "rgba(20, 21, 18, 0.025)"
    : "rgba(20, 21, 18, 0.045)";

  for (let index = 1; index < 8; index += 1) {
    const position = Math.round((size / 8) * index) + 0.5;
    context.beginPath();
    context.moveTo(position, 0);
    context.lineTo(position, size);
    context.stroke();
  }

  context.lineWidth = softened ? 3 : 1;
  context.strokeStyle = softened
    ? "rgba(20, 21, 18, 0.045)"
    : "rgba(20, 21, 18, 0.11)";
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

function Lens({
  controllerRef,
  onSettled,
  backdrop,
  softenedBackdrop,
}: {
  controllerRef: RefObject<DiscController>;
  onSettled: () => void;
  backdrop: Texture;
  softenedBackdrop: Texture;
}) {
  const groupRef = useRef<Group>(null);
  const materialRef = useRef<ShaderMaterial>(null);
  const wasMovingRef = useRef(false);
  const geometry = useMemo(() => createPlanoConvexGeometry(), []);
  const { gl, invalidate, size } = useThree();
  const uniforms = useMemo(
    () => ({
      uBackdrop: { value: backdrop },
      uBackdropBlur: { value: softenedBackdrop },
      uResolution: { value: new Vector2(1, 1) },
      uPointer: { value: new Vector2(0.5, 0.5) },
      uEnergy: { value: 0 },
    }),
    [backdrop, softenedBackdrop],
  );

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
    gl.getDrawingBufferSize(uniforms.uResolution.value);
    invalidate();
  }, [gl, invalidate, size.height, size.width, uniforms]);

  useEffect(() => {
    return () => geometry.dispose();
  }, [geometry]);

  useFrame((_state, delta) => {
    const controller = controllerRef.current;
    const continueAnimating = stepDiscPhysics(controller, delta);
    const material = materialRef.current;

    if (controller.pointerDown || continueAnimating) {
      wasMovingRef.current = true;
    }

    if (groupRef.current) {
      groupRef.current.quaternion.copy(controller.orientation);
    }

    let materialAnimating = false;

    if (material) {
      const velocityEnergy = Math.min(1, controller.angularVelocity.length() / 6);
      const targetEnergy = Math.max(controller.pointerDown ? 0.72 : 0, velocityEnergy);
      const currentEnergy = material.uniforms.uEnergy.value as number;
      const response = 1 - Math.exp(-(targetEnergy > currentEnergy ? 16 : 6.5) * delta);
      const nextEnergy = currentEnergy + (targetEnergy - currentEnergy) * response;
      const pointer = material.uniforms.uPointer.value as Vector2;
      const pointerTargetX = controller.lastTrackballPoint.x * 0.5 + 0.5;
      const pointerTargetY = controller.lastTrackballPoint.y * 0.5 + 0.5;
      const pointerResponse = 1 - Math.exp(-14 * delta);

      material.uniforms.uEnergy.value = nextEnergy;
      pointer.x += (pointerTargetX - pointer.x) * pointerResponse;
      pointer.y += (pointerTargetY - pointer.y) * pointerResponse;
      materialAnimating =
        Math.abs(targetEnergy - nextEnergy) > 0.004 ||
        Math.abs(pointerTargetX - pointer.x) > 0.002 ||
        Math.abs(pointerTargetY - pointer.y) > 0.002;
    }

    if (!controller.pointerDown && !continueAnimating && wasMovingRef.current) {
      wasMovingRef.current = false;
      onSettled();
    }

    if (continueAnimating || materialAnimating) {
      invalidate();
    }
  });

  return (
    <group ref={groupRef}>
      <mesh geometry={geometry}>
        <shaderMaterial
          ref={materialRef}
          uniforms={uniforms}
          vertexShader={LENS_VERTEX_SHADER}
          fragmentShader={LENS_FRAGMENT_SHADER}
          transparent
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}

function SceneContent({
  controllerRef,
  onSettled,
}: {
  controllerRef: RefObject<DiscController>;
  onSettled: () => void;
}) {
  const backdrop = useMemo(() => createBackdropTexture(512), []);
  const softenedBackdrop = useMemo(() => createBackdropTexture(128, true), []);

  useEffect(() => {
    return () => {
      backdrop?.dispose();
      softenedBackdrop?.dispose();
    };
  }, [backdrop, softenedBackdrop]);

  if (!backdrop || !softenedBackdrop) {
    return null;
  }

  return (
    <Lens
      controllerRef={controllerRef}
      onSettled={onSettled}
      backdrop={backdrop}
      softenedBackdrop={softenedBackdrop}
    />
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
      }}
    >
      <SceneContent controllerRef={controllerRef} onSettled={onSettled} />
    </Canvas>
  );
}
