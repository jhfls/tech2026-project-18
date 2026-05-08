/*
import cameraUtilsScriptUrl from '@mediapipe/camera_utils/camera_utils.js?url';
import handsScriptUrl from '@mediapipe/hands/hands.js?url';

const handResolver = import.meta.glob('../node_modules/@mediapipe/hands/*', {
  query: '?url',
  eager: true,
  import: 'default',
  exhaustive: true,
});
*/

const loadedScripts = new Set<string>();

export function getMediapipeCoreScripts(): string[] {
  // return [cameraUtilsScriptUrl, handsScriptUrl];
  return [
    'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
    'https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js',
  ];
}

export function loadScriptOnce(src: string): Promise<void> {
  if (loadedScripts.has(src))
    return Promise.resolve();

  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[data-src="${src}"]`) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === 'true') {
        loadedScripts.add(src);
        resolve();
        return;
      }
      existing.addEventListener('load', () => {
        loadedScripts.add(src);
        resolve();
      }, { once: true });
      existing.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.dataset.src = src;
    script.addEventListener('load', () => {
      script.dataset.loaded = 'true';
      loadedScripts.add(src);
      resolve();
    }, { once: true });
    script.addEventListener('error', () => reject(new Error(`Failed to load script: ${src}`)), { once: true });
    document.head.appendChild(script);
  });
}

export function loadMediapipeHandFile(filename: string): string {
  /*
  const path = `../node_modules/@mediapipe/hands/${filename}`;
  console.log(testUrl, fetch(testUrl));
  return handResolver[path] as string;
  */
  return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${filename}`;
}
