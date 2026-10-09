import { render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { describe, expect, it } from 'vitest';
import { Button, Card, Checkbox, DensityProvider, ThemeProvider } from '../index';

function cssVar(element: Element, name: string): string {
  return getComputedStyle(element).getPropertyValue(name).trim();
}

describe('token defaults in a browser', () => {
  it('gives components spacing and sizes with no provider above them', () => {
    render(
      <>
        <Button.Root data-testid="button">Save</Button.Root>
        <Checkbox data-testid="checkbox">Remember me</Checkbox>
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

  it('keeps a DensityProvider style prop over the repeated overrides', () => {
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
