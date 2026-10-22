import { act, cleanup, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, expect, it } from 'vitest';
import { useFocusHandoff } from './useFocusHandoff.js';

afterEach(cleanup);

function Decision({ keepTarget = true, focusOther = false }: { keepTarget?: boolean; focusOther?: boolean }) {
  const summary = useRef<HTMLButtonElement>(null);
  const handoff = useFocusHandoff<HTMLDivElement>({ to: summary });
  const [open, setOpen] = useState(true);
  return (
    <>
      {(open || keepTarget) && <button ref={summary}>Summary</button>}
      {!open && focusOther && <input aria-label="Other" autoFocus />}
      {open && (
        <div ref={handoff}>
          <button onClick={() => setOpen(false)}>Approve</button>
        </div>
      )}
      <button onClick={() => setOpen(false)}>Elsewhere</button>
    </>
  );
}

const flush = () => act(() => Promise.resolve());

it('moves focus to the target when the element unmounts holding focus', async () => {
  render(<Decision />);
  const approve = screen.getByRole('button', { name: 'Approve' });
  approve.focus();
  act(() => approve.click());
  await flush();
  expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Summary' }));
});

it('leaves focus alone when the element unmounts without focus', async () => {
  render(<Decision />);
  const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
  elsewhere.focus();
  act(() => elsewhere.click());
  await flush();
  expect(document.activeElement).toBe(elsewhere);
});

it('keeps focus that moved elsewhere in the same commit', async () => {
  render(<Decision focusOther />);
  const approve = screen.getByRole('button', { name: 'Approve' });
  approve.focus();
  act(() => approve.click());
  await flush();
  expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Other' }));
});

it('does nothing when the target unmounts too', async () => {
  render(<Decision keepTarget={false} />);
  const approve = screen.getByRole('button', { name: 'Approve' });
  approve.focus();
  act(() => approve.click());
  await flush();
  expect(document.activeElement).toBe(document.body);
});
