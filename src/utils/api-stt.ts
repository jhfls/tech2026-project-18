import type { CredentialsState } from '../stores/credentials';

/**
 * Transcribe audio using OpenRouter STT (openai/gpt-4o-mini-transcribe).
 * Sends base64-encoded audio to the OpenRouter /audio/transcriptions endpoint.
 */
export async function transcribeAudio(
  settings: CredentialsState,
  audioBlob: Blob,
): Promise<{ text: string, language: 'zh-CN' | 'en-US' }> {
  const arrayBuffer = await audioBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64Audio = btoa(binary);

  // Map MIME type to format string
  const mimeToFormat: Record<string, string> = {
    'audio/webm': 'webm',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/mpeg': 'mp3',
    'audio/mp4': 'm4a',
    'audio/ogg': 'ogg',
    'audio/flac': 'flac',
    'audio/aac': 'aac',
  };
  const format = mimeToFormat[audioBlob.type] || 'webm';

  const baseUrl = settings.openRouterBaseUrl || 'https://openrouter.ai/api/v1';
  const resp = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${settings.openRouterApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'openai/gpt-4o-mini-transcribe',
      input_audio: {
        data: base64Audio,
        format,
      },
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`OpenRouter STT failed (${resp.status}): ${detail.slice(0, 300)}`);
  }

  const json = await resp.json() as {
    text?: string
  };

  return {
    text: (json.text || '').trim(),
    language: 'zh-CN',
  };
}
