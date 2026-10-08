import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useAnnouncer } from '../hooks/useAnnouncer';
import { Dialog } from '../components/Dialog';

afterEach(() => {
  for (const node of document.querySelectorAll('[data-todae-announcer]')) node.remove();
});

function Saver() {
  const announce = useAnnouncer();
  return (
    <button type="button" onClick={() => announce('Draft saved')}>
      Save
    </button>
  );
}

describe('useAnnouncer in a browser', () => {
  it('moves the region into an open modal dialog, where it is not inert, and back out after', async () => {
    const { rerender } = render(
      <Dialog.Root open onOpenChange={() => undefined} aria-label="Edit">
        <Saver />
      </Dialog.Root>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Edit' });
    act(() => screen.getByRole('button', { name: 'Save' }).click());
    const region = document.querySelector<HTMLElement>('[data-todae-announcer]')!;
    expect(dialog.contains(region)).toBe(true);
    await expect.poll(() => region.querySelector('[aria-live="polite"]')?.textContent).toBe('Draft saved');

    rerender(<Saver />);
    act(() => screen.getByRole('button', { name: 'Save' }).click());
    expect(document.querySelector('[data-todae-announcer]')?.parentElement).toBe(document.body);
  });
});
