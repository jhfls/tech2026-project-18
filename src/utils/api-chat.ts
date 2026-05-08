import type { CredentialsState } from '../stores/credentials';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { streamText } from 'ai';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

/**
 * Stream a chat completion from OpenRouter using AI SDK.
 * Yields text deltas as they arrive.
 */
export async function* streamChat(
  settings: CredentialsState,
  messages: ChatMessage[],
  signal?: AbortSignal,
): AsyncGenerator<string, void, unknown> {
  const provider = createOpenAICompatible({
    name: 'openrouter',
    apiKey: settings.openRouterApiKey,
    baseURL: settings.openRouterBaseUrl,
  });

  const result = streamText({
    model: provider.chatModel(settings.openRouterModel),
    messages,
    abortSignal: signal,
  });

  for await (const delta of result.textStream) {
    yield delta;
  }
}
