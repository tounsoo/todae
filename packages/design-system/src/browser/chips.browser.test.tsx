import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BottomSheet } from '../components/BottomSheet.js';
import { Chip } from '../components/Chip.js';
import { ChipList } from '../components/ChipList.js';
import { Dialog } from '../components/Dialog.js';
import { Field } from '../components/Field.js';
import { useChipField } from '../hooks/useChipField.js';
import { StringsProvider } from '../providers/StringsProvider.js';

const TAGS = ['design', 'tokens', 'accessibility', 'react', 'density', 'dark mode', 'docs', 'motion', 'layout', 'forms'];

function ChipField({ width }: { width: number }) {
  return (
    <div data-appearance="light" data-density="comfortable" style={{ width }}>
      <Field.Root>
        <Field.ChipInput
          aria-label="Tags"
          chips={TAGS}
          inputValue=""
          onInputValueChange={() => undefined}
          onCommit={() => undefined}
          onChipRemove={() => undefined}
          maxRows={1}
        />
      </Field.Root>
    </div>
  );
}

/** The chips, overflow chip and input that are laid out (not the inert measure copy, the +N name beside the +N chip, or the hidden value input). */
function liveNodes(): HTMLElement[] {
  const flow = screen.getByRole('textbox').parentElement!;
  return [...flow.children].filter(
    (el): el is HTMLElement =>
      el instanceof HTMLElement &&
      !el.hasAttribute('inert') &&
      !el.hasAttribute('data-todae-value-input') &&
      !el.previousElementSibling?.hasAttribute('data-overflow'),
  );
}

function hiddenCount(): number {
  const overflow = liveNodes().find((el) => el.hasAttribute('data-overflow'));
  // The chip reads "+N"; the hidden label beside it says "N more".
  return overflow ? Number(overflow.textContent?.slice(1) ?? 0) : 0;
}

describe('Field.ChipInput overflow in a browser', () => {
  it('folds chips into +N so everything fits on one row', async () => {
    render(<ChipField width={320} />);
    await waitFor(() => expect(hiddenCount()).toBeGreaterThan(0));
    const nodes = liveNodes();
    const tops = new Set(nodes.map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(tops.size).toBe(1);
    const chips = nodes.filter((el) => el.querySelector('button') && !el.hasAttribute('data-overflow'));
    expect(chips.length + hiddenCount()).toBe(TAGS.length);
  });

  it('shows more chips when the field gets wider', async () => {
    const { rerender } = render(<ChipField width={320} />);
    await waitFor(() => expect(hiddenCount()).toBeGreaterThan(0));
    const narrow = hiddenCount();
    rerender(<ChipField width={900} />);
    await waitFor(() => expect(hiddenCount()).toBeLessThan(narrow));
    const tops = new Set(liveNodes().map((el) => Math.round(el.getBoundingClientRect().top)));
    expect(tops.size).toBe(1);
  });
});

function SheetHarness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <div data-appearance="light" data-density="comfortable">
      <button type="button">Outside</button>
      <BottomSheet.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) onClose();
        }}
      >
        <BottomSheet.Title>Sort</BottomSheet.Title>
        <BottomSheet.Body>
          <button type="button">First</button>
          <button type="button">Last</button>
        </BottomSheet.Body>
      </BottomSheet.Root>
    </div>
  );
}

describe('BottomSheet in a browser', () => {
  it('keeps Tab off the page behind the sheet and closes on Escape', async () => {
    const onClose = vi.fn();
    render(<SheetHarness onClose={onClose} />);
    const sheet = await screen.findByRole('dialog');
    const outside = screen.getByRole('button', { name: 'Outside', hidden: true });
    await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true));
    // A modal <dialog> makes the page inert. Tab may step out to the browser's
    // own UI, as with any modal dialog, but never onto the page behind.
    for (const keys of ['{Tab}', '{Shift>}{Tab}{/Shift}']) {
      for (let i = 0; i < 6; i++) {
        await userEvent.keyboard(keys);
        expect(document.activeElement).not.toBe(outside);
        const active = document.activeElement;
        expect(active === document.body || active === null || sheet.contains(active)).toBe(true);
      }
    }
    // The page behind is inert, so it can't take focus even from a script.
    outside.focus();
    expect(document.activeElement).not.toBe(outside);
    sheet.querySelector('button')!.focus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});

describe('ChipList focus in a browser', () => {
  it('focuses the slot when a pressed chip has a later twin', async () => {
    function Owner() {
      const [tags, setTags] = useState(['bb', 'aa', 'bb']);
      return (
        <div data-appearance="light" data-density="comfortable">
          <ChipList.Root
            aria-label="Tags"
            chips={tags}
            onRemove={(index) => setTags((current) => current.filter((_, i) => i !== index))}
          />
        </div>
      );
    }
    render(<Owner />);
    await userEvent.click(screen.getAllByRole('button', { name: 'Remove bb' })[0]!);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove aa' })));
  });
});

