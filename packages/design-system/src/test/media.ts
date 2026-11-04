import { commands, server } from '@vitest/browser/context';

type MediaFeature =
  | { name: 'prefers-reduced-motion'; value: 'reduce' | 'no-preference' }
  | { name: 'forced-colors'; value: 'active' | 'none' }
  | { name: 'prefers-color-scheme'; value: 'light' | 'dark' };

declare module '@vitest/browser/context' {
  interface BrowserCommands {
    emulateMedia: (features: MediaFeature[]) => Promise<void>;
  }
}

/**
 * Makes the page report `features`, in any engine, and resets every feature the
 * list leaves out, so `emulateMedia([])` undoes the last call. Throws when the
 * engine didn't take a value within a few frames, so a test never passes against
 * the wrong media.
 */
export async function emulateMedia(features: MediaFeature[]): Promise<void> {
  await commands.emulateMedia(features);
  for (const { name, value } of features) {
    const query = `(${name}: ${value})`;
    // Firefox applies the override in the content process a little later.
    for (let frame = 0; frame < 10 && !matchMedia(query).matches; frame++) await new Promise(requestAnimationFrame);
    if (!matchMedia(query).matches) throw new Error(`${server.browser} did not emulate ${name}: ${value}`);
  }
}
