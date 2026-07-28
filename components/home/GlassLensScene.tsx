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

const DPR_RANGE: [number, number] = [1, 2];

const GL_CONFIG = {
  alpha: true,
  antialias: true,
  powerPreference: "high-performance" as const,
};

const LENS_RADIUS = 2.34;
const RIM_RADIUS = 0.075;
const RIM_JOIN_ANGLE = (72 * Math.PI) / 180;
const RIM_CENTER_RADIUS = LENS_RADIUS - RIM_RADIUS;
const FRONT_JOIN_RADIUS =
  RIM_CENTER_RADIUS + RIM_RADIUS * Math.cos(RIM_JOIN_ANGLE);
const FRONT_SPHERE_RADIUS = FRONT_JOIN_RADIUS / Math.cos(RIM_JOIN_ANGLE);
const FRONT_SAG =
  FRONT_SPHERE_RADIUS -
  Math.sqrt(FRONT_SPHERE_RADIUS ** 2 - FRONT_JOIN_RADIUS ** 2);
const RIM_RISE = RIM_RADIUS * (1 + Math.sin(RIM_JOIN_ANGLE));
const LENS_DEPTH = RIM_RISE + FRONT_SAG;
const BACK_DEPTH = -LENS_DEPTH / 2;
const RIM_CENTER_DEPTH = BACK_DEPTH + RIM_RADIUS;
const FRONT_JOIN_DEPTH =
  RIM_CENTER_DEPTH + RIM_RADIUS * Math.sin(RIM_JOIN_ANGLE);
const FRONT_CENTER_DEPTH = FRONT_JOIN_DEPTH + FRONT_SAG;