// Chromium fires focusout with no relatedTarget when it drops focus to the body.
describe('ChipList focus never falls to the body in a browser', () => {
  const WIDE = ['design', 'tokens', 'accessibility', 'react', 'density', 'dark mode', 'docs', 'motion'];
  let dropped: string[] = [];
  function onOut(event: FocusEvent) {
    if (event.relatedTarget == null) dropped.push((event.target as HTMLElement).getAttribute('aria-label') ?? '');
  }
  beforeEach(() => {
    dropped = [];
    document.addEventListener('focusout', onOut, true);
  });
  afterEach(() => document.removeEventListener('focusout', onOut, true));

  const api = { set: (_: (tags: string[]) => string[]) => undefined as void, width: (_: number) => undefined as void };
  function Owner({ initial, keyed = false }: { initial: string[]; keyed?: boolean }) {
    const [tags, setTags] = useState(initial);
    const [width, setWidth] = useState(320);
    api.set = setTags;
    api.width = setWidth;
    return (
      <div data-appearance="light" data-density="comfortable" style={{ width }}>
        <ChipList.Root
          aria-label="Tags"
          // Keyed tags read 'id:label'.
          chips={keyed ? tags.map((tag) => tag.slice(2)) : tags}
          getKey={keyed ? (_, index) => tags[index]! : undefined}
          maxRows={1}
          overflowLabel={(n) => `+${n} more`}
          onRemove={() => undefined}
        />
      </div>
    );
  }
  const more = () => screen.getByRole('button', { name: /more$/ });

  it('moves focus from +N to the first chip it held once nothing is folded', async () => {
    render(<Owner initial={WIDE} />);
    await waitFor(() => expect(more()).toBeTruthy());
    const shown = screen.getAllByRole('listitem').length - 1;
    act(() => more().focus());
    await act(async () => api.width(4000));
    await waitFor(() => expect(screen.queryByRole('button', { name: /more$/ })).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button', { name: `Remove ${WIDE[shown]}` }));
    expect(dropped).toEqual([]);
  });

  it('follows a panel chip into the row when the field widens', async () => {
    render(<Owner initial={WIDE} />);
    await waitFor(() => expect(more()).toBeTruthy());
    await userEvent.click(more());
    const dialog = await screen.findByRole('dialog');
    const first = dialog.querySelector('button')!;
    const label = first.getAttribute('aria-label');
    await waitFor(() => expect(document.activeElement).toBe(first));
    await act(async () => api.width(4000));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement?.getAttribute('aria-label')).toBe(label);
    expect(document.activeElement?.closest('[role="list"]')).toBeTruthy();
    expect(dropped).toEqual([]);
  });

  it('returns focus to +N when Escape closes the panel', async () => {
    render(<Owner initial={WIDE} />);
    await waitFor(() => expect(more()).toBeTruthy());
    await userEvent.click(more());
    await screen.findByRole('dialog');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(more()));
    expect(dropped).toEqual([]);
  });

  it('returns focus to +N when Escape closes the panel while the panel itself has focus', async () => {
    render(<Owner initial={WIDE} />);
    await waitFor(() => expect(more()).toBeTruthy());
    await userEvent.click(more());
    const dialog = await screen.findByRole('dialog');
    act(() => dialog.focus());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(more()));
    expect(dropped).toEqual([]);
  });

  it('tabs from the panel itself to its first chip', async () => {
    render(<Owner initial={WIDE} />);
    await waitFor(() => expect(more()).toBeTruthy());
    await userEvent.click(more());
    const dialog = await screen.findByRole('dialog');
    act(() => dialog.focus());
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(dialog.querySelector('button'));
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('keeps focus in a Dialog when Tab leaves the panel of its last control', async () => {
    render(
      <div data-appearance="light" data-density="comfortable">
        <Dialog.Root open onOpenChange={() => undefined}>
          <Dialog.Title>Rename</Dialog.Title>
          <div style={{ width: 320 }}>
            <ChipList.Root
              aria-label="Tags"
              chips={WIDE}
              maxRows={1}
              overflowLabel={(n) => `+${n} more`}
              onRemove={() => undefined}
            />
          </div>
        </Dialog.Root>
        <button type="button">Behind</button>
      </div>,
    );
    const modal = screen.getByRole('dialog', { name: 'Rename' });
    await waitFor(() => expect(more()).toBeTruthy());
    await userEvent.click(more());
    const panel = await screen.findByRole('dialog', { name: /more chips?$/ });
    const chips = panel.querySelectorAll('button');
    act(() => chips[chips.length - 1]!.focus());
    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /more chips?$/ })).toBeNull());
    // The button after it sits behind the modal, so focus stays on +N.
    expect(document.activeElement).toBe(more());
    expect(modal.contains(document.activeElement)).toBe(true);
    expect(dropped).toEqual([]);
  });

  it('draws no ring when a click lands on the list between chips', async () => {
    render(<Owner initial={['aa', 'bb']} />);
    const list = screen.getByRole('list', { name: 'Tags' });
    await userEvent.click(list, { position: { x: list.clientWidth - 2, y: 2 } });
    expect(document.activeElement).toBe(list);
    expect(list.hasAttribute('data-ring')).toBe(false);
  });

  it('leaves focus on a twin the person moved to when the pressed twin is dropped later', async () => {
    render(<Owner initial={['aa', 'x', 'aa', 'y']} />);
    const [first, second] = screen.getAllByRole('button', { name: 'Remove aa' }) as [HTMLElement, HTMLElement];
    await userEvent.click(first);
    act(() => second.focus());
    await act(async () => api.set((current) => current.filter((_, index) => index !== 0)));
    expect(document.activeElement).toBe(second);
    expect(dropped).toEqual([]);
  });

  it('keeps focus on a keyed chip whose node a reorder moves', async () => {
    render(<Owner initial={['1:aa', '2:bb', '3:cc']} keyed />);
    const button = screen.getByRole('button', { name: 'Remove aa' });
    act(() => button.focus());
    await act(async () => api.set((current) => [...current].reverse()));
    expect(document.activeElement).toBe(button);
    expect(dropped).toEqual([]);
  });

  it('moves focus to the chip that fills the place of a removed one', async () => {
    render(<Owner initial={['aa', 'bb', 'cc']} />);
    await userEvent.click(screen.getByRole('button', { name: 'Remove bb' }));
    await act(async () => api.set((current) => current.filter((tag) => tag !== 'bb')));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Remove cc' }));
    expect(dropped).toEqual([]);
  });

  for (const edge of ['left', 'right'] as const) {
    it(`anchors the panel under +N and keeps it on screen at the ${edge} edge`, async () => {
      render(
        <div
          data-appearance="light"
          data-density="comfortable"
          style={{ width: 320, marginLeft: edge === 'right' ? 'calc(100vw - 340px)' : 0 }}
        >
          <ChipList.Root
            aria-label="Tags"
            chips={WIDE}
            maxRows={1}
            overflowLabel={(n) => `+${n} more`}
            onRemove={() => undefined}
          />
        </div>,
      );
      await waitFor(() => expect(more()).toBeTruthy());
      await userEvent.click(more());
      const dialog = await screen.findByRole('dialog');
      await waitFor(() => expect(dialog.getBoundingClientRect().width).toBeGreaterThan(0));
      const trigger = more().getBoundingClientRect();
      const panel = dialog.getBoundingClientRect();
      expect(panel.top).toBeGreaterThanOrEqual(trigger.bottom);
      expect(panel.left).toBeGreaterThanOrEqual(0);
      expect(panel.right).toBeLessThanOrEqual(document.documentElement.clientWidth);
    });
  }
});

