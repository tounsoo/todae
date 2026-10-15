import { render, screen } from '@testing-library/react';
import { cdp, userEvent } from '@vitest/browser/context';
import { StrictMode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, Card, Checkbox, DensityProvider, ThemeProvider } from '../index';
import { measureContrast } from '../providers/overrideContrast';

/** vitest types the session without its methods; Playwright's session has `send`. */
function emulateMedia(features: { name: string; value: string }[]) {
  return (cdp() as unknown as { send(method: string, params: object): Promise<unknown> }).send('Emulation.setEmulatedMedia', {
    features,
  });
}

function cssVar(element: Element, name: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

describe('token defaults in a browser', () => {
  it('gives components spacing and sizes with no provider above them', () => {
    render(
      <>
        <Button.Root data-testid="button">Save</Button.Root>
        <Checkbox.Root data-testid="checkbox">Remember me</Checkbox.Root>
      </>,
    );
    const button = screen.getByTestId('button');
    expect(parseFloat(getComputedStyle(button).paddingInlineStart)).toBeGreaterThan(0);
    expect(cssVar(button, '--todae-button-bg-default')).not.toBe('');
    expect(cssVar(document.documentElement, '--todae-space-control-x')).not.toBe('');
    expect(cssVar(document.documentElement, '--todae-space-selection-size')).not.toBe('');
  });

  it('gives components spacing under a ThemeProvider alone', () => {
    render(
      <ThemeProvider appearance="light">
        <Button.Root data-testid="button">Save</Button.Root>
      </ThemeProvider>,
    );
    expect(parseFloat(getComputedStyle(screen.getByTestId('button')).paddingInlineStart)).toBeGreaterThan(0);
  });

  it('makes a root density differ from the root default', () => {
    render(<Button.Root data-testid="button">Save</Button.Root>);
    const fallback = getComputedStyle(screen.getByTestId('button')).paddingInlineStart;
    document.documentElement.setAttribute('data-density', 'compact');
    try {
      const compact = getComputedStyle(screen.getByTestId('button')).paddingInlineStart;
      expect(parseFloat(compact)).toBeLessThan(parseFloat(fallback));
    } finally {
      document.documentElement.removeAttribute('data-density');
    }
  });

  it('lets a density on the root element win over the root default', () => {
    document.documentElement.setAttribute('data-density', 'compact');
    try {
      render(<Button.Root data-testid="button">Save</Button.Root>);
      const compact = getComputedStyle(screen.getByTestId('button')).paddingInlineStart;
      document.documentElement.setAttribute('data-density', 'spacious');
      const spacious = getComputedStyle(screen.getByTestId('button')).paddingInlineStart;
      expect(parseFloat(compact)).toBeLessThan(parseFloat(spacious));
    } finally {
      document.documentElement.removeAttribute('data-density');
    }
  });
});

describe('ThemeProvider overrides in a browser', () => {
  it('reach components inside a nested DensityProvider', () => {
    render(
      <ThemeProvider
        appearance="light"
        overrides={{
          'card.bg': { colorSpace: 'oklch', components: [0.6, 0.15, 30] },
          'color.fg.default': { colorSpace: 'oklch', components: [0.3, 0.1, 30] },
        }}
      >
        <Card.Root data-testid="outer">Outer</Card.Root>
        <DensityProvider density="compact">
          <Card.Root data-testid="inner">Inner</Card.Root>
          <DensityProvider density="spacious">
            <Card.Root data-testid="innermost">Innermost</Card.Root>
          </DensityProvider>
        </DensityProvider>
      </ThemeProvider>,
    );
    const outer = getComputedStyle(screen.getByTestId('outer')).backgroundColor;
    expect(getComputedStyle(screen.getByTestId('inner')).backgroundColor).toBe(outer);
    expect(getComputedStyle(screen.getByTestId('innermost')).backgroundColor).toBe(outer);
    expect(getComputedStyle(screen.getByTestId('inner')).color).toBe(getComputedStyle(screen.getByTestId('outer')).color);
  });

  it('keep an outer component override inside a nested ThemeProvider', () => {
    render(
      <ThemeProvider appearance="light" overrides={{ 'card.bg': { colorSpace: 'oklch', components: [0.6, 0.15, 30] } }}>
        <Card.Root data-testid="outer">Outer</Card.Root>
        <ThemeProvider appearance="dark" overrides={{ 'color.fg.default': { colorSpace: 'oklch', components: [0.9, 0.05, 250] } }}>
          <DensityProvider density="compact">
            <Card.Root data-testid="inner">Inner</Card.Root>
          </DensityProvider>
        </ThemeProvider>
      </ThemeProvider>,
    );
    expect(getComputedStyle(screen.getByTestId('inner')).backgroundColor).toBe(
      getComputedStyle(screen.getByTestId('outer')).backgroundColor,
    );
  });

  it('leave the app’s font alone and expose the typeface as a token', () => {
    render(
      <div style={{ fontFamily: 'Courier New' }}>
        <ThemeProvider overrides={{ 'font.family.sans': ['Georgia'] }}>
          <DensityProvider>
            <span data-testid="text">Text</span>
          </DensityProvider>
        </ThemeProvider>
      </div>,
    );
    const text = screen.getByTestId('text');
    expect(getComputedStyle(text).fontFamily).toBe('"Courier New"');
    expect(cssVar(text, '--todae-text-font-family')).toContain('Georgia');
  });

  it('let a nested DensityProvider change an overridden spacing token', () => {
    render(
      <ThemeProvider overrides={{ 'space.control.x': { value: 2.5, unit: 'rem' } }}>
        <Button.Root data-testid="outer">Save</Button.Root>
        <DensityProvider density="compact">
          <Button.Root data-testid="inner">Save</Button.Root>
        </DensityProvider>
      </ThemeProvider>,
    );
    const outer = parseFloat(getComputedStyle(screen.getByTestId('outer')).paddingInlineStart);
    const inner = parseFloat(getComputedStyle(screen.getByTestId('inner')).paddingInlineStart);
    expect(outer).toBe(40);
    expect(inner).toBeLessThan(outer);
  });

  it('keep a component override inside a plain element with a density', () => {
    render(
      <ThemeProvider appearance="light" overrides={{ 'card.bg': { colorSpace: 'oklch', components: [0.6, 0.15, 30] } }}>
        <Card.Root data-testid="outer">Outer</Card.Root>
        <div data-density="compact">
          <Card.Root data-testid="inner">Inner</Card.Root>
        </div>
      </ThemeProvider>,
    );
    expect(getComputedStyle(screen.getByTestId('inner')).backgroundColor).toBe(
      getComputedStyle(screen.getByTestId('outer')).backgroundColor,
    );
  });

  it('let a nested appearance replace an appearance token override', () => {
    render(
      <>
        <ThemeProvider appearance="light" overrides={{ 'color.fg.default': { colorSpace: 'oklch', components: [0.3, 0.1, 30] } }}>
          <ThemeProvider appearance="dark">
            <Card.Root data-testid="nested">Nested</Card.Root>
          </ThemeProvider>
        </ThemeProvider>
        <ThemeProvider appearance="dark">
          <Card.Root data-testid="plain">Plain</Card.Root>
        </ThemeProvider>
      </>,
    );
    expect(getComputedStyle(screen.getByTestId('nested')).color).toBe(getComputedStyle(screen.getByTestId('plain')).color);
  });

  it('keeps a DensityProvider style prop', () => {
    render(
      <ThemeProvider overrides={{ 'card.bg': { colorSpace: 'oklch', components: [0.6, 0.15, 30] } }}>
        <DensityProvider data-testid="density" style={{ ['--todae-card-bg' as string]: 'red' }}>
          <Card.Root data-testid="card">Card</Card.Root>
        </DensityProvider>
      </ThemeProvider>,
    );
    expect(getComputedStyle(screen.getByTestId('card')).backgroundColor).toBe('rgb(255, 0, 0)');
  });
});

describe('Button paints in a browser', () => {
  for (const appearance of ['light', 'dark'] as const) {
    for (const variant of ['secondary', 'ghost'] as const) {
      it(`changes a ${variant} button's background on hover in ${appearance}`, async () => {
        render(
          <ThemeProvider appearance={appearance}>
            <Button.Root variant={variant} data-testid="button">
              Save
            </Button.Root>
            <span data-testid="away">Away</span>
          </ThemeProvider>,
        );
        const button = screen.getByTestId('button');
        await userEvent.hover(screen.getByTestId('away'));
        const rest = getComputedStyle(button).backgroundColor;
        await userEvent.hover(button);
        expect(getComputedStyle(button).backgroundColor).not.toBe(rest);
      });

      it(`keeps a pressed ${variant} toggle's fill on hover in ${appearance}`, async () => {
        render(
          <ThemeProvider appearance={appearance}>
            <Button.Root variant={variant} defaultPressed data-testid="button">
              Bold
            </Button.Root>
            <span data-testid="away">Away</span>
          </ThemeProvider>,
        );
        const button = screen.getByTestId('button');
        await userEvent.hover(screen.getByTestId('away'));
        const pressed = getComputedStyle(button).backgroundColor;
        expect(pressed).not.toBe('rgba(0, 0, 0, 0)');
        await userEvent.hover(button);
        expect(getComputedStyle(button).backgroundColor).toBe(pressed);
      });
    }
  }
});

describe('system appearance in a browser', () => {
  it('follows prefers-color-scheme in CSS, with no script', async () => {
    render(
      <>
        <ThemeProvider appearance="system" data-testid="system" />
        <ThemeProvider appearance="light" data-testid="light" />
        <ThemeProvider appearance="dark" data-testid="dark" />
      </>,
    );
    const system = screen.getByTestId('system');
    const canvas = (id: string) => cssVar(screen.getByTestId(id), '--todae-color-bg-canvas');
    try {
      await emulateMedia([{ name: 'prefers-color-scheme', value: 'dark' }]);
      expect(canvas('system')).toBe(canvas('dark'));
      expect(getComputedStyle(system).colorScheme).toBe('dark');
      await emulateMedia([{ name: 'prefers-color-scheme', value: 'light' }]);
      expect(canvas('system')).toBe(canvas('light'));
      expect(getComputedStyle(system).colorScheme).toBe('light');
    } finally {
      await emulateMedia([]);
    }
  });
});

describe('ThemeProvider override contrast in development', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("measures every declared pair and passes them with Todae's own colors", () => {
    for (const appearance of ['light', 'dark'] as const) {
      render(<ThemeProvider appearance={appearance} data-testid={appearance} />);
      expect(measureContrast(screen.getByTestId(appearance)), appearance).toEqual({ failures: [], skipped: [] });
    }
  });

  it('warns once about the pairs an override pushes below their minimum', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { rerender } = render(<ThemeProvider appearance="light" overrides={{ 'card.bg': { colorSpace: 'oklch', components: [0.6, 0.15, 30] } }} />);
    expect(warn).not.toHaveBeenCalled();
    // A light accent leaves white on-accent text unreadable.
    const light = { 'color.accent.default': { colorSpace: 'oklch', components: [0.92, 0.05, 90] } } as const;
    rerender(<ThemeProvider appearance="light" overrides={light} />);
    expect(warn).toHaveBeenCalledTimes(1);
    const message = String(warn.mock.calls[0]![0]);
    expect(message).toContain('in light');
    expect(message).toMatch(/color\.on-accent on color\.accent\.default is Lc \d+\.\d, below 60/);
    rerender(<ThemeProvider appearance="light" overrides={{ ...light }} />);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('warns once under StrictMode', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <StrictMode>
        <ThemeProvider appearance="light" overrides={{ 'color.accent.default': { colorSpace: 'oklch', components: [0.92, 0.05, 90] } }} />
      </StrictMode>,
    );
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('names the surface a translucent background fails over', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <ThemeProvider
        appearance="light"
        overrides={{
          'field.bg.default': { colorSpace: 'oklch', components: [0.5, 0, 0], alpha: 0.2 },
          'color.fg.placeholder': { colorSpace: 'oklch', components: [0.75, 0, 0] },
        }}
      />,
    );
    expect(String(warn.mock.calls[0]![0])).toMatch(/field\.fg\.placeholder on field\.bg\.default over color\.bg\.subtle is Lc/);
  });

  it("doesn't blame a provider for a failure it didn't cause", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      // Component tokens read an outer provider's overrides through nested providers.
      <ThemeProvider appearance="light" overrides={{ 'nav.item.fg.current': { colorSpace: 'oklch', components: [0.9, 0, 0] } }}>
        <ThemeProvider appearance="light" overrides={{ 'card.bg': { colorSpace: 'oklch', components: [0.6, 0.15, 30] } }} data-testid="inner" />
      </ThemeProvider>,
    );
    // Only the outer provider, whose accent fails, warns.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(measureContrast(screen.getByTestId('inner')).failures.length).toBeGreaterThan(0);
  });

  it("skips a pair whose tokens aren't defined, instead of reading the inherited color", () => {
    // A page without Todae's CSS defines none of the tokens.
    const frame = document.createElement('iframe');
    document.body.append(frame);
    const host = frame.contentDocument!.body;
    host.style.color = 'black';
    try {
      const { failures, skipped } = measureContrast(host);
      expect(failures).toEqual([]);
      expect(skipped.length).toBeGreaterThan(0);
    } finally {
      frame.remove();
    }
  });
});
