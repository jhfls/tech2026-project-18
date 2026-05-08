import ui from '@nuxt/ui/vue-plugin';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import { createApp } from 'vue';
import App from './App.vue';
import './main.css';

const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);

createApp(App)
  .use(pinia)
  .use(ui)
  .mount('#app');
