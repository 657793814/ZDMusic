"use client";

import * as THREE from "three";
import { useEffect, useRef } from "react";
import { gridForResolution, type StagePreset, type StageVisualSettings } from "@/app/lib/stageVisual";

type Palette = { primary: string; secondary: string };

export type StageStats = {
  fps: number;
  particles: number;
  drawCalls: number;
  geometries: number;
  textures: number;
  bass: number;
  mid: number;
  high: number;
};

const BASE_SIZE = 4.8;
const CAMERA_FOV = 45;
const CAMERA_RADIUS = 6.6;

const vertexShader = `
precision highp float;

uniform float uTime;
uniform float uSpeed;
uniform float uDepth;
uniform float uIntensity;
uniform float uPointScale;
uniform float uTwist;
uniform float uScatter;
uniform float uPreset;
uniform float uBass;
uniform float uMid;
uniform float uHigh;
uniform float uEdge;
uniform float uPixel;
uniform float uSizeMul;
uniform float uPlanetRadius;
uniform float uPlanetSpin;
uniform float uRingRadius;
uniform float uRingWidth;
uniform float uPetals;
uniform float uPetalDepth;
uniform sampler2D uDepthTex;

attribute vec2 aUv;
attribute float aRand;

varying vec2 vUv;
varying float vLum;
varying float vEdge;
varying float vRand;

mat2 rot(float a) {
  float c = cos(a);
  float s = sin(a);
  return mat2(c, -s, s, c);
}

void main() {
  vUv = aUv;
  vRand = aRand;

  vec4 dt = texture2D(uDepthTex, aUv);
  float lum = dt.r;
  float edge = dt.g;
  vLum = lum;
  vEdge = edge;

  float t = uTime * uSpeed * (1.0 + uMid * 0.55);
  float rr = length(aUv - 0.5) * 2.0;
  float ang = atan(aUv.y - 0.5, aUv.x - 0.5);

  vec2 base = (aUv - 0.5) * ${BASE_SIZE.toFixed(1)};
  vec3 p = vec3(base, 0.0);

  float depthZ = (lum - 0.46) * uDepth * 2.2;
  float edgeZ = edge * uDepth * 1.1 * uEdge;
  float wave = sin(rr * 7.0 - t * 1.0 + aRand * 0.7) * 0.22 * uIntensity;
  float ripple = sin(rr * 15.0 - t * 1.9) * 0.10 * (0.4 + uBass * 1.4) * uIntensity;
  float audio = (uBass * 0.5 + uMid * 0.22) * sin(aRand * 6.283 + t * 1.4) * uIntensity;

  p.xy = rot(uTwist * (0.9 - rr * 0.5)) * p.xy;

  if (uPreset < 0.5) {
    p.z = depthZ + edgeZ + wave + ripple + audio * 0.4;
    p.xy += vec2(sin(aRand * 9.0 + t * 0.6), cos(aRand * 7.0 + t * 0.5)) * uScatter * 0.55;
  } else if (uPreset < 1.5) {
    float phi = aUv.y * 3.14159265;
    float theta = aUv.x * 6.2831853 + t * (0.06 + uPlanetSpin * 0.22);
    float rad = uPlanetRadius + depthZ * 0.65 + edgeZ * 0.35 + wave * 0.22 + uBass * 0.10;
    p.x = sin(phi) * cos(theta) * rad;
    p.y = cos(phi) * rad;
    p.z = sin(phi) * sin(theta) * rad;
  } else if (uPreset < 2.5) {
    float discR = 0.76;
    if (rr < discR) {
      p.xy = (aUv - 0.5) * ${BASE_SIZE.toFixed(1)} * 0.92;
      p.z = depthZ * 0.5 + wave * 0.16;
    } else {
      float band = uRingRadius + (rr - discR) / 0.65 * uRingWidth + sin(ang * 2.0 + t * 0.5) * 0.03;
      p.x = cos(ang) * band;
      p.y = sin(ang) * band;
      p.z = sin(ang * 2.0 + t * 0.5) * 0.08 + ripple * 0.5 + uBass * 0.06;
    }
  } else {
    // 深海绽放：花瓣直接体现在半径上，正面也能看出花形
    if (rr > 1.0) {
      gl_PointSize = 0.0;
      gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
      return;
    }
    float petalPhase = ang * uPetals + t * 0.5;
    float petalR = 0.94 + 0.11 * sin(petalPhase) + 0.05 * sin(ang * (uPetals * 2.0) - t * 0.3);
    float breathing = 1.0 + uBass * 0.18 + wave * 0.14;
    vec2 dir = vec2(cos(ang), sin(ang));
    p.xy = dir * (rr * petalR * breathing) * (${BASE_SIZE.toFixed(1)} * 0.46);
    p.z = (lum - 0.4) * uDepth * 0.9 + sin(petalPhase) * uPetalDepth * (0.6 + uBass) + audio * 0.35;
    p.xy += dir * uScatter * 0.4;
    p.xy = rot(t * 0.05) * p.xy;
  }

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  float size = (2.2 + aRand * 2.6) * uPointScale * uSizeMul * (0.62 + lum * 0.72);
  gl_PointSize = clamp(size * uPixel * (3.4 / max(2.2, -mv.z)), 1.2, 26.0);
}
`;

