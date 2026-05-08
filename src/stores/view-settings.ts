import { defineStore } from 'pinia';

export interface ViewSettingsState {
  showCamera: boolean
  minDetectionConfidence: number
  minTrackingConfidence: number
  distanceMin: number
  distanceRange: number
  minScale: number
  maxScale: number
  rotationMin: number
  rotationRange: number
  lerpFactor: number
  idleSpeed: number
  idleScaleAmplitude: number
  idleRotationAmplitude: number
}

const defaults: ViewSettingsState = {
  showCamera: true,
  minDetectionConfidence: 0.7,
  minTrackingConfidence: 0.7,
  distanceMin: 0.02,
  distanceRange: 0.25,
  minScale: 0.15,
  maxScale: 2.5,
  rotationMin: -0.6,
  rotationRange: 1.6,
  lerpFactor: 0.08,
  idleSpeed: 0.005,
  idleScaleAmplitude: 0.2,
  idleRotationAmplitude: 0.15,
};

export const useViewSettingsStore = defineStore('viewSettings', {
  state: (): ViewSettingsState => ({ ...defaults }),
  actions: {
    reset(): void {
      this.$patch({ ...defaults });
    },
  },
  persist: true,
});
