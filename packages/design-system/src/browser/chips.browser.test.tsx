import { act, render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BottomSheet } from '../components/BottomSheet';
import { ChipList } from '../components/ChipList';
import { Field } from '../components/Field';

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

/** The chips, overflow chip and input that are laid out (not the inert measure copy). */
function liveNodes(): HTMLElement[] {
  const flow = screen.getByRole('textbox').parentElement!;
  return [...flow.children].filter((el): el is HTMLElement => el instanceof HTMLElement && !el.hasAttribute('inert'));
}

function hiddenCount(): number {
  const overflow = liveNodes().find((el) => el.hasAttribute('data-overflow'));
  // The visible part reads "+N"; the hidden label beside it says "N more".
  return overflow ? Number(overflow.querySelector('[aria-hidden]')?.textContent?.slice(1) ?? 0) : 0;
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
  it('keeps focus on a keyed chip when the owner reverses the chips', async () => {
    let reverse = () => undefined as void;
    function Owner() {
      const [items, setItems] = useState(['1:aa', '2:bb', '3:cc']);
      reverse = () => setItems((current) => [...current].reverse());
      return (
        <div data-appearance="light" data-density="comfortable">
          <ChipList.Root
            aria-label="Tags"
            chips={items.map((item) => item.slice(2))}
            getKey={(_, index) => items[index]!}
            onRemove={() => undefined}
          />
        </div>
      );
    }
    render(<Owner />);
    const button = screen.getByRole('button', { name: 'Remove aa' });
    button.focus();
    await act(async () => reverse());
    expect(document.activeElement).toBe(button);
  });

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
