<script setup lang="ts">
import { storeToRefs } from 'pinia';
import * as THREE from 'three';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useViewSettingsStore } from '../stores/view-settings';
import { getMediapipeCoreScripts, loadMediapipeHandFile, loadScriptOnce } from '../utils';

interface HandLandmark { x: number, y: number, z: number }
interface HandsResults {
  multiHandLandmarks?: HandLandmark[][]
}

interface HandsInstance {
  setOptions: (options: {
    maxNumHands: number
    modelComplexity: 0 | 1
    minDetectionConfidence: number
    minTrackingConfidence: number
  }) => void
  onResults: (callback: (results: HandsResults) => void) => void
  send: (input: { image: HTMLVideoElement }) => Promise<void>
  close: () => Promise<void>
}

interface CameraInstance {
  start: () => Promise<void>
  stop: () => Promise<void>
}

type CameraCtor = new (
  video: HTMLVideoElement,
  options: { onFrame: () => Promise<void>, width: number, height: number },
) => CameraInstance;

type HandsCtor = new (options: { locateFile: (file: string) => string }) => HandsInstance;

declare global {
  interface Window {
    Camera?: CameraCtor
    Hands?: HandsCtor
  }
}

const containerRef = ref<HTMLDivElement | null>(null);
const videoRef = ref<HTMLVideoElement | null>(null);
const loading = ref(true);
const isHandDetected = ref(false);

const viewSettings = useViewSettingsStore();
const {
  showCamera,
  minDetectionConfidence,
  minTrackingConfidence,
  distanceMin,
  distanceRange,
  minScale,
  maxScale,
  rotationMin,
  rotationRange,
  lerpFactor,
  idleSpeed,
  idleScaleAmplitude,
  idleRotationAmplitude,
} = storeToRefs(viewSettings);

const vertexshader = `
attribute float size;
attribute vec3 customColor;
attribute float opacityAttr;
attribute float orbitSpeed;
attribute float isRing;

varying vec3 vColor;
varying float vDist;
varying float vOpacity;
varying float vScaleFactor;
varying float vIsRing;

uniform float uTime;
uniform float uScale;
uniform float uRotationX;

mat2 rotate2d(float angle) {
  return mat2(cos(angle), -sin(angle), sin(angle), cos(angle));
}

void main() {
  vec3 pos = position;

  if (isRing > 0.5) {
    float angleOffset = uTime * orbitSpeed * 0.2;
    vec2 rotatedXZ = rotate2d(angleOffset) * pos.xz;
    pos.x = rotatedXZ.x;
    pos.z = rotatedXZ.y;
  }
  else {
    float bodyAngle = uTime * 0.03;
    vec2 rotatedXZ = rotate2d(bodyAngle) * pos.xz;
    pos.x = rotatedXZ.x;
    pos.z = rotatedXZ.y;
  }

  float cx = cos(uRotationX);
  float sx = sin(uRotationX);
  float ry = pos.y * cx - pos.z * sx;
  float rz = pos.y * sx + pos.z * cx;
  pos.y = ry;
  pos.z = rz;

  vec4 mvPosition = modelViewMatrix * vec4(pos * uScale, 1.0);
  float dist = -mvPosition.z;
  vDist = dist;

  gl_Position = projectionMatrix * mvPosition;

  float pointSize = size * (350.0 / dist);
  if (isRing < 0.5 && dist < 50.0)
    pointSize *= 0.8;

  gl_PointSize = clamp(pointSize, 0.0, 220.0);

  vColor = customColor;
  vOpacity = opacityAttr;
  vScaleFactor = uScale;
  vIsRing = isRing;
}
`;

