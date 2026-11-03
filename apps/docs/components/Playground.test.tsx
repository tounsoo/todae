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

// Each test renders the whole playground, preview included, and every edit re-renders it, which takes
// seconds in jsdom; the default 5s timeout fails under a loaded parallel run.
describe('Playground', { timeout: 15_000 }, () => {
  it('paints the stage with a preset and its light or dark overrides', () => {
    render(<Playground locale="en" />);
    expect(stage().style.getPropertyValue('--todae-color-accent-default')).toBe('');
    fireEvent.click(screen.getByLabelText('Porcelain'));
    expect(stage().style.getPropertyValue('--todae-color-accent-default')).toBe('oklch(0.5 0.09 165)');
    fireEvent.click(screen.getByRole('button', { name: 'dark' }));
    expect(stage().getAttribute('data-appearance')).toBe('dark');
    expect(stage().style.getPropertyValue('--todae-color-accent-default')).toBe('oklch(0.8 0.077 165)');
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
    // Queries stay in the container, so the announcer's live region in body doesn't match the status text.
    const page = within(render(<Playground locale="en" />).container);
    const overrides = screen.getByRole('region', { name: 'Overrides' });
    expect(JSON.parse(overrides.textContent ?? '')).toEqual({});
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy overrides' })));
    expect(JSON.parse(writeText.mock.calls[0]?.[0] ?? '')).toEqual({});
    expect(await page.findByText('Copied theme override JSON.')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Porcelain'));
    // The status was for the old theme, so it gives way to the hint again.
    expect(page.queryByText('Copied theme override JSON.')).toBeNull();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy JSON' })));
    const copied = JSON.parse(writeText.mock.calls[1]?.[0] ?? '');
    expect(Object.keys(copied)).toEqual(['light', 'dark']);
    expect(copied.light['color.accent.default']).toEqual({ colorSpace: 'oklch', components: [0.5, 0.09, 165] });
    expect(copied.dark['color.accent.default']).toEqual({ colorSpace: 'oklch', components: [0.8, 0.077, 165] });
    expect(JSON.parse(screen.getByRole('region', { name: 'Overrides' }).textContent ?? '')).toEqual(copied);
  });

  it('keeps an edit to the appearance it was made in', async () => {
    render(<Playground locale="en" />);
    fireEvent.click(screen.getByLabelText('Porcelain'));
    fireEvent.change(screen.getByLabelText('color.accent.default'), { target: { value: 'oklch(0.3 0.1 160)' } });
    fireEvent.click(screen.getByRole('button', { name: 'dark' }));
    expect(stage().style.getPropertyValue('--todae-color-accent-default')).toBe('oklch(0.8 0.077 165)');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy JSON' })));
    const copied = JSON.parse(writeText.mock.calls[0]?.[0] ?? '');
    expect(copied.light['color.accent.default']).toEqual({ colorSpace: 'oklch', components: [0.3, 0.1, 160] });
    expect(copied.dark['color.accent.default']).toEqual({ colorSpace: 'oklch', components: [0.8, 0.077, 165] });
  });

  it('shows when the copy fails', async () => {
    writeText.mockRejectedValue(new Error('denied'));
    const page = within(render(<Playground locale="en" />).container);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy JSON' })));
    expect(await page.findByText('Could not copy. Clipboard permission was denied.')).toBeTruthy();
  });

  it('puts the overrides on the element that carries the density', () => {
    render(<Playground locale="en" />);
    fireEvent.click(screen.getByLabelText('Porcelain'));
    expect(stage().getAttribute('data-density')).toBe('comfortable');
    expect(stage().getAttribute('data-appearance')).toBe('system');
    expect(stage().style.getPropertyValue('--todae-color-accent-default')).toBe('oklch(0.5 0.09 165)');
  });

  it('starts a new preset without the last preset’s edits', () => {
    render(<Playground locale="en" />);
    fireEvent.change(screen.getByLabelText('color.accent.default'), { target: { value: 'oklch(0.5 0.1 30)' } });
    fireEvent.click(screen.getByLabelText('Bloom'));
    expect(screen.queryByText('1 changed')).toBeNull();
    expect(stage().style.getPropertyValue('--todae-color-accent-default')).toBe('oklch(0.6 0.25 350)');
  });

  it('shows the preview and Todae’s own text in the page’s language', () => {
    render(<Playground locale="ko" />);
    const preview = within(screen.getByRole('region', { name: '미리보기' }));
    expect(preview.getByRole('button', { name: 'Pro로 업그레이드' })).toBeTruthy();
    expect(preview.getByRole('button', { name: '대기' })).toBeTruthy();
    expect(preview.getByRole('button', { name: '자세히' })).toBeTruthy();
    expect(preview.queryByRole('dialog', { name: '청구서 상세' })).toBeNull();
    expect(screen.getByRole('region', { name: '오버라이드' })).toBeTruthy();
    // Names Todae writes itself come from StringsProvider.
    expect(preview.getByRole('navigation', { name: '이동 경로' })).toBeTruthy();
    expect(preview.getAllByRole('button', { name: '닫기' })).toHaveLength(2);
    expect(preview.getByRole('button', { name: '보내기' })).toBeTruthy();
    expect(preview.queryByText('Good morning, Ada')).toBeNull();
  });

  it('opens a dialog, a note and a toast only from their buttons', async () => {
    render(<Playground locale="en" />);
    const preview = within(stage());
    expect(preview.queryByRole('dialog', { name: 'Invoice details' })).toBeNull();
    const note = preview.getByRole('dialog', { name: 'Invoice note' });
    expect(note.hasAttribute('data-popover-open')).toBe(false);
    expect(screen.queryByText('Invoice sent')).toBeNull();

    // The toast region waits one task before it will show one, so a toast is not on screen at load.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(screen.queryByText('Invoice sent')).toBeNull();

    fireEvent.click(preview.getByRole('button', { name: 'Notify' }));
    expect(screen.getByText('Invoice sent')).toBeTruthy();

    fireEvent.click(preview.getByRole('button', { name: 'Details' }));
    expect(screen.getByRole('dialog', { name: 'Invoice details' })).toBeTruthy();

    fireEvent.click(preview.getByRole('button', { name: 'Note' }));
    expect(note.hasAttribute('data-popover-open')).toBe(true);
    expect(screen.getByText('A short note about this invoice.')).toBeTruthy();
  });

  it("copies the shown reply's markdown, and Regenerate clears the copied mark and the rating", async () => {
    render(<Playground locale="en" />);
    const reply = within(stage()).getByRole('toolbar', { name: 'Reply' });
    const copyButton = within(reply).getByRole('button', { name: 'Copy' });
    await act(async () => fireEvent.click(copyButton));
    expect(writeText).toHaveBeenCalledWith(
      'Yes. Open **Billing**, pick the range, then choose `Export CSV`. Here is last quarter’s file.',
    );
    expect(copyButton.querySelector('.lucide-check')).not.toBeNull();
    const good = within(reply).getByRole('button', { name: 'Good reply' });
    fireEvent.click(good);
    expect(good.getAttribute('aria-pressed')).toBe('true');

    fireEvent.click(within(reply).getByRole('button', { name: 'Regenerate' }));
    expect(within(stage()).getByText(/set the range to last quarter/)).toBeTruthy();
    expect(copyButton.querySelector('.lucide-check')).toBeNull();
    expect(good.getAttribute('aria-pressed')).toBe('false');
  });
});
