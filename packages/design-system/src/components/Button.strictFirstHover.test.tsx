import { StrictMode } from 'react';
import { createRoot, type Root as ReactRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Button } from './Button.js';
import { resetInputModality } from '../internal/inputModality.js';
import { resetTooltipWarmth } from '../overlay/tooltipWarmth.js';

// Outside act(), React runs a hover's passive effects, and StrictMode's
// second mount of the tip that hover turned on, in a later task than the
// commit, as in a browser. The tip must still open.
const tip = () => document.querySelector('[role="tooltip"][data-open]')?.textContent ?? null;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
type ActGlobal = { IS_REACT_ACT_ENVIRONMENT?: unknown };

let root: ReactRoot | null = null;
let container: HTMLDivElement | null = null;
let actEnv: unknown;
beforeEach(() => {
  actEnv = (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT;
  (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = false;
  resetInputModality();
  resetTooltipWarmth();
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  root?.unmount();
  root = null;
  container?.remove();
  (globalThis as ActGlobal).IS_REACT_ACT_ENVIRONMENT = actEnv;
});

function App({ step }: { step: number }) {
  return (
    <Button.Root aria-label="Save" data-step={step}>
      <Button.Icon>s</Button.Icon>
    </Button.Root>
  );
}

describe('first hover on an icon-only button, outside act', () => {
  it.each([
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ])('opens the tip (strict %s, page re-rendered first %s)', async (strict, rerendered) => {
    const draw = (step: number) =>
      root!.render(
        strict ? (
          <StrictMode>
            <App step={step} />
          </StrictMode>
        ) : (
          <App step={step} />
        ),
      );
    root = createRoot(container!);
    draw(0);
    await wait(50);
    if (rerendered) {
      draw(1);
      await wait(50);
    }
    const button = container!.querySelector('button')!;
    button.dispatchEvent(
      new MouseEvent('pointerover', {
        bubbles: true,
        relatedTarget: document.body,
      }),
    );
    await wait(1500);
    expect(tip()).toBe('Save');
  });
});