const fragmentShader = `
precision highp float;

uniform sampler2D uCoverTex;
uniform vec3 uTintA;
uniform vec3 uTintB;
uniform float uColorBoost;
uniform float uLayer;
uniform float uBloom;
uniform float uPreset;
uniform float uTime;
uniform float uHigh;
uniform float uGlowBoost;

varying vec2 vUv;
varying float vLum;
varying float vEdge;
varying float vRand;

void main() {
  vec2 uv = vUv;
  vec3 base = texture2D(uCoverTex, uv).rgb * uColorBoost;
  vec3 col = base;

  if (uPreset < 0.5) {
    col = mix(base, uTintA, 0.14);
  } else if (uPreset < 1.5) {
    col = mix(base, uTintA, 0.26);
  } else if (uPreset < 2.5) {
    float rr = length(vUv - 0.5) * 2.0;
    if (rr > 0.76) {
      col = mix(vec3(1.0, 0.87, 0.62), base, 0.22) * 1.15;
    } else {
      col = mix(base, uTintB, 0.1) * 0.95;
    }
  } else {
    col = mix(base, uTintB, 0.42) * (1.0 + vEdge * 0.6);
  }

  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;

  float alpha = smoothstep(0.5, 0.10, d) * (0.46 + vLum * 0.50 + vEdge * 0.42);
  if (uLayer > 0.5) {
    alpha *= uBloom * 0.5 * (1.0 + uGlowBoost * 0.9);
  }

  // 高频：细碎闪动 + 微粒高光
  float tw = 0.5 + 0.5 * sin(uTime * 18.0 + vRand * 97.0 + vUv.x * 20.0);
  float sparkle = uHigh * (0.35 + tw * 0.65);
  alpha *= 1.0 + sparkle * (uLayer > 0.5 ? 0.35 : 0.6);
  col += vec3(0.5, 0.56, 0.62) * sparkle * 0.45;

  gl_FragColor = vec4(col, alpha);
}
`;

const starVertexShader = `
precision highp float;

uniform float uTime;
uniform float uBass;
uniform float uPixel;
uniform float uPointScale;
uniform vec3 uTintA;
uniform vec3 uTintB;

attribute float aSeed;
attribute float aLane;
attribute float aDepth;

varying float vAlpha;
varying vec3 vColor;

void main() {
  vec3 p = position;
  p.x += sin(uTime * 0.05 + aSeed * 6.283) * 1.4;
  p.y += cos(uTime * 0.04 + aSeed * 3.1) * 0.9;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  float tw = 0.5 + 0.5 * sin(uTime * (0.28 + aSeed * 0.4) + aSeed * 20.0);
  gl_PointSize = clamp((1.2 + aSeed * 2.6) * uPixel * (4.0 / max(1.0, -mv.z)) * uPointScale, 0.6, 8.0);
  vAlpha = (0.12 + tw * 0.42 + uBass * 0.15) * (0.45 + aDepth * 0.9);
  vColor = mix(uTintA, uTintB, aLane) * (0.7 + tw * 0.5);
}
`;

const starFragmentShader = `
precision highp float;

varying float vAlpha;
varying vec3 vColor;

void main() {
  float d = length(gl_PointCoord - 0.5);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d) * vAlpha;
  gl_FragColor = vec4(vColor, a);
}
`;

