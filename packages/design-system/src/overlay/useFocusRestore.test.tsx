import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeFrame } from '../test/frame.js';
import { useFocusRestore } from './useFocusRestore.js';

afterEach(() => {
  cleanup();
  for (const frame of document.querySelectorAll('iframe')) frame.remove();
});

/** A panel that unmounts as it closes, opened from a button beside it in `doc`. */
function Panel({ doc, withRestoreTo }: { doc: Document; withRestoreTo: boolean }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useFocusRestore(open, { containerRef: container, ...(withRestoreTo ? { restoreTo: trigger } : {}) });
  return createPortal(
    <>
      <button type="button" ref={trigger} onClick={() => setOpen(true)}>
        Open
      </button>
      {open ? (
        <div ref={container}>
          <button type="button" onClick={() => setOpen(false)}>
            Close
          </button>
        </div>
      ) : null}
    </>,
    doc.body,
  );
}

const button = (doc: Document, name: string) => [...doc.querySelectorAll('button')].find((el) => el.textContent === name)!;

describe('useFocusRestore in another document', () => {
  for (const withRestoreTo of [true, false]) {
    it(`returns focus to the opener in an iframe, ${withRestoreTo ? 'with' : 'without'} restoreTo`, async () => {
      const doc = makeFrame();
      render(<Panel doc={doc} withRestoreTo={withRestoreTo} />);
      act(() => button(doc, 'Open').focus());
      fireEvent.click(button(doc, 'Open'));
      act(() => button(doc, 'Close').focus());
      fireEvent.click(button(doc, 'Close'));
      await act(async () => undefined);
      expect(doc.activeElement).toBe(button(doc, 'Open'));
    });
  }

  for (const shows of ['an HTML', 'an SVG'] as const) {
    it(`leaves focus on a page iframe that shows ${shows} document`, async () => {
      const frame = document.body.appendChild(document.createElement('iframe'));
      frame.tabIndex = 0;
      const inner = frame.contentDocument!;
      if (shows === 'an SVG') {
        inner.replaceChild(inner.createElementNS('http://www.w3.org/2000/svg', 'svg'), inner.documentElement);
      }
      function Example({ open }: { open: boolean }) {
        const container = useRef<HTMLDivElement>(null);
        const trigger = useRef<HTMLButtonElement>(null);
        useFocusRestore(open, { containerRef: container, restoreTo: trigger });
        return (
          <>
            <button type="button" ref={trigger}>
              Open
            </button>
            <div ref={container}>
              <button type="button">Inside</button>
            </div>
          </>
        );
      }
      const { rerender } = render(<Example open={false} />);
      act(() => button(document, 'Open').focus());
      rerender(<Example open />);
      act(() => button(document, 'Inside').focus());
      act(() => frame.focus());
      const focus = vi.spyOn(button(document, 'Open'), 'focus');
      rerender(<Example open={false} />);
      await act(async () => undefined);
      expect(focus).not.toHaveBeenCalled();
      expect(document.activeElement).toBe(frame);
    });
  }

  it('leaves focus that moved to the page around the iframe there', async () => {
    const doc = makeFrame();
    const outside = document.body.appendChild(document.createElement('input'));
    function Example({ open }: { open: boolean }) {
      const container = useRef<HTMLDivElement>(null);
      const trigger = useRef<HTMLButtonElement>(null);
      useFocusRestore(open, { containerRef: container, restoreTo: trigger });
      return createPortal(
        <>
          <button type="button" ref={trigger}>
            Open
          </button>
          <div ref={container}>
            <button type="button">Inside</button>
          </div>
        </>,
        doc.body,
      );
    }
    const { rerender } = render(<Example open={false} />);
    act(() => button(doc, 'Open').focus());
    rerender(<Example open />);
    act(() => button(doc, 'Inside').focus());
    act(() => outside.focus());
    const focus = vi.spyOn(button(doc, 'Open'), 'focus');
    rerender(<Example open={false} />);
    await act(async () => undefined);
    expect(focus).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
});
