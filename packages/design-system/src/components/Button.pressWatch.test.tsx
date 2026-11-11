import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { Button } from './Button.js';

// Its own file: the page's watch for presses starts once per document, and
// this checks that a Button with no tip starts it.

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it('opens no tip for focus a script moves after a press on a Button with no tip', () => {
  vi.useFakeTimers();
  // The only Button before the press has tooltip={false}, as Menu.Trigger has
  // by default; the press opens an icon-only close button that takes focus.
  function Page() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button.Root tooltip={false} onClick={() => setOpen(true)}>
          Open
        </Button.Root>
        {open ? (
          <Button.Root aria-label="Close">
            <Button.Icon>x</Button.Icon>
          </Button.Root>
        ) : null}
      </>
    );
  }
  render(<Page />);
  const open = screen.getByRole('button', { name: 'Open' });
  fireEvent.pointerDown(open);
  fireEvent.click(open);
  act(() => screen.getByRole('button', { name: 'Close' }).focus());
  act(() => vi.advanceTimersByTime(1000));
  expect(screen.queryByRole('tooltip', { hidden: true })?.hasAttribute('data-open') ?? false).toBe(false);
});