describe('Chip tones in a browser', () => {
  it('keeps its tone on hover, recolors it in dark mode, and drops it when disabled', async () => {
    render(
      <>
        <div data-appearance="light" data-density="comfortable">
          <Chip.Root data-testid="neutral" onRemove={() => undefined}>
            Plain
          </Chip.Root>
          <Chip.Root data-testid="tone" tone="category-6" onRemove={() => undefined}>
            Toned
          </Chip.Root>
          <Chip.Root data-testid="neutral-off" disabled onRemove={() => undefined}>
            Off
          </Chip.Root>
          <Chip.Root data-testid="tone-off" tone="category-6" disabled onRemove={() => undefined}>
            Toned off
          </Chip.Root>
        </div>
        <div data-appearance="dark" data-density="comfortable">
          <Chip.Root data-testid="tone-dark" tone="category-6">
            Toned
          </Chip.Root>
        </div>
      </>,
    );
    const style = (id: string) => getComputedStyle(screen.getByTestId(id));
    const tone = style('tone');
    const rest = { bg: tone.backgroundColor, fg: tone.color, border: tone.borderTopColor };
    expect(rest.bg).not.toBe(style('neutral').backgroundColor);
    expect(rest.fg).not.toBe(style('neutral').color);
    expect(style('tone-dark').backgroundColor).not.toBe(rest.bg);
    expect(style('tone-dark').color).not.toBe(rest.fg);
    // The cross takes the label's color on a tone.
    expect(getComputedStyle(screen.getByRole('button', { name: 'Remove Toned' })).color).toBe(rest.fg);

    // Hover reaches the chip: a neutral chip's border changes under it.
    const neutralBorder = style('neutral').borderTopColor;
    await userEvent.hover(screen.getByTestId('neutral'));
    expect(style('neutral').borderTopColor).not.toBe(neutralBorder);
    await userEvent.hover(screen.getByTestId('tone'));
    expect({ bg: tone.backgroundColor, fg: tone.color, border: tone.borderTopColor }).toEqual(rest);

    for (const key of ['backgroundColor', 'color', 'borderTopColor'] as const) {
      expect(style('tone-off')[key]).toBe(style('neutral-off')[key]);
    }
    expect(getComputedStyle(screen.getByRole('button', { name: 'Remove Toned off' })).color).toBe(
      getComputedStyle(screen.getByRole('button', { name: 'Remove Off' })).color,
    );
  });
});

