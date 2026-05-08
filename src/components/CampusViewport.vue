<script setup lang="ts">
import { computed, ref } from 'vue';

interface Point {
  x: number
  y: number
}

const props = defineProps<{
  src: string
}>();

const MIN_SCALE = 0.8;
const MAX_SCALE = 4;

const scale = ref(1);
const translateX = ref(0);
const translateY = ref(0);
const activePointers = new Map<number, Point>();

const isDragging = ref(false);
const dragStart = ref<Point>({ x: 0, y: 0 });
const translateStart = ref<Point>({ x: 0, y: 0 });
const pinchStartDistance = ref(0);
const pinchStartScale = ref(1);

const transformStyle = computed(() => ({
  transform: `translate3d(${translateX.value}px, ${translateY.value}px, 0) scale(${scale.value})`,
}));

function onWheel(event: WheelEvent): void {
  event.preventDefault();
  const factor = event.deltaY > 0 ? 0.95 : 1.05;
  scale.value = clampScale(scale.value * factor);
}

function onPointerDown(event: PointerEvent): void {
  const target = event.currentTarget as HTMLElement;
  target.setPointerCapture(event.pointerId);

  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (activePointers.size === 1) {
    isDragging.value = true;
    dragStart.value = { x: event.clientX, y: event.clientY };
    translateStart.value = { x: translateX.value, y: translateY.value };
    return;
  }

  if (activePointers.size === 2) {
    const [a, b] = [...activePointers.values()];
    pinchStartDistance.value = distance(a, b);
    pinchStartScale.value = scale.value;
    isDragging.value = false;
  }
}

function onPointerMove(event: PointerEvent): void {
  if (!activePointers.has(event.pointerId))
    return;

  activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (activePointers.size === 1 && isDragging.value) {
    const dx = event.clientX - dragStart.value.x;
    const dy = event.clientY - dragStart.value.y;
    translateX.value = translateStart.value.x + dx;
    translateY.value = translateStart.value.y + dy;
    return;
  }

  if (activePointers.size === 2) {
    const [a, b] = [...activePointers.values()];
    const currentDistance = distance(a, b);
    if (pinchStartDistance.value <= 0)
      return;

    const ratio = currentDistance / pinchStartDistance.value;
    scale.value = clampScale(pinchStartScale.value * ratio);
  }
}

function onPointerUp(event: PointerEvent): void {
  activePointers.delete(event.pointerId);

  if (activePointers.size === 0) {
    isDragging.value = false;
    return;
  }

  if (activePointers.size === 1) {
    const next = [...activePointers.values()][0];
    dragStart.value = { ...next };
    translateStart.value = { x: translateX.value, y: translateY.value };
    isDragging.value = true;
  }
}

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));
}

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}
</script>

<template>
  <div
    class="campus-viewport"
    @wheel="onWheel"
    @pointerdown="onPointerDown"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @pointercancel="onPointerUp"
    @pointerleave="onPointerUp"
  >
    <img
      class="campus-image"
      :src="props.src"
      alt="校园地图"
      draggable="false"
      :style="transformStyle"
    >
  </div>
</template>

<style scoped>
.campus-viewport {
  position: fixed;
  inset: 0;
  overflow: hidden;
  touch-action: none;
  background:
    radial-gradient(circle at 10% 10%, rgb(255 255 255 / 25%), transparent 35%),
    linear-gradient(160deg, #0c1633 0%, #102a43 42%, #0e1b2f 100%);
}

.campus-image {
  position: absolute;
  left: 50%;
  top: 50%;
  width: 118vw;
  max-width: none;
  user-select: none;
  transform-origin: center center;
  translate: -50% -50%;
  transition: filter 240ms ease;
  filter: saturate(1.08);
}
</style>
