import { defineStore } from 'pinia';

export interface CredentialsState {
  openRouterApiKey: string
  openRouterBaseUrl: string
  openRouterModel: string
  mimoApiKey: string
  mimoApiBase: string
}

export const useCredentialsStore = defineStore('credentials', {
  state: (): CredentialsState => ({
    openRouterApiKey: '',
    openRouterBaseUrl: 'https://openrouter.ai/api/v1',
    openRouterModel: 'deepseek/deepseek-v4-flash',
    mimoApiKey: '',
    mimoApiBase: 'https://api.xiaomimimo.com/v1',
  }),
  persist: true,
});
