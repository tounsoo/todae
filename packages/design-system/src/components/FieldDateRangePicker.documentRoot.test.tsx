import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { Field, type DateRange } from '../index.js';

// Next.js and Remix root React on the document, so React's listener and the
// Escape stack's sit on the same node and stopping propagation reaches neither.
const date = (text: string) => Temporal.PlainDate.from(text);

it('keeps the picker open on the Escape that drops a first pick, with React rooted on the document', () => {
  const onOpenChange = vi.fn();
  const root = createRoot(document);
  act(() =>
    root.render(
      <html>
        <body>
          <Field.Root aria-label="Stay">
            <Field.DateRangePicker
              value={{ start: date('2026-10-20'), end: date('2026-10-22') } satisfies DateRange}
              locale="en-US"
              defaultOpen
              onOpenChange={onOpenChange}
            />
          </Field.Root>
        </body>
      </html>,
    ),
  );
  const day = () => document.querySelector<HTMLElement>('[aria-label="Monday, October 5, 2026"]')!;
  act(() => day().click());
  const escape = () =>
    act(() => {
      day().dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    });
  escape();
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(day().hasAttribute('data-selected')).toBe(false);
  escape();
  expect(onOpenChange).toHaveBeenLastCalledWith(false, 'escape');
  act(() => root.unmount());
});
