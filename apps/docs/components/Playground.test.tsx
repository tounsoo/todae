// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
// seconds in jsdom. vitest.config.ts gives the docs unit tests a hang guard sized for that.
describe('Playground', () => {
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

  it('downloads the theme as a token package with its edits and their appearance', async () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return 'blob:package';
    });
    URL.revokeObjectURL = vi.fn();
    const names: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    const page = within(render(<Playground locale="en" />).container);
    fireEvent.click(screen.getByLabelText('Porcelain'));
    fireEvent.change(screen.getByLabelText('color.accent.default'), { target: { value: 'oklch(0.3 0.1 160)' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Download token package' })));
    await waitFor(() => expect(names).toEqual(['porcelain-tokens.zip']));
    expect(await page.findByText('Downloaded porcelain-tokens.zip. Its README says how to build it.')).toBeTruthy();
    // jsdom's Blob has no arrayBuffer, so read it the old way.
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(created[0] as Blob);
    });
    for (const file of ['tokens/resolver.json', 'tokens/appearance/light.json', 'tokens/appearance/dark.json', 'tokens/README.md']) expect(text).toContain(file);
    // Stored, so the edit's light value is readable in the archive.
    expect(text).toContain('0.3,\n');
    // Copy, then download the same theme: the line shows the download, then the copy again.
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy JSON' })));
    expect(await page.findByText('Copied theme override JSON.')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Download token package' })));
    expect(await page.findByText('Downloaded porcelain-tokens.zip. Its README says how to build it.')).toBeTruthy();
    click.mockRestore();
  });

  it('names the package from the Package name field, and downloads nothing while npm would refuse the name', async () => {
    const created: Blob[] = [];
    URL.createObjectURL = vi.fn((blob: Blob) => {
      created.push(blob);
      return 'blob:package';
    });
    URL.revokeObjectURL = vi.fn();
    const names: string[] = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      names.push(this.download);
    });
    render(<Playground locale="en" />);
    const field = () => screen.getByLabelText('Package name') as HTMLInputElement;
    // The name follows the preset until the reader types one.
    expect(field().value).toBe('graphite-tokens');
    fireEvent.click(screen.getByLabelText('Riso'));
    expect(field().value).toBe('riso-tokens');
    fireEvent.change(field(), { target: { value: 'Acme Tokens' } });
    expect(field().getAttribute('aria-invalid')).toBe('true');
    const error = 'Use a name npm accepts, such as acme-tokens or @acme/tokens: lowercase, with no spaces, at most 214 characters.';
    expect(screen.getByText(error)).toBeTruthy();
    expect(field().getAttribute('aria-describedby')).toContain(screen.getByText(error).id);
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Download token package' })));
    expect(names).toEqual([]);
    expect(document.activeElement).toBe(field());
    fireEvent.change(field(), { target: { value: '@acme/tokens' } });
    expect(field().getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByText(error)).toBeNull();
    // A typed name stays when the preset changes.
    fireEvent.click(screen.getByLabelText('Bloom'));
    expect(field().value).toBe('@acme/tokens');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Download token package' })));
    await waitFor(() => expect(names).toEqual(['acme-tokens.zip']));
    const text = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(created[0] as Blob);
    });
    expect(text).toContain('"name": "@acme/tokens"');
    click.mockRestore();
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

  it('keeps a preset’s own motion, or swaps it for a picked feel on the stage and in the JSON', () => {
    render(<Playground locale="en" />);
    const scale = () => stage().style.getPropertyValue('--todae-popover-motion-scale');
    const exported = () => JSON.parse(screen.getByRole('region', { name: 'Overrides' }).textContent ?? '');
    expect(screen.getByRole('button', { name: 'preset' }).getAttribute('aria-pressed')).toBe('true');
    // Graphite has no motion of its own.
    expect(scale()).toBe('');
    fireEvent.click(screen.getByLabelText('Y2K Chrome'));
    expect(scale()).toBe('0.85');
    expect(exported().light['popover.motion.scale']).toBe(0.85);
    fireEvent.click(screen.getByRole('button', { name: 'standard' }));
    expect(scale()).toBe('');
    expect(exported().light['popover.motion.scale']).toBeUndefined();
    // Its colors stay; only the motion changes.
    expect(stage().style.getPropertyValue('--todae-color-accent-default')).toBe('oklch(0.56 0.18 305)');
    fireEvent.click(screen.getByRole('button', { name: 'springy' }));
    expect(scale()).toBe('0.9');
    expect(exported().dark['popover.motion.scale']).toBe(0.9);
  });

  it('copies the opt-in motions only while Opt-in motion is on, and never slow motion', async () => {
    render(<Playground locale="en" />);
    const exported = () => JSON.parse(screen.getByRole('region', { name: 'Overrides' }).textContent ?? '');
    fireEvent.click(screen.getByRole('button', { name: 'snappy' }));
    const OPT_IN = [
      'popover.motion.offset',
      'tooltip.motion.offset',
      'tabs.motion.panel.duration',
      'steps.motion.duration',
      'option.check.motion.duration',
      'menu.item.check.motion.duration',
    ];
    for (const key of OPT_IN) expect(exported()[key], key).toBeUndefined();
    fireEvent.click(screen.getByRole('switch', { name: 'Slow motion (×4)' }));
    // Slow motion is for watching, so the JSON keeps snappy's own popup timing.
    expect(exported()['motion.popup.duration.enter']).toEqual({ value: 160, unit: 'ms' });
    fireEvent.click(screen.getByRole('switch', { name: 'Opt-in motion' }));
    // Snappy's reveal step is 140ms and its selection step 120ms, unslowed.
    expect(exported()).toMatchObject({
      'popover.motion.offset': { value: 0.5, unit: 'rem' },
      'tooltip.motion.offset': { value: 0.25, unit: 'rem' },
      'tabs.motion.panel.duration': { value: 140, unit: 'ms' },
      'steps.motion.duration': { value: 140, unit: 'ms' },
      'option.check.motion.duration': { value: 120, unit: 'ms' },
      'menu.item.check.motion.duration': { value: 120, unit: 'ms' },
    });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy JSON' })));
    expect(JSON.parse(writeText.mock.calls[0]?.[0] ?? '')).toEqual(exported());
    fireEvent.click(screen.getByRole('switch', { name: 'Opt-in motion' }));
    for (const key of OPT_IN) expect(exported()[key], key).toBeUndefined();
  });

  it('shows the preview and Todae’s own text in the page’s language', () => {
    render(<Playground locale="ko" />);
    const preview = within(screen.getByRole('region', { name: '미리보기' }));
    expect(preview.getByRole('button', { name: 'Pro로 업그레이드' })).toBeTruthy();
    expect(preview.getByRole('button', { name: '새 청구서' })).toBeTruthy();
    // The made-up money is in won here, and the totals add up from the invoices.
    expect(preview.getByRole('cell', { name: '₩2,690,000' })).toBeTruthy();
    expect(preview.queryByRole('dialog', { name: '새 청구서' })).toBeNull();
    expect(screen.getByRole('region', { name: '오버라이드' })).toBeTruthy();
    expect(screen.getByText('모션 (motion)')).toBeTruthy();
    // Names Todae writes itself come from StringsProvider.
    expect(preview.getByRole('navigation', { name: '이동 경로' })).toBeTruthy();
    expect(preview.getAllByRole('button', { name: '닫기' })).toHaveLength(2);
    expect(preview.getByRole('button', { name: '보내기' })).toBeTruthy();
    expect(preview.queryByText('Good morning, Ada')).toBeNull();
  });

  it('opens an invoice from its number, marks it paid, and undoes it', async () => {
    render(<Playground locale="en" />);
    const preview = within(stage());
    expect(preview.getByText(/2 invoices are overdue/)).toBeTruthy();
    // The toast region waits one task before it will show one.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    fireEvent.click(preview.getByRole('button', { name: 'INV-1044' }));
    const drawer = screen.getByRole('dialog', { name: 'INV-1044, Initech' });
    expect(within(drawer).getByText('Payment is 12 days late.')).toBeTruthy();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Mark paid' }));
    expect(screen.getByText('INV-1044 marked paid')).toBeTruthy();
    expect(preview.getByText(/1 invoice is overdue/)).toBeTruthy();
    // Paid, it has nothing left to do, so its actions are gone.
    expect(within(drawer).queryByRole('button', { name: 'Mark paid' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(preview.getByText(/2 invoices are overdue/)).toBeTruthy();
    expect(within(drawer).getByRole('button', { name: 'Mark paid' })).toBeTruthy();
  });

  /** The invoice list's table: the stage's other table is the motion readout, named by its caption. */
  const invoiceTable = () => within(stage()).getAllByRole('table').find((table) => table.querySelector('caption') === null)!;

  it('makes a new invoice only once the form holds a customer and an amount', async () => {
    render(<Playground locale="en" />);
    const preview = within(stage());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    fireEvent.click(preview.getByRole('button', { name: 'New invoice' }));
    const dialog = screen.getByRole('dialog', { name: 'New invoice' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create invoice' }));
    expect(screen.queryByText('INV-1046 created')).toBeNull();
    expect(screen.getByRole('dialog', { name: 'New invoice' })).toBe(dialog);
    // Customer and Amount, each in the summary and under its field.
    expect(within(dialog).getAllByText('This field is required')).toHaveLength(4);
    // Closed and opened again, it starts clean.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New invoice' })).toBeNull());
    fireEvent.click(preview.getByRole('button', { name: 'New invoice' }));
    expect(within(dialog).queryByText('This field is required')).toBeNull();
    fireEvent.change(within(dialog).getByLabelText('Customer'), { target: { value: 'Globex' } });
    const amount = within(dialog).getByLabelText('Amount');
    fireEvent.change(amount, { target: { value: '500' } });
    fireEvent.blur(amount);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create invoice' }));
    expect(screen.getByText('INV-1046 created')).toBeTruthy();
    // The dialog plays its exit before it leaves.
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'New invoice' })).toBeNull());
    // It starts as a draft, and the list is sorted newest first, so it leads.
    // The invoice list's rows, not the motion replay's readout above it.
    const first = within(invoiceTable()).getAllByRole('row')[1]!;
    expect(within(first).getByRole('button', { name: 'INV-1046' })).toBeTruthy();
    expect(within(first).getByText('Draft')).toBeTruthy();
  });

  it('finds an invoice from Ctrl K and opens it', () => {
    render(<Playground locale="en" />);
    fireEvent.keyDown(document.body, { key: 'k', ctrlKey: true });
    const search = screen.getByRole('dialog', { name: 'Search' });
    const input = within(search).getByRole('combobox', { name: 'Search invoices and commands' });
    fireEvent.change(input, { target: { value: 'vandelay' } });
    const option = within(search).getByRole('option', { name: 'Open INV-1039, Vandelay' });
    fireEvent.click(option);
    expect(screen.getByRole('dialog', { name: 'INV-1039, Vandelay' })).toBeTruthy();
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
