import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../components/Button.js';
import { Coachmark, type CoachmarkCloseReason } from '../components/Coachmark.js';
import { settle } from '../test/settle.js';

function Harness({ onTarget, onClose }: { onTarget?: () => void; onClose?: (reason: CoachmarkCloseReason) => void }) {
  const target = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  return (
    <div data-appearance="light" data-density="comfortable" style={{ padding: '4rem' }}>
      <Button.Root onClick={() => setOpen(true)}>Start tour</Button.Root>
      <Button.Root ref={target} variant="secondary" onClick={onTarget}>
        Export
      </Button.Root>
      <Coachmark.Root
        targetRef={target}
        open={open}
        onOpenChange={(next, reason) => {
          setOpen(next);
          if (!next) onClose?.(reason);
        }}
      >
        <Coachmark.Title>New: export</Coachmark.Title>
        <Coachmark.Description>Save the report as a file.</Coachmark.Description>
        <Coachmark.Footer>
          <Button.Root variant="secondary">Back</Button.Root>
          <Coachmark.Close variant="primary">Got it</Coachmark.Close>
        </Coachmark.Footer>
      </Coachmark.Root>
    </div>
  );
}

async function openTour() {
  await userEvent.click(screen.getByRole('button', { name: 'Start tour' }));
  await waitFor(() => expect(screen.getByRole('dialog', { name: 'New: export' }).matches(':popover-open')).toBe(true));
  await settle();
}

function scrim(): HTMLElement {
  return document.querySelector<HTMLElement>('[aria-hidden="true"][popover]')!;
}

describe('Coachmark in a browser', () => {
  it('cuts the hole around the target, with room for its focus ring, and shows the popup in front', async () => {
    render(<Harness />);
    await openTour();
    const target = screen.getByRole('button', { name: 'Export' }).getBoundingClientRect();
    const hole = scrim().getBoundingClientRect();
    // coachmark.cutout.padding and the focus ring's room are both 4px in the base theme.
    expect(hole.left).toBeCloseTo(target.left - 4, 0);
    expect(hole.top).toBeCloseTo(target.top - 4, 0);
    expect(hole.width).toBeCloseTo(target.width + 8, 0);
    expect(hole.height).toBeCloseTo(target.height + 8, 0);
    const popup = screen.getByRole('dialog');
    const box = popup.getBoundingClientRect();
    expect(popup.contains(document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2))).toBe(true);
  });

  it('keeps the target pressable through the dim page, and the rest inert', async () => {
    const onTarget = vi.fn();
    render(<Harness onTarget={onTarget} />);
    await openTour();
    await userEvent.click(screen.getByRole('button', { name: 'Export' }));
    expect(onTarget).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Start tour', hidden: true }).closest('[inert]')).not.toBeNull();
  });

  it('moves focus in, cycles Tab between the popup and the target, and returns focus on Escape', async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    await openTour();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Back' }));
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Got it' }));
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Export' }));
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Back' }));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('escape'));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Start tour' })));
    // The page is usable again at once; the popup and the hole stay inert only while they fade out.
    expect(document.querySelector('[inert]:not([popover])')).toBeNull();
    await settle();
    expect(scrim().matches(':popover-open')).toBe(false);
    expect(document.querySelector('[inert]')).toBeNull();
  });
});