const BACK_BLEND_START = 2.267;
const BACK_BLEND_END = 2.295;
const FRONT_BLEND_START = 2.305;
const FRONT_BLEND_END = 2.27;
const BACK_BLEND_SEGMENTS = 12;
const RIM_SEGMENTS = 28;
const FRONT_BLEND_SEGMENTS = 16;
const FRONT_SEGMENTS = 72;

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
  uniform float uReveal;

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
    float reveal = smoothstep(0.0, 1.0, uReveal);
    float fresnel = pow(1.0 - facing, 2.35);
    float radius = clamp(vRadius, 0.0, 1.12);
    float outerBand = smoothstep(0.62, 1.0, radius);
    float edgeBand = smoothstep(0.78, 1.0, radius);
    float convexResponse = mix(0.42, 1.0, vConvex);

    vec2 fromCenter = screenUv - vec2(0.5);
    vec2 radialDirection = safeNormalize(fromCenter);
    float radialScale =
      (0.028 + outerBand * outerBand * 0.07 + fresnel * 0.014) *
      convexResponse *
      reveal;
    vec2 radialWarp = -fromCenter * radialScale;
    float motionStrength = smoothstep(0.02, 0.82, uEnergy);
    float normalBend =
      (outerBand * 0.018 + fresnel * 0.012) *
      convexResponse *
      motionStrength *
      reveal;

    vec2 pointerDelta = screenUv - uPointer;
    float pointerField = exp(-dot(pointerDelta, pointerDelta) * 17.0) * uEnergy;
    vec2 liquidBend =
      safeNormalize(pointerDelta) *
      pointerField *
      (0.0045 + edgeBand * 0.0045) *
      reveal;
    vec2 warp =
      radialWarp -
      normal.xy * normalBend +
      liquidBend;
    vec2 refractedUv = clamp(screenUv + warp, vec2(0.003), vec2(0.997));

    vec2 dispersionDirection = safeNormalize(warp);
    vec2 chromaOffset = warp * 0.05;

    vec3 centerSample = texture2D(uBackdrop, refractedUv).rgb;
    vec3 chromaticSample = vec3(
      texture2D(uBackdrop, clamp(refractedUv + chromaOffset, vec2(0.003), vec2(0.997))).r,
      centerSample.g,
      texture2D(uBackdrop, clamp(refractedUv - chromaOffset, vec2(0.003), vec2(0.997))).b
    );
    vec2 tangent = vec2(-dispersionDirection.y, dispersionDirection.x);
    vec2 scatterOffset = tangent * (length(warp) * 0.055 + edgeBand * 0.0015);
    vec3 softA = texture2D(uBackdropBlur, clamp(refractedUv + scatterOffset, vec2(0.003), vec2(0.997))).rgb;
    vec3 softB = texture2D(uBackdropBlur, clamp(refractedUv - scatterOffset, vec2(0.003), vec2(0.997))).rgb;
    float scatter = edgeBand * 0.18 + fresnel * 0.07;
    vec3 refracted = mix(chromaticSample, (softA + softB) * 0.5, scatter);
    vec3 originalSample = texture2D(uBackdrop, screenUv).rgb;
    float lensingDelta = min(length(chromaticSample - originalSample), 0.24);

    float backgroundLuminance = glassLuminance(refracted);
    float brightBg = smoothstep(0.68, 0.94, backgroundLuminance);
    float ink = 1.0 - smoothstep(0.17, 0.66, backgroundLuminance);
    vec2 rimDirection = safeNormalize(normal.xy + radialDirection * 0.35);
    float lightMix = 0.5 + 0.5 * dot(rimDirection, normalize(vec2(-0.72, 0.69)));
    vec3 rimColor = mix(vec3(1.0, 0.69, 0.55), vec3(0.43, 0.86, 0.96), lightMix);

    vec3 lightA = normalize(vec3(-0.48, 0.68, 0.56));
    vec3 lightB = normalize(vec3(0.62, -0.42, 0.66));
    float highlightA = pow(max(dot(reflect(-lightA, normal), viewDirection), 0.0), 30.0);
    float highlightB = pow(max(dot(reflect(-lightB, normal), viewDirection), 0.0), 48.0);
    float edgeLight = pow(fresnel, 1.32);
    float outerCaustic = exp(-pow((radius - 0.935) * 21.0, 2.0));
    float innerCaustic = exp(-pow((radius - 0.82) * 11.5, 2.0));

    vec2 localPosition = vObjectPosition.xy / ${LENS_RADIUS.toFixed(2)};
    vec2 localGlintDelta = localPosition - vec2(-0.27, 0.22);
    float localGlint = exp(-dot(localGlintDelta, localGlintDelta) * 27.0);

    float interior = 1.0 - smoothstep(0.80, 0.985, radius);
    vec2 qPeach = (localPosition - vec2(-0.34, 0.22)) * vec2(1.06, 1.46);
    vec2 qViolet = (localPosition - vec2(0.10, 0.34)) * vec2(1.38, 1.62);
    vec2 qAqua = (localPosition - vec2(0.34, -0.22)) * vec2(1.06, 1.42);
    float peach = exp(-dot(qPeach, qPeach) * 3.5) * interior;
    float violet = exp(-dot(qViolet, qViolet) * 4.0) * interior;
    float aqua = exp(-dot(qAqua, qAqua) * 3.35) * interior;
    float peachArc =
      outerCaustic *
      pow(max(dot(rimDirection, normalize(vec2(-0.78, 0.62))), 0.0), 2.8);
    float violetArc =
      outerCaustic *
      pow(max(dot(rimDirection, normalize(vec2(0.30, 0.95))), 0.0), 3.4);
    float aquaArc =
      outerCaustic *
      pow(max(dot(rimDirection, normalize(vec2(0.78, -0.62))), 0.0), 2.8);
    float peachWeight = peach * 0.62 + peachArc * 1.2;
    float violetWeight = violet * 0.54 + violetArc * 1.15;
    float aquaWeight = aqua * 0.64 + aquaArc * 1.2;
    float spectralWeight = peachWeight + violetWeight + aquaWeight;
    vec3 spectralColor = (
      peachWeight * vec3(1.0, 0.64, 0.48) +
      violetWeight * vec3(0.61, 0.55, 0.98) +
      aquaWeight * vec3(0.28, 0.86, 0.91)
    ) / max(spectralWeight, 0.001);
    float spectralMix =
      clamp(spectralWeight, 0.0, 1.0) *
      mix(0.14, 0.27, brightBg) *
      (0.72 + reveal * 0.28) *
      (1.0 + uEnergy * 0.2);

    float pointerGlow = pointerField * (0.56 + outerBand * 0.44);
    float shadowDirection = smoothstep(
      -0.45,
      0.92,
      dot(rimDirection, normalize(vec2(0.58, -0.82)))
    );
    float adaptiveShadow =
      (outerBand * (0.3 + shadowDirection * 0.7) + innerCaustic * 0.52) *
      mix(0.03, 0.14, brightBg) *
      reveal;
    float directionalInnerRim =
      exp(-pow((radius - 0.865) * 15.0, 2.0)) *
      (0.28 + shadowDirection * 0.72) *
      reveal;
    float whiteLightGain = mix(1.0, 0.61, brightBg);

    vec3 color = refracted * (1.0 - adaptiveShadow);
    color *= 1.0 - directionalInnerRim * mix(0.045, 0.105, brightBg);
    color = mix(color, spectralColor, spectralMix * reveal);
    color +=
      rimColor *
      (outerBand * 0.065 + edgeLight * 0.15 + lensingDelta * 0.42) *
      whiteLightGain *
      reveal;
    color +=
      rimColor *
      outerCaustic *
      (0.082 + lightMix * 0.072 + uEnergy * 0.032) *
      whiteLightGain *
      reveal;
    color +=
      vec3(1.0) *
      (highlightA * 0.18 + highlightB * 0.09) *
      whiteLightGain *
      reveal;
    color +=
      vec3(1.0, 0.95, 0.88) *
      pointerGlow *
      (0.025 + outerBand * 0.06) *
      reveal;
    color +=
      vec3(0.83, 0.98, 1.0) *
      localGlint *
      (0.022 + uEnergy * 0.03) *
      whiteLightGain *
      reveal;
    color *= 1.0 - ink * edgeBand * 0.028;

    float alpha =
      0.965 +
      outerBand * 0.022 +
      outerCaustic * 0.008 +
      ink * 0.005;

    gl_FragColor = vec4(color, clamp(alpha, 0.965, 0.998));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function smootherstep(value: number) {
  return value ** 3 * (value * (value * 6 - 15) + 10);
}