const fragmentshader = `
varying vec3 vColor;
varying float vDist;
varying float vOpacity;
varying float vScaleFactor;
varying float vIsRing;

void main() {
  vec2 cxy = 2.0 * gl_PointCoord - 1.0;
  float r = dot(cxy, cxy);
  if (r > 1.0)
    discard;

  float glow = smoothstep(1.0, 0.4, r);
  float t = clamp((vScaleFactor - 0.15) / 2.35, 0.0, 1.0);

  vec3 deepGold = vec3(0.35, 0.22, 0.05);
  vec3 baseColor = mix(deepGold, vColor, smoothstep(0.1, 0.9, t));
  float brightness = 0.2 + 1.0 * t;
  float densityAlpha = 0.25 + 0.45 * smoothstep(0.0, 0.5, t);

  vec3 finalColor = baseColor * brightness;

  if (vDist < 40.0) {
    float closeMix = 1.0 - (vDist / 40.0);
    if (vIsRing < 0.5)
      finalColor = mix(finalColor, pow(vColor, vec3(1.4)) * 1.5, closeMix * 0.8);
    else
      finalColor += vec3(0.15, 0.12, 0.1) * closeMix;
  }

  float depthAlpha = 1.0;
  if (vDist < 10.0)
    depthAlpha = smoothstep(0.0, 10.0, vDist);

  gl_FragColor = vec4(finalColor, glow * vOpacity * densityAlpha * depthAlpha);
}
`;

const starVertexShader = `
attribute float size;
attribute vec3 customColor;
varying vec3 vColor;

void main() {
  vColor = customColor;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  float dist = -mvPosition.z;
  gl_PointSize = clamp(size * (1000.0 / dist), 1.0, 8.0);
  gl_Position = projectionMatrix * mvPosition;
}
`;

const starFragmentShader = `
varying vec3 vColor;
void main() {
  vec2 cxy = 2.0 * gl_PointCoord - 1.0;
  float r = dot(cxy, cxy);
  if (r > 1.0)
    discard;

  float glow = pow(1.0 - r, 1.5);
  gl_FragColor = vec4(vColor, glow * 0.8);
}
`;

let scene: THREE.Scene | null = null;
let camera: THREE.PerspectiveCamera | null = null;
let renderer: THREE.WebGLRenderer | null = null;
let particles: THREE.Points | null = null;
let stars: THREE.Points | null = null;
let nebula: THREE.Points | null = null;
let planetGroup: THREE.Group | null = null;
let frameId = 0;

const uniforms = {
  uTime: { value: 0 },
  uScale: { value: 1.0 },
  uRotationX: { value: 0.4 },
};

const starUniforms = {
  uTime: { value: 0 },
};

let currentScale = 1.0;
let targetScale = 1.0;
let currentRotX = 0.4;
let targetRotX = 0.4;
let autoIdleTime = 0;

const timer = new THREE.Timer();
let handsController: HandsInstance | null = null;
let cameraController: CameraInstance | null = null;
let isSendingFrame = false;

onMounted(async () => {
  initThree();
  timer.connect(document);
  await setupHandTracking();
  loading.value = false;
  window.addEventListener('resize', onResize);
});

onBeforeUnmount(async () => {
  window.removeEventListener('resize', onResize);
  if (frameId)
    cancelAnimationFrame(frameId);

  timer.disconnect();
  timer.dispose();

  if (cameraController)
    await cameraController.stop();
  cameraController = null;

  if (handsController)
    await handsController.close();
  handsController = null;

  particles?.geometry.dispose();
  (particles?.material as THREE.Material | undefined)?.dispose();
  stars?.geometry.dispose();
  (stars?.material as THREE.Material | undefined)?.dispose();
  nebula?.geometry.dispose();
  (nebula?.material as THREE.Material | undefined)?.dispose();

  if (planetGroup) {
    planetGroup.children.forEach((planet: THREE.Object3D) => {
      const mesh = planet as THREE.Mesh;
      mesh.geometry?.dispose();
      (mesh.material as THREE.Material | undefined)?.dispose();
    });
  }

  renderer?.dispose();
  if (renderer?.domElement && containerRef.value?.contains(renderer.domElement))
    containerRef.value.removeChild(renderer.domElement);
});

