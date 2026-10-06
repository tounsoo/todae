import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { BottomSheet } from '../components/BottomSheet';
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
  it('keeps Tab inside the sheet and closes on Escape', async () => {
    const onClose = vi.fn();
    render(<SheetHarness onClose={onClose} />);
    const sheet = await screen.findByRole('dialog');
    await waitFor(() => expect(sheet.contains(document.activeElement)).toBe(true));
    for (let i = 0; i < 6; i++) {
      await userEvent.keyboard('{Tab}');
      expect(sheet.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 6; i++) {
      await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
      expect(sheet.contains(document.activeElement)).toBe(true);
    }
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