function lowerRimDepth(radius: number) {
  const radialOffset = radius - RIM_CENTER_RADIUS;
  return (
    RIM_CENTER_DEPTH -
    Math.sqrt(Math.max(0, RIM_RADIUS ** 2 - radialOffset ** 2))
  );
}

function upperRimDepth(radius: number) {
  const radialOffset = radius - RIM_CENTER_RADIUS;
  return (
    RIM_CENTER_DEPTH +
    Math.sqrt(Math.max(0, RIM_RADIUS ** 2 - radialOffset ** 2))
  );
}

function frontSphereDepth(radius: number) {
  return (
    FRONT_CENTER_DEPTH -
    FRONT_SPHERE_RADIUS +
    Math.sqrt(Math.max(0, FRONT_SPHERE_RADIUS ** 2 - radius ** 2))
  );
}

function createPlanoConvexGeometry() {
  const profile: Vector2[] = [
    new Vector2(0, BACK_DEPTH),
    new Vector2(BACK_BLEND_START, BACK_DEPTH),
  ];

  for (let index = 1; index <= BACK_BLEND_SEGMENTS; index += 1) {
    const progress = index / BACK_BLEND_SEGMENTS;
    const radius =
      BACK_BLEND_START + (BACK_BLEND_END - BACK_BLEND_START) * progress;
    const depth =
      BACK_DEPTH +
      (lowerRimDepth(radius) - BACK_DEPTH) * smootherstep(progress);

    profile.push(new Vector2(radius, depth));
  }

  const lowerRimAngle = -Math.acos(
    (BACK_BLEND_END - RIM_CENTER_RADIUS) / RIM_RADIUS,
  );
  const upperRimAngle = Math.acos(
    (FRONT_BLEND_START - RIM_CENTER_RADIUS) / RIM_RADIUS,
  );
  const halfRimSegments = RIM_SEGMENTS / 2;

  for (let index = 1; index <= halfRimSegments; index += 1) {
    const angle = lowerRimAngle * (1 - index / halfRimSegments);

    profile.push(
      new Vector2(
        RIM_CENTER_RADIUS + RIM_RADIUS * Math.cos(angle),
        RIM_CENTER_DEPTH + RIM_RADIUS * Math.sin(angle),
      ),
    );
  }

  for (let index = 1; index <= halfRimSegments; index += 1) {
    const angle = upperRimAngle * (index / halfRimSegments);

    profile.push(
      new Vector2(
        RIM_CENTER_RADIUS + RIM_RADIUS * Math.cos(angle),
        RIM_CENTER_DEPTH + RIM_RADIUS * Math.sin(angle),
      ),
    );
  }

  for (let index = 1; index <= FRONT_BLEND_SEGMENTS; index += 1) {
    const progress = index / FRONT_BLEND_SEGMENTS;
    const radius =
      FRONT_BLEND_START - (FRONT_BLEND_START - FRONT_BLEND_END) * progress;
    const depth =
      upperRimDepth(radius) +
      (frontSphereDepth(radius) - upperRimDepth(radius)) *
        smootherstep(progress);

    profile.push(new Vector2(radius, depth));
  }

  for (let index = 1; index <= FRONT_SEGMENTS; index += 1) {
    const radius = FRONT_BLEND_END * (1 - index / FRONT_SEGMENTS);
    const depth = frontSphereDepth(radius);

    profile.push(new Vector2(radius, depth));
  }

  const geometry = new LatheGeometry(profile, 160);
  geometry.rotateX(Math.PI / 2);
  geometry.center();
  geometry.computeVertexNormals();
  return geometry;
}

