import { commands, server } from 'vitest/browser';

type MediaFeature =
  | { name: 'prefers-reduced-motion'; value: 'reduce' | 'no-preference' }
  | { name: 'forced-colors'; value: 'active' | 'none' }
  | { name: 'prefers-color-scheme'; value: 'light' | 'dark' };

declare module 'vitest/browser' {
  interface BrowserCommands {
    emulateMedia: (features: MediaFeature[]) => Promise<void>;
  }
}

const DEFAULTS: Record<MediaFeature['name'], MediaFeature['value']> = {
  'prefers-reduced-motion': 'no-preference',
  'forced-colors': 'none',
  'prefers-color-scheme': 'light',
};

/**
 * Makes the page report `features`, in any engine, and resets every feature the
 * list leaves out, so `emulateMedia([])` undoes the last call. Throws when the
 * engine didn't take a value within a few frames, so a test never passes against
 * the wrong media.
 */
export async function emulateMedia(features: MediaFeature[]): Promise<void> {
  await commands.emulateMedia(features);
  // Every feature, so a reset waits too: a feature left out goes back to its default.
  for (const name of Object.keys(DEFAULTS) as MediaFeature['name'][]) {
    const value = features.find((feature) => feature.name === name)?.value ?? DEFAULTS[name];
    const query = `(${name}: ${value})`;
    // Firefox applies the override in the content process a little later.
    for (let frame = 0; frame < 10 && !matchMedia(query).matches; frame++) await new Promise(requestAnimationFrame);
    if (!matchMedia(query).matches) throw new Error(`${server.browser} did not emulate ${name}: ${value}`);
  }
}