async function setupHandTracking(): Promise<void> {
  if (!videoRef.value)
    return;

  for (const scriptUrl of getMediapipeCoreScripts())
    await loadScriptOnce(scriptUrl);

  if (!window.Hands || !window.Camera)
    throw new Error('MediaPipe scripts failed to expose constructors.');

  const hands = new window.Hands({
    locateFile: file => loadMediapipeHandFile(file),
  });

  handsController = hands;
  applyHandsOptions();

  hands.onResults((results: HandsResults) => {
    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      isHandDetected.value = true;
      const hand = results.multiHandLandmarks[0];

      const p1 = hand[4];
      const p2 = hand[8];
      const dist = Math.sqrt((p1.x - p2.x) ** 2 + (p1.y - p2.y) ** 2);
      const normDist = clamp(
        (dist - distanceMin.value) / Math.max(0.001, distanceRange.value),
        0,
        1,
      );

      targetScale = minScale.value + normDist * (maxScale.value - minScale.value);

      const y = hand[9].y;
      const normY = clamp((y - 0.1) / 0.8, 0, 1);
      targetRotX = rotationMin.value + normY * rotationRange.value;
      return;
    }

    isHandDetected.value = false;
  });

  const camera = new window.Camera(videoRef.value, {
    onFrame: async () => {
      if (!videoRef.value || !handsController || isSendingFrame)
        return;

      isSendingFrame = true;
      try {
        await handsController.send({ image: videoRef.value });
      } finally {
        isSendingFrame = false;
      }
    },
    width: 640,
    height: 480,
  });

  cameraController = camera;
  await camera.start();
}

