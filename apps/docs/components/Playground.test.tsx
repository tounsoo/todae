// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Playground } from './Playground';

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  writeText.mockReset().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
  window.matchMedia = vi.fn((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
  }));
  // jsdom has no canvas; the color input then shows black.
  HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
});

afterEach(cleanup);

// The preview region sits inside the stage's ThemeProvider, which carries the overrides.
const stage = () => screen.getByRole('region', { name: 'Preview' });

describe('Playground', () => {
  it('paints the stage with a preset and its light or dark overrides', () => {
    render(<Playground locale="en" />);
    expect(stage().style.getPropertyValue('--todae-color-accent-default')).toBe('');
    fireEvent.click(screen.getByLabelText('Forest'));
    expect(stage().style.getPropertyValue('--todae-color-accent-default')).toBe('oklch(0.47 0.1 160)');
    fireEvent.click(screen.getByRole('button', { name: 'dark' }));
    expect(stage().getAttribute('data-appearance')).toBe('dark');
    expect(stage().style.getPropertyValue('--todae-color-accent-default')).toBe('oklch(0.8 0.12 160)');
  });

  it('commits a token as soon as it parses and marks it invalid until then', () => {
    render(<Playground locale="en" />);
    const input = screen.getByLabelText('color.accent.default');
    fireEvent.change(input, { target: { value: 'oklch(0.5' } });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(stage().style.getPropertyValue('--todae-color-accent-default')).toBe('');
    fireEvent.change(input, { target: { value: 'oklch(0.5 0.1 30)' } });
    expect(input.getAttribute('aria-invalid')).not.toBe('true');
    expect(stage().style.getPropertyValue('--todae-color-accent-default')).toBe('oklch(0.5 0.1 30)');
    expect(screen.getByText('1 changed')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(stage().style.getPropertyValue('--todae-color-accent-default')).toBe('');
    // Reset stays enabled, so pressing it never drops keyboard focus.
    expect(screen.getByRole('button', { name: 'Reset' }).hasAttribute('disabled')).toBe(false);
  });

  it('filters the token list', () => {
    render(<Playground locale="en" />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter tokens' }), { target: { value: 'on-accent' } });
    const rows = document.querySelectorAll('.token-row');
    expect(rows).toHaveLength(1);
    expect(within(rows[0] as HTMLElement).getByText('color.on-accent')).toBeTruthy();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Filter tokens' }), { target: { value: 'nothing-matches' } });
    expect(screen.getByText('No token matches.')).toBeTruthy();
  });

  it('copies one flat set when light and dark agree, and both sets when they differ', async () => {
    render(<Playground locale="en" />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy JSON' })));
    expect(JSON.parse(writeText.mock.calls[0]?.[0] ?? '')).toEqual({});
    expect(await screen.findByText('Copied theme override JSON.')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Forest'));
    // The status was for the old theme, so it gives way to the hint again.
    expect(screen.queryByText('Copied theme override JSON.')).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy JSON' })));
    const copied = JSON.parse(writeText.mock.calls[1]?.[0] ?? '');
    expect(Object.keys(copied)).toEqual(['light', 'dark']);
    expect(copied.light['color.accent.default']).toEqual({ colorSpace: 'oklch', components: [0.47, 0.1, 160] });
    expect(copied.dark['color.accent.default']).toEqual({ colorSpace: 'oklch', components: [0.8, 0.12, 160] });
  });

  it('keeps an edit to the appearance it was made in', async () => {
    render(<Playground locale="en" />);
    fireEvent.click(screen.getByLabelText('Forest'));
    fireEvent.change(screen.getByLabelText('color.accent.default'), { target: { value: 'oklch(0.3 0.1 160)' } });
    fireEvent.click(screen.getByRole('button', { name: 'dark' }));
    expect(stage().style.getPropertyValue('--todae-color-accent-default')).toBe('oklch(0.8 0.12 160)');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy JSON' })));
    const copied = JSON.parse(writeText.mock.calls[0]?.[0] ?? '');
    expect(copied.light['color.accent.default']).toEqual({ colorSpace: 'oklch', components: [0.3, 0.1, 160] });
    expect(copied.dark['color.accent.default']).toEqual({ colorSpace: 'oklch', components: [0.8, 0.12, 160] });
  });

  it('shows when the copy fails', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    render(<Playground locale="en" />);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy JSON' })));
    expect(await screen.findByText('Could not copy. Clipboard permission was denied.')).toBeTruthy();
  });

  it('puts the overrides on the element that carries the density', () => {
    render(<Playground locale="en" />);
    fireEvent.click(screen.getByLabelText('Forest'));
    expect(stage().getAttribute('data-density')).toBe('comfortable');
    expect(stage().getAttribute('data-appearance')).toBe('system');
    expect(stage().style.getPropertyValue('--todae-color-accent-default')).toBe('oklch(0.47 0.1 160)');
  });

  it('starts a new preset without the last preset’s edits', () => {
    render(<Playground locale="en" />);
    fireEvent.change(screen.getByLabelText('color.accent.default'), { target: { value: 'oklch(0.5 0.1 30)' } });
    fireEvent.click(screen.getByLabelText('Grape'));
    expect(screen.queryByText('1 changed')).toBeNull();
    expect(stage().style.getPropertyValue('--todae-color-accent-default')).toBe('oklch(0.5 0.2 300)');
  });
});
