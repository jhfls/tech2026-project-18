<script setup lang="ts">
import { storeToRefs } from 'pinia';
import { useCredentialsStore } from '../stores/credentials';
import { useViewSettingsStore } from '../stores/view-settings';

const credentials = useCredentialsStore();
const viewSettings = useViewSettingsStore();

const {
  openRouterApiKey,
  openRouterBaseUrl,
  openRouterModel,
  mimoApiKey,
  mimoApiBase,
} = storeToRefs(credentials);

const {
  showCamera,
  minDetectionConfidence,
  minTrackingConfidence,
  distanceMin,
  distanceRange,
  minScale,
  maxScale,
  lerpFactor,
  idleSpeed,
} = storeToRefs(viewSettings);
</script>

<template>
  <div class="grid gap-4">
    <!-- ════════ 视图设置 ════════ -->
    <div class="space-y-3 rounded-2xl border border-default/40 bg-default/70 p-4">
      <p class="font-semibold text-highlighted">
        视图控制（需刷新生效）
      </p>

      <UFormField label="显示摄像头" orientation="horizontal">
        <USwitch v-model="showCamera" />
      </UFormField>

      <UFormField label="检测置信度">
        <USlider v-model="minDetectionConfidence" :min="0" :max="1" :step="0.01" tooltip />
      </UFormField>

      <UFormField label="跟踪置信度">
        <USlider v-model="minTrackingConfidence" :min="0" :max="1" :step="0.01" tooltip />
      </UFormField>

      <UCollapsible :ui="{ content: 'space-y-3 pt-2 p-3' }">
        <UButton
          label="高级视图参数"
          variant="ghost"
          color="neutral"
          trailing-icon="i-lucide-chevron-down"
          size="sm"
          block
          class="group"
          :ui="{ trailingIcon: 'group-data-[state=open]:rotate-180 transition-transform duration-200' }"
        />
        <template #content>
          <UFormField label="手势缩放最小值" size="sm">
            <USlider v-model="minScale" :min="0.1" :max="1.5" :step="0.01" tooltip />
          </UFormField>

          <UFormField label="手势缩放最大值" size="sm">
            <USlider v-model="maxScale" :min="1" :max="4" :step="0.01" tooltip />
          </UFormField>

          <UFormField label="距离映射起点" size="sm">
            <USlider v-model="distanceMin" :min="0.005" :max="0.12" :step="0.001" tooltip />
          </UFormField>

          <UFormField label="距离映射范围" size="sm">
            <USlider v-model="distanceRange" :min="0.05" :max="0.5" :step="0.001" tooltip />
          </UFormField>

          <UFormField label="插值平滑" size="sm">
            <USlider v-model="lerpFactor" :min="0.02" :max="0.3" :step="0.01" tooltip />
          </UFormField>

          <UFormField label="自动巡航速度" size="sm">
            <USlider v-model="idleSpeed" :min="0.001" :max="0.02" :step="0.001" tooltip />
          </UFormField>
        </template>
      </UCollapsible>

      <div class="flex justify-end">
        <UButton type="button" color="neutral" variant="outline" label="恢复默认" @click="viewSettings.reset()" />
      </div>
    </div>

    <!-- ════════ API 凭据 ════════ -->

    <!-- OpenRouter (Chat) -->
    <div class="space-y-3 rounded-2xl border border-default/40 bg-default/70 p-4">
      <p class="font-semibold text-highlighted">
        OpenRouter（对话、语音转文字）
      </p>
      <UFormField label="Base URL">
        <UInput v-model="openRouterBaseUrl" class="w-full" />
      </UFormField>
      <UFormField label="模型">
        <UInput v-model="openRouterModel" class="w-full" />
      </UFormField>
      <UFormField label="API Key">
        <UInput v-model="openRouterApiKey" type="password" placeholder="sk-or-..." class="w-full" />
      </UFormField>
    </div>

    <!-- MiMo (TTS) -->
    <div class="space-y-3 rounded-2xl border border-default/40 bg-default/70 p-4">
      <p class="font-semibold text-highlighted">
        MiMo（语音合成）
      </p>
      <UFormField label="Base URL">
        <UInput v-model="mimoApiBase" class="w-full" />
      </UFormField>
      <UFormField label="API Key">
        <UInput v-model="mimoApiKey" type="password" placeholder="tp-..." class="w-full" />
      </UFormField>
    </div>
  </div>
</template>
