<script setup lang="ts">
import { Live2DModel } from 'pixi-live2d-display/cubism4';
import * as PIXI from 'pixi.js';
import { onBeforeUnmount, onMounted, ref } from 'vue';

const props = defineProps<{
  manifestUrl: string
}>();

const emit = defineEmits<{
  activate: []
}>();

const containerRef = ref<HTMLDivElement | null>(null);
const loading = ref(true);
const error = ref('');

let app: PIXI.Application | null = null;
let model: Live2DModel | null = null;

onMounted(async () => {
  try {
    await init();
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Live2D 初始化失败';
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  if (app) {
    app.destroy(true, { children: true });
    app = null;
  }
});

async function init(): Promise<void> {
  if (!containerRef.value)
    return;

  // pixi-live2d-display expects PIXI on window in browser usage.
  (globalThis as typeof globalThis & { PIXI?: typeof PIXI }).PIXI = PIXI;

  app = new PIXI.Application({
    width: 300,
    height: 360,
    transparent: true,
    antialias: true,
  });
  containerRef.value.appendChild(app.view as HTMLCanvasElement);

  const modelUrl = await getModelUrlFromManifest(props.manifestUrl);
  model = await Live2DModel.from(modelUrl) as Live2DModel;
  model.interactive = true;
  model.buttonMode = true;
  model.on('pointertap', () => emit('activate'));

  model.anchor.set(0.5, 0);
  model.x = app.renderer.width / 2;
  model.y = 8;
  model.scale.set(0.22);
  app.stage.addChild(model as unknown as PIXI.DisplayObject);
}

async function getModelUrlFromManifest(manifestUrl: string): Promise<string> {
  const response = await fetch(manifestUrl);
  if (!response.ok)
    throw new Error('无法加载 Live2D 模型清单');

  const manifest = await response.json() as { modelPath?: string };
  if (!manifest.modelPath)
    throw new Error('Live2D 模型清单缺少 modelPath');

  return new URL(manifest.modelPath, manifestUrl).toString();
}
</script>

<template>
  <div class="live2d-panel">
    <div ref="containerRef" class="live2d-canvas" />
    <div v-if="loading" class="live2d-hint">
      模型加载中...
    </div>
    <div v-else-if="error" class="live2d-hint live2d-hint-error">
      {{ error }}
    </div>
  </div>
</template>

<style scoped>
.live2d-panel {
  width: 300px;
  height: 360px;
  overflow: hidden;
  position: relative;
  pointer-events: auto;
}

.live2d-canvas {
  width: 100%;
  height: 100%;
}

.live2d-canvas :deep(canvas) {
  width: 100% !important;
  height: 100% !important;
}

.live2d-hint {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 10px;
  text-align: center;
  color: rgb(255 255 255 / 85%);
  font-size: 12px;
  text-shadow: 0 1px 6px rgb(0 0 0 / 40%);
}

.live2d-hint-error {
  color: #ffd5d5;
}
</style>
