import { commands } from '@vitest/browser/context';
import { render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ThemeProvider } from '../index.js';

declare module '@vitest/browser/context' {
  interface BrowserCommands {
    scopedThemeCss: (scope: string, options: { empty?: boolean; core?: Record<string, unknown> }) => Promise<string>;
  }
}

const ACME_LIGHT = 'oklch(0.45 0.16 25)';
const ACME_DARK = 'oklch(0.78 0.13 25)';
const ACME_INK = 'oklch(0.19 0.03 140)';
const styles: HTMLStyleElement[] = [];

/** The computed color an element gets from `value`, so token values compare as the browser writes them. */
function computed(value: string): string {
  const probe = document.createElement('i');
  probe.style.color = value;
  document.body.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

function tokenColor(testId: string, token: string): string {
  const probe = document.createElement('i');
  probe.style.color = `var(--todae-${token})`;
  document.querySelector(`[data-testid="${testId}"]`)!.append(probe);
  const color = getComputedStyle(probe).color;
  probe.remove();
  return color;
}

beforeAll(async () => {
  const core = { color: { gray: { 900: { $type: 'color', $value: { colorSpace: 'oklch', components: [0.19, 0.03, 140] } } } } };
  for (const css of [
    await commands.scopedThemeCss('.acme', { core }),
    await commands.scopedThemeCss('.plain', { empty: true }),
  ]) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.append(style);
    styles.push(style);
  }
  return () => styles.forEach((style) => style.remove());
});

afterEach(() => document.documentElement.removeAttribute('data-appearance'));

describe('todae-tokens build --scope', () => {
  it('themes only inside the scope, and re-resolves Todae tokens that read a scoped core change', () => {
    render(
      <>
        <div data-testid="outside" />
        <div className="acme" data-testid="acme" />
      </>,
    );
    const todaeInk = tokenColor('outside', 'color-gray-900');
    expect(todaeInk).not.toBe(computed(ACME_INK));
    expect(tokenColor('outside', 'color-fg-default')).toBe(todaeInk);
    expect(tokenColor('acme', 'color-accent-default')).toBe(computed(ACME_LIGHT));
    expect(tokenColor('acme', 'color-fg-default')).toBe(computed(ACME_INK));
    expect(tokenColor('acme', 'button-bg-default')).toBe(computed(ACME_LIGHT));
  });

  it('takes the appearance of the nearest provider around, on or inside the scope', () => {
    render(
      <ThemeProvider appearance="dark">
        <div className="acme" data-testid="under-dark" />
        <ThemeProvider appearance="light">
          <div className="acme" data-testid="under-light" />
        </ThemeProvider>
        <ThemeProvider appearance="light" className="acme" data-testid="on-scope" />
        <div className="acme">
          <ThemeProvider appearance="dark">
            <div data-testid="inside" />
          </ThemeProvider>
        </div>
      </ThemeProvider>,
    );
    expect(tokenColor('under-dark', 'color-accent-default')).toBe(computed(ACME_DARK));
    expect(tokenColor('under-light', 'color-accent-default')).toBe(computed(ACME_LIGHT));
    expect(tokenColor('on-scope', 'color-accent-default')).toBe(computed(ACME_LIGHT));
    expect(tokenColor('inside', 'color-accent-default')).toBe(computed(ACME_DARK));
  });

  it('lets the nearest of two nested scoped themes win, in either nesting', () => {
    render(
      <>
        <div data-testid="todae" />
        <div className="acme">
          <div className="plain" data-testid="plain-in-acme">
            <ThemeProvider appearance="light">
              <div data-testid="plain-provider" />
            </ThemeProvider>
          </div>
        </div>
        <div className="plain">
          <div className="acme" data-testid="acme-in-plain">
            <ThemeProvider appearance="light">
              <div data-testid="acme-provider" />
            </ThemeProvider>
          </div>
        </div>
      </>,
    );
    const todaeAccent = tokenColor('todae', 'color-accent-default');
    for (const id of ['plain-in-acme', 'plain-provider']) {
      expect(tokenColor(id, 'color-accent-default'), id).toBe(todaeAccent);
      expect(tokenColor(id, 'color-fg-default'), id).toBe(tokenColor('todae', 'color-fg-default'));
    }
    for (const id of ['acme-in-plain', 'acme-provider']) {
      expect(tokenColor(id, 'color-accent-default'), id).toBe(computed(ACME_LIGHT));
      expect(tokenColor(id, 'color-fg-default'), id).toBe(computed(ACME_INK));
    }
  });

  it('follows an appearance set on the root element', () => {
    document.documentElement.setAttribute('data-appearance', 'dark');
    render(<div className="acme" data-testid="acme" />);
    expect(tokenColor('acme', 'color-accent-default')).toBe(computed(ACME_DARK));
  });
});