function applyHandsOptions(): void {
  handsController?.setOptions({
    maxNumHands: 1,
    modelComplexity: 1,
    minDetectionConfidence: minDetectionConfidence.value,
    minTrackingConfidence: minTrackingConfidence.value,
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function initThree(): void {
  if (!containerRef.value)
    return;

  scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x020202, 0.00015);

  camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 10000);
  camera.position.z = 100;
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  containerRef.value.appendChild(renderer.domElement);

  initSaturn();
  initStarfield();
  initPlanets();
  animate();
}

function initSaturn(): void {
  if (!scene)
    return;

  const particleCount = 220000;
  const geometry = new THREE.BufferGeometry();

  const positions = new Float32Array(particleCount * 3);
  const colors = new Float32Array(particleCount * 3);
  const sizes = new Float32Array(particleCount);
  const opacities = new Float32Array(particleCount);
  const orbitSpeeds = new Float32Array(particleCount);
  const isRings = new Float32Array(particleCount);

  const bodyColors = [
    new THREE.Color('#E3DAC5'),
    new THREE.Color('#C9A070'),
    new THREE.Color('#E3DAC5'),
    new THREE.Color('#B08D55'),
  ];

  const colorRingC = new THREE.Color('#2A2520');
  const colorRingB_Inner = new THREE.Color('#CDBFA0');
  const colorRingB_Outer = new THREE.Color('#DCCBBA');
  const colorCassini = new THREE.Color('#050505');
  const colorRingA = new THREE.Color('#989085');
  const colorRingF = new THREE.Color('#AFAFA0');

  const R_PLANET = 18;

  for (let i = 0; i < particleCount; i++) {
    let x = 0;
    let y = 0;
    let z = 0;
    let r = 0;
    let g = 0;
    let b = 0;
    let size = 1;
    let opacity = 0.5;
    let speed = 0;
    let isRingVal = 0;

    if (i < particleCount * 0.25) {
      isRingVal = 0;
      speed = 0;

      const u = Math.random();
      const v = Math.random();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const rad = R_PLANET;

      x = rad * Math.sin(phi) * Math.cos(theta);
      const rawY = rad * Math.cos(phi);
      y = rawY * 0.9;
      z = rad * Math.sin(phi) * Math.sin(theta);

      const lat = (rawY / rad + 1.0) * 0.5;
      const bandNoise = Math.cos(lat * 40.0) * 0.8 + Math.cos(lat * 15.0) * 0.4;
      let colIndex = Math.floor(lat * 4 + bandNoise) % 4;
      if (colIndex < 0)
        colIndex = 0;
      const baseCol = bodyColors[colIndex];

      r = baseCol.r;
      g = baseCol.g;
      b = baseCol.b;
      size = 1.0 + Math.random() * 0.8;
      opacity = 0.8;
    } else {
      isRingVal = 1;
      const zoneRand = Math.random();
      let ringRadius = 0;
      let ringCol = colorRingA;

      if (zoneRand < 0.15) {
        ringRadius = R_PLANET * (1.235 + Math.random() * (1.525 - 1.235));
        ringCol = colorRingC;
        size = 0.5;
        opacity = 0.3;
      } else if (zoneRand < 0.65) {
        const t = Math.random();
        ringRadius = R_PLANET * (1.525 + t * (1.95 - 1.525));
        ringCol = colorRingB_Inner.clone().lerp(colorRingB_Outer, t);
        size = 0.8 + Math.random() * 0.6;
        opacity = 0.85;
      } else if (zoneRand < 0.69) {
        ringRadius = R_PLANET * (1.95 + Math.random() * (2.025 - 1.95));
        ringCol = colorCassini;
        size = 0.3;
        opacity = 0.1;
      } else if (zoneRand < 0.99) {
        ringRadius = R_PLANET * (2.025 + Math.random() * (2.27 - 2.025));
        ringCol = colorRingA;
        size = 0.7;
        opacity = 0.6;
      } else {
        ringRadius = R_PLANET * (2.32 + Math.random() * 0.02);
        ringCol = colorRingF;
        size = 1.0;
        opacity = 0.7;
      }

      const theta = Math.random() * Math.PI * 2;
      x = ringRadius * Math.cos(theta);
      z = ringRadius * Math.sin(theta);
      y = (Math.random() - 0.5) * (ringRadius > R_PLANET * 2.3 ? 0.4 : 0.15);
      speed = 8.0 / Math.sqrt(ringRadius);
      r = ringCol.r;
      g = ringCol.g;
      b = ringCol.b;
    }

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    colors[i * 3] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
    sizes[i] = size;
    opacities[i] = opacity;
    orbitSpeeds[i] = speed;
    isRings[i] = isRingVal;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('customColor', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('opacityAttr', new THREE.BufferAttribute(opacities, 1));
  geometry.setAttribute('orbitSpeed', new THREE.BufferAttribute(orbitSpeeds, 1));
  geometry.setAttribute('isRing', new THREE.BufferAttribute(isRings, 1));

  const material = new THREE.ShaderMaterial({
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexColors: true,
    uniforms,
    vertexShader: vertexshader,
    fragmentShader: fragmentshader,
    transparent: true,
  });

  particles = new THREE.Points(geometry, material);
  particles.rotation.z = 26.73 * (Math.PI / 180);
  scene.add(particles);
}

function initStarfield(): void {
  if (!scene)
    return;

  const starCount = 35000;
  const geo = new THREE.BufferGeometry();

  const pos = new Float32Array(starCount * 3);
  const cols = new Float32Array(starCount * 3);
  const sizes = new Float32Array(starCount);

  const starColors = [
    new THREE.Color('#9bb0ff'),
    new THREE.Color('#ffffff'),
    new THREE.Color('#ffcc6f'),
    new THREE.Color('#ff7b7b'),
  ];

  for (let i = 0; i < starCount; i++) {
    const r = 400 + Math.random() * 3000;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.cos(phi);
    pos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

    const colorType = Math.random();
    const c = colorType > 0.9
      ? starColors[0]
      : colorType > 0.6
        ? starColors[1]
        : colorType > 0.3
          ? starColors[2]
          : starColors[3];

    cols[i * 3] = c.r;
    cols[i * 3 + 1] = c.g;
    cols[i * 3 + 2] = c.b;
    sizes[i] = 1.0 + Math.random() * 3.0;
  }

  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('customColor', new THREE.BufferAttribute(cols, 3));
  geo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.ShaderMaterial({
    uniforms: starUniforms,
    vertexShader: starVertexShader,
    fragmentShader: starFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  stars = new THREE.Points(geo, mat);
  scene.add(stars);

  const nebulaCount = 80;
  const nebGeo = new THREE.BufferGeometry();
  const nebPos = new Float32Array(nebulaCount * 3);
  const nebCols = new Float32Array(nebulaCount * 3);
  const nebSizes = new Float32Array(nebulaCount);

  for (let i = 0; i < nebulaCount; i++) {
    const r = 800 + Math.random() * 2000;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.PI / 2 + (Math.random() - 0.5) * 1.5;
    nebPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    nebPos[i * 3 + 1] = r * Math.cos(phi);
    nebPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    const nc = new THREE.Color().setHSL(0.6 + Math.random() * 0.2, 0.8, 0.05);
    nebCols[i * 3] = nc.r;
    nebCols[i * 3 + 1] = nc.g;
    nebCols[i * 3 + 2] = nc.b;
    nebSizes[i] = 400.0 + Math.random() * 600.0;
  }

  nebGeo.setAttribute('position', new THREE.BufferAttribute(nebPos, 3));
  nebGeo.setAttribute('customColor', new THREE.BufferAttribute(nebCols, 3));
  nebGeo.setAttribute('size', new THREE.BufferAttribute(nebSizes, 1));

  const nebShaderMat = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: starVertexShader,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        vec2 cxy = 2.0 * gl_PointCoord - 1.0;
        float r = dot(cxy, cxy);
        if (r > 1.0) discard;
        float glow = pow(1.0 - r, 2.0);
        gl_FragColor = vec4(vColor, glow * 0.1);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  nebula = new THREE.Points(nebGeo, nebShaderMat);
  scene.add(nebula);
}

function initPlanets(): void {
  if (!scene)
    return;

  planetGroup = new THREE.Group();
  scene.add(planetGroup);

  createPlanet(new THREE.Color('#b33a00'), new THREE.Color('#d16830'), new THREE.Vector3(-300, 120, -450), 10);
  createPlanet(new THREE.Color('#001e4d'), new THREE.Color('#ffffff'), new THREE.Vector3(380, -100, -600), 14);
  createPlanet(new THREE.Color('#666666'), new THREE.Color('#aaaaaa'), new THREE.Vector3(-180, -220, -350), 6);
}

function createPlanet(color1: THREE.Color, color2: THREE.Color, pos: THREE.Vector3, radius: number): void {
  if (!planetGroup)
    return;

  const geo = new THREE.SphereGeometry(radius, 48, 48);
  const material = new THREE.MeshStandardMaterial({
    color: color1.clone().lerp(color2, 0.35),
    roughness: 0.9,
    metalness: 0.05,
  });
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(pos);
  planetGroup.add(mesh);
}

function animate(timestamp?: number): void {
  frameId = requestAnimationFrame(animate);

  if (!renderer || !scene || !camera)
    return;

  timer.update(timestamp);
  const elapsedTime = timer.getElapsed();
  uniforms.uTime.value = elapsedTime;
  starUniforms.uTime.value = elapsedTime;

  if (stars)
    stars.rotation.y = elapsedTime * 0.005;
  if (nebula)
    nebula.rotation.y = elapsedTime * 0.003;

  if (planetGroup) {
    planetGroup.children.forEach((planet: THREE.Object3D, idx: number) => {
      planet.rotation.y = elapsedTime * (0.05 + idx * 0.02);
    });
    planetGroup.rotation.y = Math.sin(elapsedTime * 0.05) * 0.02;
  }

  if (!isHandDetected.value) {
    autoIdleTime += idleSpeed.value;
    targetScale = 1.0 + Math.sin(autoIdleTime) * idleScaleAmplitude.value;
    targetRotX = 0.4 + Math.sin(autoIdleTime * 0.3) * idleRotationAmplitude.value;
  }

  currentScale += (targetScale - currentScale) * lerpFactor.value;
  currentRotX += (targetRotX - currentRotX) * lerpFactor.value;

  uniforms.uScale.value = currentScale;
  uniforms.uRotationX.value = currentRotX;

  renderer.render(scene, camera);
}

function onResize(): void {
  if (!renderer || !camera)
    return;

  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
</script>

<template>
  <div id="canvas-container" ref="containerRef" aria-hidden="true" />

  <video
    v-show="showCamera"
    ref="videoRef"
    playsinline
    muted
    class="pointer-events-none fixed top-5 left-5 h-auto w-[34vw] min-w-40 rounded-lg border-2 border-emerald-400/50 bg-black [transform:scaleX(-1)] transition-opacity md:w-[20vw] md:min-w-[220px]"
  />

  <div v-if="loading" id="loading" class="loading">
    正在构建粒子与行星数据...
  </div>

  <div v-if="isHandDetected" class="control-tip">
    手势控制中
  </div>
</template>

<style scoped>
#canvas-container {
  position: fixed;
  inset: 0;
  overflow: hidden;
  background: radial-gradient(circle at center, #050505 0%, #0b0b10 100%);
  pointer-events: none;
}

.loading {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: #444;
  font-size: 0.8rem;
  letter-spacing: 3px;
  text-transform: uppercase;
  pointer-events: none;
}

.control-tip {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgb(0 0 0 / 60%);
  color: #42b883;
  padding: 10px 20px;
  border-radius: 20px;
  font-family: sans-serif;
  font-weight: bold;
  pointer-events: none;
  backdrop-filter: blur(4px);
  border: 1px solid rgb(66 184 131 / 30%);
}
</style>
