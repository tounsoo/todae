import { commands } from '@vitest/browser/context';
import { render } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { ThemeProvider } from '../index.js';

declare module '@vitest/browser/context' {
  interface BrowserCommands {
    /** An empty scope builds without `--scope`. */
    scopedThemeCss: (scope: string, options: { empty?: boolean; core?: Record<string, unknown>; brand?: Record<string, unknown> }) => Promise<string>;
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

  it("keeps an outer ThemeProvider's overrides out of a scope, and takes those on or inside it", () => {
    const wide = { 'button.base.font.letter-spacing': { value: 0.5, unit: 'rem' } } as const;
    const spacing = (testId: string) =>
      getComputedStyle(document.querySelector(`[data-testid="${testId}"]`)!).getPropertyValue('--todae-button-base-font-letter-spacing').trim();
    render(
      <>
        <div className="plain" data-testid="plain" />
        <ThemeProvider overrides={wide}>
          <div data-testid="outer" />
          <div className="plain" data-testid="scoped">
            <ThemeProvider appearance="dark">
              <div data-testid="scoped-provider" />
            </ThemeProvider>
            <ThemeProvider overrides={wide}>
              <div data-testid="inner" />
            </ThemeProvider>
          </div>
          <ThemeProvider overrides={wide} className="plain">
            <div data-testid="on-scope" />
          </ThemeProvider>
        </ThemeProvider>
      </>,
    );
    expect(spacing('outer')).toBe('0.5rem');
    for (const id of ['scoped', 'scoped-provider']) expect(spacing(id), id).toBe(spacing('plain'));
    for (const id of ['inner', 'on-scope']) expect(spacing(id), id).toBe('0.5rem');
  });

  it('wins on the root element over a theme built without a scope', async () => {
    const red = { brand: { logo: { fg: { $type: 'color', $value: { colorSpace: 'oklch', components: [0.5, 0.2, 25] } } } } };
    const unscoped = document.createElement('style');
    unscoped.textContent = await commands.scopedThemeCss('', { brand: red });
    document.head.append(unscoped);
    document.documentElement.classList.add('acme');
    try {
      const probe = document.createElement('i');
      probe.style.color = 'var(--todae-brand-logo-fg)';
      document.body.append(probe);
      expect(getComputedStyle(probe).color).toBe(computed(ACME_INK));
      probe.remove();
    } finally {
      document.documentElement.classList.remove('acme');
      unscoped.remove();
    }
  });

  it('takes an alias attribute set on the scope element itself', () => {
    render(
      <>
        <div className="acme" data-testid="primary" />
        <div className="acme" data-button-variant="outline" data-testid="outline" />
      </>,
    );
    expect(tokenColor('primary', 'button-bg-default')).toBe(computed(ACME_LIGHT));
    expect(tokenColor('outline', 'button-bg-default')).toBe(tokenColor('outline', 'button-outline-bg-default'));
    expect(tokenColor('outline', 'button-bg-default')).not.toBe(computed(ACME_LIGHT));
  });

  it('follows an appearance set on the root element', () => {
    document.documentElement.setAttribute('data-appearance', 'dark');
    render(<div className="acme" data-testid="acme" />);
    expect(tokenColor('acme', 'color-accent-default')).toBe(computed(ACME_DARK));
  });
});