function getSignatureFontFamily() {
  const configuredFamily = getComputedStyle(document.body)
    .getPropertyValue("--font-signature")
    .trim();

  return configuredFamily || "Georgia, serif";
}

function drawTrackedSignature(
  context: CanvasRenderingContext2D,
  size: number,
  softened: boolean,
) {
  const lines = ["GGG", "Cheese"];
  const maximumWidth = size * 0.62;
  let fontSize = size * 0.17;
  let tracking = size * 0.007;
  const family = getSignatureFontFamily();

  context.save();
  context.font = `600 ${fontSize}px ${family}`;
  context.textBaseline = "alphabetic";
  context.fillStyle = softened ? "rgba(16, 17, 15, 0.9)" : "rgba(13, 14, 12, 0.99)";
  context.filter = softened ? `blur(${Math.max(1, size * 0.006)}px)` : "none";

  const measureLine = (line: string) => {
    const characters = Array.from(line);
    const widths = characters.map((character) => context.measureText(character).width);
    const width =
      widths.reduce((total, characterWidth) => total + characterWidth, 0) +
      tracking * (characters.length - 1);

    return { characters, widths, width };
  };

  let measuredLines = lines.map(measureLine);
  const widestLine = Math.max(...measuredLines.map(({ width }) => width));

  if (widestLine > maximumWidth) {
    const scale = maximumWidth / widestLine;
    fontSize *= scale;
    tracking *= scale;
    context.font = `600 ${fontSize}px ${family}`;
    measuredLines = lines.map(measureLine);
  }

  const lineMetrics = lines.map((line) => {
    const metrics = context.measureText(line);
    return {
      ascent: metrics.actualBoundingBoxAscent || fontSize * 0.75,
      descent: metrics.actualBoundingBoxDescent || fontSize * 0.2,
    };
  });
  const lineGap = size * 0.035;
  const blockHeight =
    lineMetrics.reduce(
      (total, { ascent, descent }) => total + ascent + descent,
      0,
    ) + lineGap;
  let lineTop = (size - blockHeight) / 2;

  measuredLines.forEach(({ characters, widths, width }, lineIndex) => {
    const { ascent, descent } = lineMetrics[lineIndex];
    const baseline = lineTop + ascent;
    let cursor = (size - width) / 2;

    characters.forEach((character, characterIndex) => {
      context.fillText(character, cursor, baseline);
      cursor += widths[characterIndex] + tracking;
    });

    lineTop += ascent + descent + lineGap;
  });
  context.restore();
}

function paintBackdrop(
  context: CanvasRenderingContext2D,
  size: number,
  softened: boolean,
) {
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
  centerGlow.addColorStop(0, "rgba(255, 255, 252, 0.96)");
  centerGlow.addColorStop(0.42, "rgba(249, 249, 245, 0.68)");
  centerGlow.addColorStop(1, "rgba(235, 234, 228, 0)");
  context.fillStyle = centerGlow;
  context.fillRect(0, 0, size, size);

  const coolSpill = context.createRadialGradient(
    size * 0.72,
    size * 0.68,
    0,
    size * 0.72,
    size * 0.68,
    size * 0.34,
  );
  coolSpill.addColorStop(0, "rgba(127, 211, 216, 0.4)");
  coolSpill.addColorStop(0.56, "rgba(178, 217, 224, 0.09)");
  coolSpill.addColorStop(1, "rgba(178, 217, 224, 0)");
  context.fillStyle = coolSpill;
  context.fillRect(0, 0, size, size);

  const warmSpill = context.createRadialGradient(
    size * 0.28,
    size * 0.3,
    0,
    size * 0.28,
    size * 0.3,
    size * 0.29,
  );
  warmSpill.addColorStop(0, "rgba(249, 187, 152, 0.35)");
  warmSpill.addColorStop(1, "rgba(246, 215, 184, 0)");
  context.fillStyle = warmSpill;
  context.fillRect(0, 0, size, size);

  const violetSpill = context.createRadialGradient(
    size * 0.61,
    size * 0.28,
    0,
    size * 0.61,
    size * 0.28,
    size * 0.25,
  );
  violetSpill.addColorStop(0, "rgba(172, 155, 244, 0.3)");
  violetSpill.addColorStop(1, "rgba(177, 163, 244, 0)");
  context.fillStyle = violetSpill;
  context.fillRect(0, 0, size, size);

  drawTrackedSignature(context, size, softened);
}

