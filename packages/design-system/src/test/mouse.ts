import { commands } from 'vitest/browser';

type MouseStep = { type: 'move'; x: number; y: number } | { type: 'down' } | { type: 'up' };

declare module 'vitest/browser' {
  interface BrowserCommands {
    mouse: (steps: MouseStep[]) => Promise<void>;
  }
}

/**
 * The real mouse, driven through Playwright at a point in this frame's client
 * coordinates. It hit tests as a person's mouse does, so a press over a native
 * scrollbar goes to the scrollbar, which `userEvent` can't reach: it always
 * dispatches to an element.
 */
export const mouse = {
  move: (x: number, y: number) => commands.mouse([{ type: 'move', x, y }]),
  down: () => commands.mouse([{ type: 'down' }]),
  up: () => commands.mouse([{ type: 'up' }]),
  /** Moves to each point in turn, as a hand drags through them. */
  path: (points: readonly (readonly [number, number])[]) => commands.mouse(points.map(([x, y]) => ({ type: 'move', x, y }))),
};