describe('Chip remove content in a browser', () => {
  it('draws Todae\'s cross when given no content, and sizes removeIcon to chip.icon.size', () => {
    render(
      <div data-appearance="light" data-density="comfortable">
        <Chip.Root onRemove={() => undefined}>Drawn</Chip.Root>
        <Chip.Root onRemove={() => undefined} removeIcon={<svg data-testid="icon" aria-hidden="true" width="40" height="40" />}>
          Slotted
        </Chip.Root>
      </div>,
    );
    const drawn = screen.getByRole('button', { name: 'Remove Drawn' });
    expect(drawn.textContent).toBe('');
    const cross = drawn.querySelector('svg')!;
    const box = cross.getBoundingClientRect();
    const size = parseFloat(getComputedStyle(drawn).getPropertyValue('--todae-chip-icon-size')) * 16;
    expect(box.width).toBeCloseTo(size, 0);
    expect(box.height).toBeCloseTo(size, 0);
    const slotted = screen.getByRole('button', { name: 'Remove Slotted' });
    const icon = screen.getByTestId('icon');
    expect(slotted.contains(icon)).toBe(true);
    // The icon's own width attribute gives way to the token.
    expect(icon.getBoundingClientRect().width).toBeCloseTo(size, 0);
    expect(slotted.querySelectorAll('svg')).toHaveLength(1);
  });

  it('keeps the drawn remove button full size while a narrow chip truncates its label', () => {
    render(
      <div data-appearance="light" data-density="comfortable">
        <Chip.Root onRemove={() => undefined}>Wide</Chip.Root>
        <Chip.Root onRemove={() => undefined} style={{ maxWidth: 48 }}>
          A label much too long for its chip
        </Chip.Root>
      </div>,
    );
    const wide = screen.getByRole('button', { name: 'Remove Wide' }).getBoundingClientRect();
    const narrow = screen.getByRole('button', { name: /Remove A label/ }).getBoundingClientRect();
    expect(narrow.width).toBeCloseTo(wide.width, 1);
    expect(narrow.height).toBeCloseTo(wide.height, 1);
  });

  it('names the ChipList panel from StringsProvider', async () => {
    render(
      <div data-appearance="light" data-density="comfortable" style={{ width: 320 }}>
        <StringsProvider strings={{ moreChips: (n) => `${n} de plus`, moreChipsPanel: (n) => `${n} puces de plus` }}>
          <ChipList.Root
            aria-label="Tags"
            chips={['design', 'tokens', 'accessibility', 'react', 'density', 'dark mode', 'docs', 'motion']}
            maxRows={1}
          />
        </StringsProvider>
      </div>,
    );
    const more = await screen.findByRole('button', { name: /de plus$/ });
    // The visible part reads "+N".
    const count = Number(more.querySelector('[aria-hidden]')?.textContent?.slice(1));
    expect(more.textContent).toContain(`${count} de plus`);
    expect(count).toBeGreaterThan(0);
    await userEvent.click(more);
    expect(await screen.findByRole('dialog', { name: `${count} puces de plus` })).toBeTruthy();
  });
});

describe('Field.ChipInput held Enter in a browser', () => {
  function TagForm({ onSubmit }: { onSubmit: () => void }) {
    const field = useChipField();
    return (
      <form
        data-appearance="light"
        data-density="comfortable"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <Field.Root>
          <Field.ChipInput aria-label="Tags" {...field.getChipInputProps()} />
        </Field.Root>
        <output>{field.chips.join(',')}</output>
        <button type="submit">Save</button>
      </form>
    );
  }

  it('commits once and submits nothing', async () => {
    let submits = 0;
    render(<TagForm onSubmit={() => (submits += 1)} />);
    await userEvent.click(screen.getByRole('textbox', { name: 'Tags' }));
    await userEvent.keyboard('foo');
    await userEvent.keyboard('{Enter>3}');
    expect(screen.getByRole('status').textContent).toBe('foo');
    expect(submits).toBe(0);
  });
});