function createBackdropTexture(size: number, softened = false) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  paintBackdrop(context, size, softened);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

function Lens({
  controllerRef,
  onSettled,
  backdrop,
  softenedBackdrop,
  reducedMotion,
}: {
  controllerRef: RefObject<DiscController>;
  onSettled: () => void;
  backdrop: Texture;
  softenedBackdrop: Texture;
  reducedMotion: boolean;
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
      uReveal: { value: reducedMotion ? 1 : 0 },
    }),
    [backdrop, reducedMotion, softenedBackdrop],
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
      const targetEnergy = reducedMotion
        ? 0
        : Math.max(controller.pointerDown ? 0.82 : 0, velocityEnergy);
      const currentEnergy = material.uniforms.uEnergy.value as number;
      const response = 1 - Math.exp(-(targetEnergy > currentEnergy ? 16 : 6.5) * delta);
      let nextEnergy = currentEnergy + (targetEnergy - currentEnergy) * response;

      if (targetEnergy === 0 && nextEnergy < 0.004) {
        nextEnergy = 0;
      }
      const currentReveal = material.uniforms.uReveal.value as number;
      const nextReveal = reducedMotion
        ? 1
        : currentReveal + (1 - currentReveal) * (1 - Math.exp(-3.4 * delta));
      const pointer = material.uniforms.uPointer.value as Vector2;
      const pointerTargetX = controller.lastTrackballPoint.x * 0.5 + 0.5;
      const pointerTargetY = controller.lastTrackballPoint.y * 0.5 + 0.5;
      const pointerResponse = 1 - Math.exp(-14 * delta);

      material.uniforms.uEnergy.value = nextEnergy;
      material.uniforms.uReveal.value = nextReveal;
      pointer.x += (pointerTargetX - pointer.x) * pointerResponse;
      pointer.y += (pointerTargetY - pointer.y) * pointerResponse;
      materialAnimating =
        Math.abs(targetEnergy - nextEnergy) > 0.004 ||
        Math.abs(1 - nextReveal) > 0.002 ||
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
  reducedMotion,
}: {
  controllerRef: RefObject<DiscController>;
  onSettled: () => void;
  reducedMotion: boolean;
}) {
  const backdrop = useMemo(() => createBackdropTexture(1024), []);
  const softenedBackdrop = useMemo(() => createBackdropTexture(384, true), []);
  const { invalidate } = useThree();

  useEffect(() => {
    let cancelled = false;

    void document.fonts.ready.then(() => {
      if (cancelled) {
        return;
      }

      const textureLayers = [
        { texture: backdrop, softened: false },
        { texture: softenedBackdrop, softened: true },
      ];

      textureLayers.forEach(({ texture, softened }) => {
        if (!texture) {
          return;
        }

        const canvas = texture.image as HTMLCanvasElement | undefined;
        const context = canvas?.getContext("2d");

        if (!canvas || !context) {
          return;
        }

        paintBackdrop(context, canvas.width, Boolean(softened));
        texture.needsUpdate = true;
      });

      invalidate();
    });

    return () => {
      cancelled = true;
    };
  }, [backdrop, invalidate, softenedBackdrop]);

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
      reducedMotion={reducedMotion}
    />
  );
}

type GlassLensSceneProps = {
  controllerRef: RefObject<DiscController>;
  onSettled: () => void;
  reducedMotion: boolean;
};

export function GlassLensScene({
  controllerRef,
  onSettled,
  reducedMotion,
}: GlassLensSceneProps) {
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
      <SceneContent
        controllerRef={controllerRef}
        onSettled={onSettled}
        reducedMotion={reducedMotion}
      />
    </Canvas>
  );
}
