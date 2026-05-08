import process from 'node:process';
import ui from '@nuxt/ui/vite';
import { DownloadLive2DSDK } from '@proj-airi/unplugin-live2d-sdk/vite';
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
  plugins: [
    vue(),
    ui({
      router: false,
      prose: true,
    }),
    DownloadLive2DSDK(),
  ],
  build: {
    chunkSizeWarningLimit: Infinity,
  },
  clearScreen: false,
  server: {
    port: 10608,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: 'ws', host, port: 10618 }
      : undefined,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
});