function hash(x: number, y: number) {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

function buildGridGeometry(grid: number) {
  const count = grid * grid;
  const position = new Float32Array(count * 3);
  const uv = new Float32Array(count * 2);
  const rand = new Float32Array(count);

  let index = 0;
  for (let y = 0; y < grid; y += 1) {
    for (let x = 0; x < grid; x += 1) {
      const u = x / (grid - 1);
      const v = y / (grid - 1);
      position[index * 3] = (u - 0.5) * BASE_SIZE;
      position[index * 3 + 1] = (v - 0.5) * BASE_SIZE;
      position[index * 3 + 2] = 0;
      uv[index * 2] = u;
      uv[index * 2 + 1] = v;
      rand[index] = hash(x, y);
      index += 1;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("aUv", new THREE.BufferAttribute(uv, 2));
  geometry.setAttribute("aRand", new THREE.BufferAttribute(rand, 1));
  return geometry;
}

function buildStarGeometry(count: number) {
  const position = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const lanes = new Float32Array(count);
  const depths = new Float32Array(count);

  for (let i = 0; i < count; i += 1) {
    const seed = hash(i, 7);
    const lane = hash(i, 13);
    const depth = hash(i, 21);
    position[i * 3] = (hash(i, 5) - 0.5) * 44;
    position[i * 3 + 1] = (hash(i, 11) - 0.5) * 26;
    position[i * 3 + 2] = -30 + depth * 26;
    seeds[i] = seed;
    lanes[i] = lane;
    depths[i] = depth;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aLane", new THREE.BufferAttribute(lanes, 1));
  geometry.setAttribute("aDepth", new THREE.BufferAttribute(depths, 1));
  return geometry;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function makeFallbackCover(primary: string, secondary: string) {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const bg = ctx.createRadialGradient(size * 0.32, size * 0.3, 0, size * 0.5, size * 0.5, size * 0.72);
  bg.addColorStop(0, primary);
  bg.addColorStop(0.45, "#10141b");
  bg.addColorStop(1, "#05070a");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  ctx.globalAlpha = 0.72;
  ctx.strokeStyle = secondary;
  for (let i = 1; i <= 7; i += 1) {
    ctx.lineWidth = i % 2 === 0 ? 1.6 : 0.8;
    ctx.beginPath();
    ctx.arc(size * 0.5, size * 0.5, (size * 0.46 * i) / 7, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 中心提亮：无封面时也给点云足够的亮度层次
  const glow = ctx.createRadialGradient(
    size * 0.46,
    size * 0.42,
    0,
    size * 0.5,
    size * 0.5,
    size * 0.62,
  );
  glow.addColorStop(0, "rgba(255, 255, 255, 0.62)");
  glow.addColorStop(0.34, "rgba(255, 255, 255, 0.16)");
  glow.addColorStop(1, "rgba(255, 255, 255, 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, size, size);

  const sheen = ctx.createLinearGradient(0, 0, size, size);
  sheen.addColorStop(0, "rgba(255,255,255,0.10)");
  sheen.addColorStop(0.5, "rgba(255,255,255,0)");
  sheen.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, size, size);

  return canvas;
}

function makeTextures(source: CanvasImageSource, depthSource?: CanvasImageSource) {
  const coverSize = 320;
  const coverCanvas = document.createElement("canvas");
  coverCanvas.width = coverSize;
  coverCanvas.height = coverSize;
  const coverCtx = coverCanvas.getContext("2d");
  if (!coverCtx) return null;

  const sw = (source as HTMLImageElement).width || coverSize;
  const sh = (source as HTMLImageElement).height || coverSize;
  const side = Math.min(sw, sh);
  coverCtx.drawImage(source, (sw - side) / 2, (sh - side) / 2, side, side, 0, 0, coverSize, coverSize);

  const depthSize = 256;
  const depthCanvas = document.createElement("canvas");
  depthCanvas.width = depthSize;
  depthCanvas.height = depthSize;
  const depthCtx = depthCanvas.getContext("2d");
  if (!depthCtx) return null;
  depthCtx.drawImage(depthSource ?? coverCanvas, 0, 0, depthSize, depthSize);

  const pixels = depthCtx.getImageData(0, 0, depthSize, depthSize).data;
  const lum = new Float32Array(depthSize * depthSize);
  for (let i = 0; i < lum.length; i += 1) {
    lum[i] = (0.2126 * pixels[i * 4] + 0.7152 * pixels[i * 4 + 1] + 0.0722 * pixels[i * 4 + 2]) / 255;
  }

  // 3x3 均值把亮度压成平滑深度，避免点云出现阶梯
  const blurred = new Float32Array(lum.length);
  for (let y = 0; y < depthSize; y += 1) {
    for (let x = 0; x < depthSize; x += 1) {
      let sum = 0;
      let n = 0;
      for (let dy = -1; dy <= 1; dy += 1) {
        for (let dx = -1; dx <= 1; dx += 1) {
          const px = x + dx;
          const py = y + dy;
          if (px < 0 || py < 0 || px >= depthSize || py >= depthSize) continue;
          sum += lum[py * depthSize + px];
          n += 1;
        }
      }
      blurred[y * depthSize + x] = sum / n;
    }
  }

  // Sobel 边缘：给轮廓一点额外起伏
  const out = new Uint8Array(depthSize * depthSize * 4);
  for (let y = 0; y < depthSize; y += 1) {
    for (let x = 0; x < depthSize; x += 1) {
      const at = (px: number, py: number) => {
        const cx = Math.min(depthSize - 1, Math.max(0, px));
        const cy = Math.min(depthSize - 1, Math.max(0, py));
        return blurred[cy * depthSize + cx];
      };
      const gx = at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1)
        - at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1);
      const gy = at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1)
        - at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1);
      const edge = Math.min(1, Math.sqrt(gx * gx + gy * gy) * 2.2);
      const index = (y * depthSize + x) * 4;
      out[index] = Math.round(blurred[y * depthSize + x] * 255);
      out[index + 1] = Math.round(edge * 255);
      out[index + 2] = 0;
      out[index + 3] = 255;
    }
  }

  const coverTexture = new THREE.CanvasTexture(coverCanvas);
  coverTexture.colorSpace = THREE.SRGBColorSpace;
  coverTexture.minFilter = THREE.LinearFilter;
  coverTexture.magFilter = THREE.LinearFilter;

  const depthTexture = new THREE.DataTexture(out, depthSize, depthSize, THREE.RGBAFormat);
  depthTexture.minFilter = THREE.LinearFilter;
  depthTexture.magFilter = THREE.LinearFilter;
  depthTexture.needsUpdate = true;

  return { coverTexture, depthTexture };
}

export function Stage3D({
  coverUrl,
  depthMapUrl,
  palette,
  analyser,
  playing,
  active,
  settings,
  onFail,
  onStats,
}: {
  coverUrl: string | null;
  /** 预留：外部 AI 深度图（灰度 PNG/JPEG）。为空时用封面亮度启发式 */
  depthMapUrl?: string | null;
  palette: Palette;
  analyser: AnalyserNode | null;
  playing: boolean;
  active: boolean;
  settings: StageVisualSettings;
  onFail: () => void;
  onStats: (stats: StageStats) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef(settings);
  const playingRef = useRef(playing);
  const activeRef = useRef(active);
  const analyserRef = useRef(analyser);
  const depthMapRef = useRef(depthMapUrl);
  const statsRef = useRef(onStats);
  const apiRef = useRef<{
    render: () => void;
    start: () => void;
    applySettings: () => void;
    applyCover: (url: string | null, palette: Palette, depthUrl?: string | null) => void;
    setPalette: (palette: Palette) => void;
  } | null>(null);

  settingsRef.current = settings;
  playingRef.current = playing;
  activeRef.current = active;
  analyserRef.current = analyser;
  depthMapRef.current = depthMapUrl;
  statsRef.current = onStats;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: false,
        alpha: true,
        powerPreference: "high-performance",
      });
    } catch {
      onFail();
      return;
    }

    if (!renderer.getContext()) {
      onFail();
      return;
    }

    let disposed = false;
    const pixelRatio = Math.min(1.35, window.devicePixelRatio || 1);
    renderer.setPixelRatio(pixelRatio);
    renderer.setClearColor(0x05070a, 0);
    renderer.domElement.className = "zd-stage-canvas3d";
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(CAMERA_FOV, 1, 0.1, 200);
    camera.position.set(0, 1.2, CAMERA_RADIUS);
    camera.lookAt(0, 0, 0);

    const tintA = new THREE.Color(palette.primary);
    const tintB = new THREE.Color(palette.secondary);

    const uniforms = {
      uTime: { value: 0 },
      uSpeed: { value: settingsRef.current.speed },
      uDepth: { value: settingsRef.current.depth },
      uIntensity: { value: settingsRef.current.intensity },
      uPointScale: { value: settingsRef.current.point },
      uTwist: { value: settingsRef.current.twist },
      uScatter: { value: settingsRef.current.scatter },
      uPreset: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uHigh: { value: 0 },
      uGlowBoost: { value: 0 },
      uPlanetRadius: { value: settingsRef.current.planetRadius },
      uPlanetSpin: { value: settingsRef.current.planetSpin },
      uRingRadius: { value: settingsRef.current.ringRadius },
      uRingWidth: { value: settingsRef.current.ringWidth },
      uPetals: { value: settingsRef.current.petalCount },
      uPetalDepth: { value: settingsRef.current.petalDepth },
      uEdge: { value: 1 },
      uPixel: { value: pixelRatio },
      uSizeMul: { value: 1 },
      uDepthTex: { value: null as THREE.Texture | null },
      uCoverTex: { value: null as THREE.Texture | null },
      uTintA: { value: tintA },
      uTintB: { value: tintB },
      uColorBoost: { value: settingsRef.current.color },
      uLayer: { value: 0 },
      uBloom: { value: settingsRef.current.bloom },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
    });

    const bloomMaterial = new THREE.ShaderMaterial({
      uniforms: {
        ...uniforms,
        uSizeMul: { value: 2.1 },
        uLayer: { value: 1 },
      },
      vertexShader,
      fragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    let grid = gridForResolution(settingsRef.current.coverRes);
    let geometry = buildGridGeometry(grid);
    const points = new THREE.Points(geometry, material);
    const bloom = new THREE.Points(geometry, bloomMaterial);
    bloom.renderOrder = 2;
    points.renderOrder = 1;
    scene.add(points);
    scene.add(bloom);

    const starUniforms = {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uPixel: { value: pixelRatio },
      uPointScale: { value: 1 },
      uTintA: { value: tintA },
      uTintB: { value: tintB },
    };

    const starMaterial = new THREE.ShaderMaterial({
      uniforms: starUniforms,
      vertexShader: starVertexShader,
      fragmentShader: starFragmentShader,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });

    const starGeometry = buildStarGeometry(1400);
    const starRiver = new THREE.Points(starGeometry, starMaterial);
    starRiver.renderOrder = 0;
    scene.add(starRiver);

    let coverTexture: THREE.Texture | null = null;
    let depthTexture: THREE.Texture | null = null;
    let coverToken = 0;

    const applyCover = async (url: string | null, nextPalette: Palette, depthUrl?: string | null) => {
      coverToken += 1;
      const token = coverToken;
      let source: CanvasImageSource;
      if (url) {
        try {
          const image = await loadImage(url);
          if (disposed || token !== coverToken) return;
          source = image;
        } catch {
          source = makeFallbackCover(nextPalette.primary, nextPalette.secondary);
        }
      } else {
        source = makeFallbackCover(nextPalette.primary, nextPalette.secondary);
      }
      if (disposed || token !== coverToken) return;

      // AI 深度图：可用时替换亮度启发式，加载失败则退回封面亮度
      let depthSource: CanvasImageSource | undefined;
      if (depthUrl) {
        try {
          depthSource = await loadImage(depthUrl);
          if (disposed || token !== coverToken) return;
        } catch {
          depthSource = undefined;
        }
      }

      let textures: ReturnType<typeof makeTextures> = null;
      try {
        textures = makeTextures(source, depthSource);
      } catch {
        // 远程封面可能污染 canvas，退化为纯色深度
        const fallback = makeFallbackCover(nextPalette.primary, nextPalette.secondary);
        textures = makeTextures(fallback);
      }
      if (!textures || disposed || token !== coverToken) return;

      const oldCover = coverTexture;
      const oldDepth = depthTexture;
      coverTexture = textures.coverTexture;
      depthTexture = textures.depthTexture;
      uniforms.uCoverTex.value = coverTexture;
      uniforms.uDepthTex.value = depthTexture;
      oldCover?.dispose();
      oldDepth?.dispose();
      renderOnce();
    };

    let time = 0;
    const orbit = {
      theta: 0.16,
      phi: 1.3,
      radius: CAMERA_RADIUS,
      targetTheta: 0.16,
      targetPhi: 1.3,
      targetRadius: CAMERA_RADIUS,
    };

    const audio = { bass: 0, mid: 0, high: 0, prevBass: 0, lastKick: 0, kick: 0 };
    let autoTheta = 0;
    let frame = 0;
    let raf = 0;
    let lastTime = 0;
    let fps = 60;
    let statsAt = 0;
    let reduced = false;

    const emitStats = () => {
      statsRef.current({
        fps: Math.round(fps),
        particles: grid * grid,
        drawCalls: renderer.info.render.calls,
        geometries: renderer.info.memory.geometries,
        textures: renderer.info.memory.textures,
        bass: Number(audio.bass.toFixed(2)),
        mid: Number(audio.mid.toFixed(2)),
        high: Number(audio.high.toFixed(2)),
      });
    };

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduced = media.matches;
    const onReducedChange = () => {
      reduced = media.matches;
      if (reduced) {
        // 静态降级：停掉律动并清零能量，只保留冻结画面
        audio.bass = 0;
        audio.mid = 0;
        audio.high = 0;
        audio.kick = 0;
        uniforms.uBass.value = 0;
        uniforms.uMid.value = 0;
        uniforms.uHigh.value = 0;
        uniforms.uGlowBoost.value = 0;
        stopLoop();
        renderOnce();
        emitStats();
      } else if (playingRef.current && activeRef.current) {
        startLoop();
      }
    };
    media.addEventListener("change", onReducedChange);

    const resize = () => {
      const width = host.clientWidth || window.innerWidth;
      const height = host.clientHeight || window.innerHeight;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderOnce();
    };

    const draw = () => {
      renderer.render(scene, camera);
    };

    function renderOnce() {
      if (disposed) return;
      draw();
    }

    const readAudio = () => {
      const s = settingsRef.current;
      // 灵敏度为 0 或关掉律动时不读频谱，能量自然回落
      if (!s.audioReact || s.sensitivity <= 0) {
        audio.bass *= 0.88;
        audio.mid *= 0.88;
        audio.high *= 0.88;
        return;
      }
      const node = analyserRef.current;
      if (!node) {
        audio.bass *= 0.88;
        audio.mid *= 0.88;
        audio.high *= 0.88;
        return;
      }
      const data = node.frequencyBinCount;
      if (!freqData || freqData.length !== data) freqData = new Uint8Array(data);
      node.getByteFrequencyData(freqData);

      let bass = 0;
      for (let i = 1; i < 9; i += 1) bass += freqData[i] ?? 0;
      bass /= 8 * 255;

      let mid = 0;
      for (let i = 9; i < 41; i += 1) mid += freqData[i] ?? 0;
      mid /= 32 * 255;

      // 128-bin FFT（172Hz/bin）：42–100 ≈ 7.2–17kHz，覆盖镲片/齿音等高频细节
      let high = 0;
      for (let i = 42; i < 100; i += 1) high += freqData[i] ?? 0;
      high /= 58 * 255;

      const sens = s.sensitivity;
      const targetBass = Math.min(1, bass * 1.35 * sens);
      const targetMid = Math.min(1, mid * 1.6 * sens);
      const targetHigh = Math.min(1, high * 1.8 * sens);

      // 包络跟随：快攻慢放，避免每帧直采的抽帧感
      audio.bass += (targetBass - audio.bass) * (targetBass > audio.bass ? 0.3 : 0.075);
      audio.mid += (targetMid - audio.mid) * (targetMid > audio.mid ? 0.24 : 0.06);
      audio.high += (targetHigh - audio.high) * (targetHigh > audio.high ? 0.38 : 0.09);
    };

    let freqData: Uint8Array<ArrayBuffer> | null = null;
    let lastCameraRadius = settingsRef.current.cameraRadius;
    let lastPreset = settingsRef.current.preset;
    let lastEpoch = settingsRef.current.cameraEpoch;

    const CAMERA_BASELINE: Record<StagePreset, { theta: number; phi: number }> = {
      cover: { theta: 0.16, phi: 1.3 },
      planet: { theta: 0.6, phi: 1.22 },
      eclipse: { theta: 0, phi: 1.42 },
      abyss: { theta: 0.2, phi: 1.3 },
    };

    const applyCameraBaseline = (preset: StagePreset) => {
      const base = CAMERA_BASELINE[preset];
      orbit.targetTheta = base.theta;
      orbit.targetPhi = base.phi;
      orbit.targetRadius = settingsRef.current.cameraRadius;
      autoTheta = 0;
    };

    // 网格分辨率变化（封面清晰度滑块）时重建几何，复用同一份 attribute 写入逻辑
    const syncGrid = (resolution: number) => {
      const nextGrid = gridForResolution(resolution);
      if (nextGrid === grid) return;
      const old = geometry;
      grid = nextGrid;
      geometry = buildGridGeometry(grid);
      points.geometry = geometry;
      bloom.geometry = geometry;
      old.dispose();
    };

    const applySettings = () => {
      const s = settingsRef.current;
      uniforms.uSpeed.value = s.speed;
      uniforms.uDepth.value = s.depth;
      uniforms.uIntensity.value = s.intensity;
      uniforms.uPointScale.value = s.point;
      uniforms.uTwist.value = s.twist;
      uniforms.uScatter.value = s.scatter;
      uniforms.uColorBoost.value = s.color;
      uniforms.uBloom.value = s.bloom;
      uniforms.uEdge.value = s.edge ? 1 : 0;
      uniforms.uPreset.value = { cover: 0, planet: 1, eclipse: 2, abyss: 3 }[s.preset];
      uniforms.uPlanetRadius.value = s.planetRadius;
      uniforms.uPlanetSpin.value = s.planetSpin;
      uniforms.uRingRadius.value = s.ringRadius;
      uniforms.uRingWidth.value = s.ringWidth;
      uniforms.uPetals.value = s.petalCount;
      uniforms.uPetalDepth.value = s.petalDepth;
      bloom.visible = s.bloomEnabled;
      starRiver.visible = s.starRiver;

      if (!s.audioReact || s.sensitivity <= 0) {
        audio.bass = 0;
        audio.mid = 0;
        audio.high = 0;
        audio.kick = 0;
        uniforms.uBass.value = 0;
        uniforms.uMid.value = 0;
        uniforms.uHigh.value = 0;
        uniforms.uGlowBoost.value = 0;
      }

      // 镜头距离只在滑块本身变化时接管，避免覆盖滚轮缩放
      if (s.cameraRadius !== lastCameraRadius) {
        lastCameraRadius = s.cameraRadius;
        orbit.targetRadius = s.cameraRadius;
      }

      // 切预设 / 镜头归位时回到该预设的基线机位
      if (s.preset !== lastPreset || s.cameraEpoch !== lastEpoch) {
        lastPreset = s.preset;
        lastEpoch = s.cameraEpoch;
        lastCameraRadius = s.cameraRadius;
        applyCameraBaseline(s.preset);
      }

      // 背景压暗：抬高清屏色的不透明度，把 CSS 渐变底色渐次盖成暗场
      renderer.setClearColor(0x05070a, Math.min(1, Math.max(0, s.bgFade)));
      syncGrid(s.coverRes);
    };

    const step = (now: number) => {
      raf = 0;
      if (disposed) return;
      const dt = Math.min(0.05, lastTime ? (now - lastTime) / 1000 : 0.016);
      lastTime = now;
      fps = fps * 0.9 + (1 / Math.max(dt, 0.001)) * 0.1;

      if (playingRef.current) time += dt;
      frame += 1;

      const s = settingsRef.current;
      const shake = s.cinemaShake;

      if (frame % 2 === 0) readAudio();

      const node = analyserRef.current;
      if (node && audio.bass > 0.32 && audio.bass - audio.prevBass > 0.055 && now - audio.lastKick > 420) {
        audio.kick = Math.min(1, audio.kick + 0.9);
        audio.lastKick = now;
      }
      audio.prevBass = audio.bass;
      audio.kick *= Math.exp(-dt * 4.5);

      orbit.theta += (orbit.targetTheta - orbit.theta) * Math.min(1, dt * 6);
      orbit.phi += (orbit.targetPhi - orbit.phi) * Math.min(1, dt * 6);
      orbit.radius += (orbit.targetRadius - orbit.radius) * Math.min(1, dt * 6);
      autoTheta += s.autoOrbit * dt;

      const theta =
        orbit.theta +
        autoTheta +
        Math.sin(time * 0.055) * 0.055 * shake +
        audio.kick * 0.02 * shake;
      const phi = orbit.phi + Math.sin(time * 0.043) * 0.032 * shake - audio.kick * 0.012 * shake;
      const radius = orbit.radius + Math.sin(time * 0.031) * 0.08 * shake + audio.kick * 0.16 * shake;

      camera.position.set(
        Math.sin(phi) * Math.sin(theta) * radius,
        Math.cos(phi) * radius,
        Math.sin(phi) * Math.cos(theta) * radius,
      );
      camera.lookAt(0, 0, 0);
      camera.rotation.z = audio.kick * 0.010 * shake + Math.sin(time * 0.05) * 0.004 * shake;

      uniforms.uTime.value = time;
      uniforms.uBass.value = audio.bass;
      uniforms.uMid.value = audio.mid;
      uniforms.uHigh.value = audio.high;
      uniforms.uGlowBoost.value = audio.mid;
      starUniforms.uTime.value = time;
      starUniforms.uBass.value = audio.bass;

      draw();

      if (now - statsAt > 500) {
        statsAt = now;
        emitStats();
      }

      if (playingRef.current && activeRef.current && !reduced) {
        raf = window.requestAnimationFrame(step);
      }
    };

    const startLoop = () => {
      if (raf || disposed) return;
      if (!activeRef.current || reduced) return;
      lastTime = 0;
      raf = window.requestAnimationFrame(step);
    };

    const stopLoop = () => {
      if (raf) {
        window.cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!activeRef.current) return;
      dragging = { x: event.clientX, y: event.clientY };
      (event.target as HTMLElement).setPointerCapture?.(event.pointerId);
    };
    let dragging: { x: number; y: number } | null = null;

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging) return;
      const dx = event.clientX - dragging.x;
      const dy = event.clientY - dragging.y;
      dragging = { x: event.clientX, y: event.clientY };
      orbit.targetTheta -= dx * 0.0045;
      orbit.targetPhi = Math.min(2.05, Math.max(0.72, orbit.targetPhi - dy * 0.0032));
    };

    const onPointerUp = () => {
      dragging = null;
    };

    const onWheel = (event: WheelEvent) => {
      if (!activeRef.current) return;
      event.preventDefault();
      orbit.targetRadius = Math.min(14, Math.max(2.4, orbit.targetRadius + event.deltaY * 0.0026));
    };

    renderer.domElement.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    renderer.domElement.addEventListener("wheel", onWheel, { passive: false });

    applySettings();
    resize();
    renderOnce();

    apiRef.current = {
      render: renderOnce,
      start: () => {
        if (disposed) return;
        if (!playingRef.current) {
          // 暂停：冻结画面并清零律动能量，恢复播放时从 0 重新起势
          audio.bass = 0;
          audio.mid = 0;
          audio.high = 0;
          audio.kick = 0;
          uniforms.uBass.value = 0;
          uniforms.uMid.value = 0;
          uniforms.uHigh.value = 0;
          uniforms.uGlowBoost.value = 0;
          stopLoop();
          renderOnce();
          emitStats();
          return;
        }
        if (activeRef.current && !reduced) startLoop();
      },
      applySettings,
      applyCover,
      setPalette: (next) => {
        tintA.set(next.primary);
        tintB.set(next.secondary);
      },
    };

    void applyCover(coverUrl, palette, depthMapRef.current);
    startLoop();

    const observer = new ResizeObserver(resize);
    observer.observe(host);

    return () => {
      disposed = true;
      stopLoop();
      observer.disconnect();
      media.removeEventListener("change", onReducedChange);
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      renderer.domElement.removeEventListener("wheel", onWheel);
      geometry.dispose();
      starGeometry.dispose();
      material.dispose();
      bloomMaterial.dispose();
      starMaterial.dispose();
      coverTexture?.dispose();
      depthTexture?.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      apiRef.current = null;
    };
    // 场景只初始化一次；曲目、播放态、参数都通过 ref 更新
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    apiRef.current?.setPalette(palette);
    apiRef.current?.applyCover(coverUrl, palette, depthMapUrl);
    if (!playing) apiRef.current?.render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coverUrl, depthMapUrl, palette.primary, palette.secondary]);

  useEffect(() => {
    apiRef.current?.applySettings();
    apiRef.current?.render();
  }, [settings, active, playing]);

  useEffect(() => {
    if (active && playing) {
      apiRef.current?.start();
    } else {
      apiRef.current?.render();
    }
  }, [active, playing]);

  return <div className="zd-stage-canvas-host" ref={hostRef} aria-hidden />;
}
