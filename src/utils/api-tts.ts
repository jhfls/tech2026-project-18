import type { CredentialsState } from '../stores/credentials';

// Voice sample loaded once at app startup
let voiceSampleDataUrl: string | null = null;

/** Load and cache the voice sample from /sample.wav */
async function ensureVoiceSample(): Promise<string> {
  if (voiceSampleDataUrl)
    return voiceSampleDataUrl;

  const resp = await fetch('/sample.wav');
  if (!resp.ok)
    throw new Error('Failed to load /sample.wav for voice clone');

  const buf = await resp.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (const b of bytes)
    binary += String.fromCharCode(b);
  voiceSampleDataUrl = `data:audio/wav;base64,${btoa(binary)}`;
  return voiceSampleDataUrl;
}

/**
 * Call MiMo TTS voiceclone and return a WAV Blob.
 */
export async function generateSpeech(
  settings: CredentialsState,
  text: string,
): Promise<Blob> {
  const voice = await ensureVoiceSample();

  const resp = await fetch(`${settings.mimoApiBase}/chat/completions`, {
    method: 'POST',
    headers: {
      'api-key': settings.mimoApiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mimo-v2.5-tts-voiceclone',
      messages: [
        { role: 'user', content: '' },
        { role: 'assistant', content: text },
      ],
      audio: { format: 'wav', voice },
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`MiMo TTS failed (${resp.status}): ${detail.slice(0, 300)}`);
  }

  const data = await resp.json() as { choices?: Array<{ message?: { audio?: { data?: string } } }> };
  const audioB64 = data?.choices?.[0]?.message?.audio?.data;
  if (!audioB64)
    throw new Error('MiMo TTS returned no audio data');

  // Decode base64 → Uint8Array → Blob
  const raw = atob(audioB64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++)
    bytes[i] = raw.charCodeAt(i);

  return new Blob([bytes], { type: 'audio/wav' });
}
