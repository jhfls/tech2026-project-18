<script setup lang="ts">
import { ref } from 'vue';
import Live2DPanel from './components/Live2DPanel.vue';
import Saturn from './components/Saturn.vue';
import Settings from './components/Settings.vue';
import VoiceChatDialog from './components/VoiceChatDialog.vue';

const isDialogOpen = ref(false);
</script>

<template>
  <UApp>
    <Saturn />

    <div class="fixed bottom-0 right-0">
      <Live2DPanel
        manifest-url="https://jhfls-tech2026-project-18-assets.by-ts.top/live2d/hiyori/manifest.json"
        @activate="isDialogOpen = true"
      />
    </div>

    <div class="fixed top-4 right-4">
      <USlideover title="设置">
        <UButton
          icon="i-lucide-settings"
          variant="outline"
          color="neutral"
        />
        <template #body>
          <Settings />
        </template>
      </USlideover>
    </div>

    <UModal v-model:open="isDialogOpen" title="对话" :dismissible="false">
      <template #body>
        <VoiceChatDialog />
      </template>
    </UModal>
  </UApp>
</template>
