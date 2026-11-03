import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeFrame, makePopup, makeShadowedFrame } from '../test/frame.js';
import { useFocusRestore } from './useFocusRestore.js';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
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

  it('returns focus to an opener on the page around the iframe it renders into', async () => {
    const doc = makeFrame();
    // Focus once sat in the frame, so the frame's document still has an active element.
    const earlier = doc.body.appendChild(doc.createElement('input'));
    function Example() {
      const [open, setOpen] = useState(false);
      const container = useRef<HTMLDivElement>(null);
      useFocusRestore(open, { containerRef: container });
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          {createPortal(
            <div ref={container}>
              <button type="button" onClick={() => setOpen(false)}>
                Close
              </button>
            </div>,
            doc.body,
          )}
        </>
      );
    }
    render(<Example />);
    act(() => earlier.focus());
    act(() => button(document, 'Open').focus());
    fireEvent.click(button(document, 'Open'));
    act(() => button(doc, 'Close').focus());
    // Focus drops to the page's body as the overlay closes.
    act(() => (document.activeElement as HTMLElement).blur());
    fireEvent.click(button(doc, 'Close'));
    await act(async () => undefined);
    expect(document.activeElement).toBe(button(document, 'Open'));
  });

  it('returns focus to a restoreTo on the page around the iframe after the overlay unmounts', async () => {
    const doc = makeFrame();
    function Example() {
      const [open, setOpen] = useState(false);
      const container = useRef<HTMLDivElement>(null);
      const trigger = useRef<HTMLButtonElement>(null);
      useFocusRestore(open, { containerRef: container, restoreTo: trigger });
      return (
        <>
          <button type="button" ref={trigger} onClick={() => setOpen(true)}>
            Open
          </button>
          {open
            ? createPortal(
                <div ref={container}>
                  <button type="button" onClick={() => setOpen(false)}>
                    Close
                  </button>
                </div>,
                doc.body,
              )
            : null}
        </>
      );
    }
    render(<Example />);
    act(() => button(document, 'Open').focus());
    fireEvent.click(button(document, 'Open'));
    act(() => button(doc, 'Close').focus());
    fireEvent.click(button(doc, 'Close'));
    await act(async () => undefined);
    expect(document.activeElement).toBe(button(document, 'Open'));
  });

  it('returns focus to a restoreTo on the page when the overlay reached the iframe after it opened', async () => {
    const doc = makeFrame();
    function Example() {
      const [open, setOpen] = useState(false);
      const [target, setTarget] = useState<HTMLElement | null>(null);
      const container = useRef<HTMLDivElement>(null);
      const trigger = useRef<HTMLButtonElement>(null);
      useFocusRestore(open, { containerRef: container, restoreTo: trigger });
      return (
        <>
          <button type="button" ref={trigger} onClick={() => setOpen(true)}>
            Open
          </button>
          <button type="button" onClick={() => setTarget(doc.body)}>
            Target
          </button>
          {open && target
            ? createPortal(
                <div ref={container}>
                  <button type="button" onClick={() => setOpen(false)}>
                    Close
                  </button>
                </div>,
                target,
              )
            : null}
        </>
      );
    }
    render(<Example />);
    act(() => button(document, 'Open').focus());
    fireEvent.click(button(document, 'Open'));
    fireEvent.click(button(document, 'Target'));
    act(() => button(doc, 'Close').focus());
    fireEvent.click(button(doc, 'Close'));
    await act(async () => undefined);
    expect(document.activeElement).toBe(button(document, 'Open'));
  });

  for (const unmounts of [true, false]) {
    it(`leaves focus the person moved back to the page when an overlay in a popup window closes, ${unmounts ? 'unmounting' : 'kept mounted'}`, async () => {
      const popup = makePopup();
      // Focus goes back to the page below, so the popup's window has none.
      vi.spyOn(popup, 'hasFocus').mockReturnValue(false);
      function Example() {
        const [open, setOpen] = useState(false);
        const container = useRef<HTMLDivElement>(null);
        const trigger = useRef<HTMLButtonElement>(null);
        useFocusRestore(open, { containerRef: container, restoreTo: trigger });
        const panel = (
          <div ref={container} hidden={!open}>
            <button type="button">Item</button>
          </div>
        );
        return (
          <>
            <button type="button" ref={trigger} onClick={() => setOpen(true)}>
              Open
            </button>
            <button type="button" onClick={() => setOpen(false)}>
              Done
            </button>
            <input aria-label="Notes" />
            {!unmounts || open ? createPortal(panel, popup.body) : null}
          </>
        );
      }
      render(<Example />);
      act(() => button(document, 'Open').focus());
      fireEvent.click(button(document, 'Open'));
      act(() => button(popup, 'Item').focus());
      const notes = document.querySelector('input')!;
      act(() => notes.focus());
      // Closed from the page by a press that doesn't take focus.
      act(() => button(document, 'Done').click());
      await act(async () => undefined);
      expect(document.activeElement).toBe(notes);
    });
  }

  it('returns focus in an iframe the page reads as inside a shadow root', async () => {
    const { doc, restore } = makeShadowedFrame();
    try {
      render(<Panel doc={doc} withRestoreTo={false} />);
      act(() => button(doc, 'Open').focus());
      fireEvent.click(button(doc, 'Open'));
      act(() => button(doc, 'Close').focus());
      fireEvent.click(button(doc, 'Close'));
      await act(async () => undefined);
      expect(doc.activeElement).toBe(button(doc, 'Open'));
    } finally {
      restore();
    }
  });
});
