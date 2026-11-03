import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dropModal, pushModal } from './modalStack.js';
import { escapeIn, makeFrame, makeShadowedFrame } from '../test/frame.js';
import { takeCloseRequest, useEscapeKey } from './useEscapeKey.js';

afterEach(() => {
  cleanup();
  for (const frame of document.querySelectorAll('iframe')) frame.remove();
});


function Layer({
  active = true,
  enabled = true,
  rendered = true,
  onEscape,
}: {
  active?: boolean;
  enabled?: boolean;
  rendered?: boolean;
  onEscape: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEscapeKey(active, enabled, onEscape, ref);
  return rendered ? <div ref={ref} /> : null;
}

describe('useEscapeKey', () => {
  it('only the most recently activated layer handles Escape', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const { rerender } = render(
      <>
        <Layer onEscape={outer} />
        <Layer active={false} onEscape={inner} />
      </>,
    );
    rerender(
      <>
        <Layer onEscape={outer} />
        <Layer onEscape={inner} />
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();

    rerender(
      <>
        <Layer onEscape={outer} />
        <Layer active={false} onEscape={inner} />
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(outer).toHaveBeenCalledTimes(1);
  });

  it('skips a layer left behind a modal dialog, so the dialog gets the key', () => {
    function Element({ onEscape, testId }: { onEscape: () => void; testId: string }) {
      const ref = useRef<HTMLDivElement>(null);
      useEscapeKey(true, true, onEscape, ref);
      return <div ref={ref} data-testid={testId} />;
    }
    const behind = vi.fn();
    const inside = vi.fn();
    const { rerender, getByRole } = render(
      <>
        <Element onEscape={behind} testId="behind" />
        <dialog aria-label="sheet">
          <button type="button">Field</button>
        </dialog>
      </>,
    );
    const dialog = getByRole('dialog', { hidden: true }) as HTMLDialogElement;
    dialog.showModal();
    const keydown = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    dialog.querySelector('button')!.dispatchEvent(keydown);
    expect(behind).not.toHaveBeenCalled();
    // Not prevented, so the browser still sends the dialog its close request.
    expect(keydown.defaultPrevented).toBe(false);

    // A layer opened inside the dialog still handles the key first.
    rerender(
      <>
        <Element onEscape={behind} testId="behind" />
        <dialog aria-label="sheet" open aria-modal="true">
          <button type="button">Field</button>
          <Element onEscape={inside} testId="inside" />
        </dialog>
      </>,
    );
    fireEvent.keyDown(dialog.querySelector('button')!, { key: 'Escape' });
    expect(inside).toHaveBeenCalledTimes(1);
    expect(behind).not.toHaveBeenCalled();
  });

  it('skips a layer behind an open modal when focus has fallen back to the body', () => {
    function Element({ onEscape }: { onEscape: () => void }) {
      const ref = useRef<HTMLDivElement>(null);
      useEscapeKey(true, true, onEscape, ref);
      return <div ref={ref} />;
    }
    const behind = vi.fn();
    const { getByRole } = render(
      <>
        <Element onEscape={behind} />
        <dialog aria-label="sheet" />
      </>,
    );
    (getByRole('dialog', { hidden: true }) as HTMLDialogElement).showModal();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(behind).not.toHaveBeenCalled();
  });

  it('with focus on the body, gives the key to the modal Todae opened last', () => {
    function Element({ onEscape }: { onEscape: () => void }) {
      const ref = useRef<HTMLDivElement>(null);
      useEscapeKey(true, true, onEscape, ref);
      return <div ref={ref} />;
    }
    const inLower = vi.fn();
    const { getByLabelText } = render(
      <>
        <dialog aria-label="lower">
          <Element onEscape={inLower} />
        </dialog>
        <dialog aria-label="upper" />
      </>,
    );
    const lower = getByLabelText('lower') as HTMLDialogElement;
    const upper = getByLabelText('upper') as HTMLDialogElement;
    lower.showModal();
    pushModal(lower);
    upper.showModal();
    pushModal(upper);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(inLower).not.toHaveBeenCalled();
    dropModal(upper);
    dropModal(lower);
  });

  it('calls the latest handler without re-subscribing', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Layer onEscape={first} />);
    rerender(<Layer onEscape={second} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys and stops listening after unmount', () => {
    const onEscape = vi.fn();
    const { unmount } = render(<Layer onEscape={onEscape} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('keeps stack position when enabled toggles and skips disabled layers', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    const { rerender } = render(
      <>
        <Layer onEscape={outer} />
        <Layer onEscape={inner} />
      </>,
    );
    rerender(
      <>
        <Layer enabled={false} onEscape={outer} />
        <Layer onEscape={inner} />
      </>,
    );
    rerender(
      <>
        <Layer enabled onEscape={outer} />
        <Layer onEscape={inner} />
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();

    rerender(
      <>
        <Layer onEscape={outer} />
        <Layer enabled={false} onEscape={inner} />
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(outer).toHaveBeenCalledTimes(1);
  });

  it('gives the key to a layer inside another first, even when the outer one activated later', () => {
    function Element({ active = true, onEscape, children }: { active?: boolean; onEscape: () => void; children?: ReactNode }) {
      const ref = useRef<HTMLDivElement>(null);
      useEscapeKey(active, true, onEscape, ref);
      return <div ref={ref}>{children}</div>;
    }
    const outer = vi.fn();
    const inner = vi.fn();
    const beside = vi.fn();
    const tree = (outerActive: boolean) => (
      <>
        <Element active={outerActive} onEscape={outer}>
          <Element onEscape={inner} />
        </Element>
        <Element onEscape={beside} />
      </>
    );
    const { rerender } = render(tree(false));
    rerender(tree(true));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
    expect(beside).not.toHaveBeenCalled();
  });

  it('lets a layer turn down Escape by where focus is, or by the key alone, passing it to the next one', () => {
    function Picky({ onEscape }: { onEscape: () => void }) {
      const ref = useRef<HTMLButtonElement>(null);
      useEscapeKey(true, (target) => ref.current?.contains(target) === true, onEscape, ref, {
        passesKey: (event) => event.shiftKey,
      });
      return (
        <button type="button" ref={ref}>
          Picky
        </button>
      );
    }
    const outer = vi.fn();
    const inner = vi.fn();
    const { getByRole } = render(
      <>
        <Layer onEscape={outer} />
        <Picky onEscape={inner} />
        <button type="button">Elsewhere</button>
      </>,
    );
    fireEvent.keyDown(getByRole('button', { name: 'Elsewhere' }), { key: 'Escape' });
    expect(outer).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(getByRole('button', { name: 'Picky' }), { key: 'Escape', shiftKey: true });
    expect(outer).toHaveBeenCalledTimes(2);
    fireEvent.keyDown(getByRole('button', { name: 'Picky' }), { key: 'Escape' });
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).toHaveBeenCalledTimes(2);
  });

  it('asks a layer about a close request with the element that has focus', () => {
    function Picky({ onEscape }: { onEscape: () => void }) {
      const ref = useRef<HTMLButtonElement>(null);
      useEscapeKey(true, (target) => ref.current?.contains(target) === true, onEscape, ref);
      return (
        <button type="button" ref={ref}>
          Picky
        </button>
      );
    }
    const onEscape = vi.fn();
    const { getByRole } = render(
      <dialog aria-label="surface">
        <Picky onEscape={onEscape} />
        <button type="button">Elsewhere</button>
      </dialog>,
    );
    const dialog = getByRole('dialog', { hidden: true });
    getByRole('button', { name: 'Elsewhere', hidden: true }).focus();
    expect(takeCloseRequest(dialog)).toBe(false);
    getByRole('button', { name: 'Picky', hidden: true }).focus();
    expect(takeCloseRequest(dialog)).toBe(true);
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('passes a layer that is not a popup over for a popup beside it, but not for one around it', () => {
    function Element({ popup = true, onEscape, children }: { popup?: boolean; onEscape: () => void; children?: ReactNode }) {
      const ref = useRef<HTMLDivElement>(null);
      useEscapeKey(true, true, onEscape, ref, { popup });
      return <div ref={ref}>{children}</div>;
    }
    const around = vi.fn();
    const stack = vi.fn();
    const beside = vi.fn();
    const tree = (withBeside: boolean) => (
      <dialog aria-label="surface">
        <Element onEscape={around}>
          {withBeside ? <Element onEscape={beside} /> : null}
          <Element popup={false} onEscape={stack} />
        </Element>
      </dialog>
    );
    const { rerender, getByRole } = render(tree(true));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(beside).toHaveBeenCalledTimes(1);
    expect(takeCloseRequest(getByRole('dialog', { hidden: true }))).toBe(true);
    expect(beside).toHaveBeenCalledTimes(2);
    expect(stack).not.toHaveBeenCalled();
    rerender(tree(false));
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(takeCloseRequest(getByRole('dialog', { hidden: true }))).toBe(true);
    expect(stack).toHaveBeenCalledTimes(2);
    expect(around).not.toHaveBeenCalled();
  });

  it('does not pass a layer over for a popup that has no element', () => {
    function Element({ onEscape }: { onEscape: () => void }) {
      const ref = useRef<HTMLDivElement>(null);
      useEscapeKey(true, true, onEscape, ref, { popup: false });
      return <div ref={ref} />;
    }
    const popup = vi.fn();
    const stack = vi.fn();
    render(
      <>
        <Layer rendered={false} onEscape={popup} />
        <Element onEscape={stack} />
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(stack).toHaveBeenCalledTimes(1);
    expect(popup).not.toHaveBeenCalled();
  });

  describe('in another document', () => {
    it('handles Escape pressed in an iframe a layer is rendered into', () => {
      const doc = makeFrame();
      const onEscape = vi.fn();
      render(<Layer onEscape={onEscape} />, { container: doc.body.appendChild(doc.createElement('div')) });
      const event = escapeIn(doc.body);
      expect(onEscape).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    });

    it('keeps a key in one document from reaching a layer in another', () => {
      const doc = makeFrame();
      const inFrame = vi.fn();
      const inMain = vi.fn();
      render(<Layer onEscape={inFrame} />, { container: doc.body.appendChild(doc.createElement('div')) });
      render(<Layer onEscape={inMain} />);
      expect(escapeIn(document.body).defaultPrevented).toBe(true);
      expect(inMain).toHaveBeenCalledTimes(1);
      expect(inFrame).not.toHaveBeenCalled();
      escapeIn(doc.body);
      expect(inFrame).toHaveBeenCalledTimes(1);
      expect(inMain).toHaveBeenCalledTimes(1);
    });

    it('lets a key on the page reach a layer in an iframe when no layer on the page takes it', () => {
      const doc = makeFrame();
      const inFrame = vi.fn();
      render(<Layer onEscape={inFrame} />, { container: doc.body.appendChild(doc.createElement('div')) });
      expect(escapeIn(document.body).defaultPrevented).toBe(true);
      expect(inFrame).toHaveBeenCalledTimes(1);
    });

    it('lets a key on the page reach a layer in an iframe inside a modal dialog on the page', () => {
      const dialog = document.body.appendChild(document.createElement('dialog'));
      const button = dialog.appendChild(document.createElement('button'));
      const doc = makeFrame();
      dialog.append(doc.defaultView!.frameElement!);
      dialog.showModal();
      try {
        const inFrame = vi.fn();
        render(<Layer onEscape={inFrame} />, { container: doc.body.appendChild(doc.createElement('div')) });
        expect(escapeIn(button).defaultPrevented).toBe(true);
        expect(inFrame).toHaveBeenCalledTimes(1);
      } finally {
        dialog.close();
        dialog.remove();
      }
    });

    it('keeps a key in an iframe from reaching a layer on the page', () => {
      const doc = makeFrame();
      const inMain = vi.fn();
      render(<Layer onEscape={inMain} />);
      expect(escapeIn(doc.body).defaultPrevented).toBe(false);
      expect(inMain).not.toHaveBeenCalled();
    });

    it('keeps a key on the page from reaching an iframe layer behind a modal dialog there', () => {
      const doc = makeFrame();
      const inFrame = vi.fn();
      render(<Layer onEscape={inFrame} />, { container: doc.body.appendChild(doc.createElement('div')) });
      const dialog = doc.body.appendChild(doc.createElement('dialog'));
      dialog.showModal();
      expect(escapeIn(document.body).defaultPrevented).toBe(false);
      expect(inFrame).not.toHaveBeenCalled();
    });

    it('stops listening in an iframe once its last layer goes, and listens again for a new one', () => {
      const doc = makeFrame();
      const first = vi.fn();
      const second = vi.fn();
      const container = doc.body.appendChild(doc.createElement('div'));
      const { unmount } = render(<Layer onEscape={first} />, { container });
      unmount();
      const event = escapeIn(doc.body);
      expect(first).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(false);
      render(<Layer onEscape={second} />, { container: doc.body.appendChild(doc.createElement('div')) });
      escapeIn(doc.body);
      expect(second).toHaveBeenCalledTimes(1);
    });

    it('listens in an iframe its element reaches after the layer activates', () => {
      const doc = makeFrame();
      const onEscape = vi.fn();
      function Late() {
        const ref = useRef<HTMLDivElement>(null);
        const [target, setTarget] = useState<HTMLElement | null>(null);
        useEscapeKey(true, true, onEscape, ref);
        useEffect(() => setTarget(doc.body), []);
        return target ? createPortal(<div ref={ref} />, target) : null;
      }
      render(<Late />);
      expect(escapeIn(doc.body).defaultPrevented).toBe(true);
      expect(onEscape).toHaveBeenCalledTimes(1);
    });

    /** Portals its children into `doc`'s body once it has mounted, as a wrapper waiting for a frame does. */
    function FramePortal({ doc, children }: { doc: Document; children: ReactNode }) {
      const [target, setTarget] = useState<HTMLElement | null>(null);
      useEffect(() => setTarget(doc.body), [doc]);
      return target ? createPortal(children, target) : null;
    }

    function PortaledLayer({ doc, onEscape }: { doc: Document; onEscape: () => void }) {
      const ref = useRef<HTMLDivElement>(null);
      useEscapeKey(true, true, onEscape, ref);
      return (
        <FramePortal doc={doc}>
          <div ref={ref}>
            <button type="button">Inside</button>
          </div>
        </FramePortal>
      );
    }

    it('listens in an iframe another component portals its element into, once focus goes there', async () => {
      const doc = makeFrame();
      const onEscape = vi.fn();
      render(<PortaledLayer doc={doc} onEscape={onEscape} />);
      act(() => doc.querySelector('button')!.focus());
      // The page's window blurs as focus goes into the frame; jsdom doesn't send it.
      window.dispatchEvent(new FocusEvent('blur'));
      await new Promise((resolve) => setTimeout(resolve));
      expect(escapeIn(doc.querySelector('button')!).defaultPrevented).toBe(true);
      expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it('listens in the iframe focus is already in when the layer activates', () => {
      const doc = makeFrame();
      const field = doc.body.appendChild(doc.createElement('input'));
      act(() => field.focus());
      const onEscape = vi.fn();
      render(<PortaledLayer doc={doc} onEscape={onEscape} />);
      expect(escapeIn(field).defaultPrevented).toBe(true);
      expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it('listens in an iframe the page reads as inside a shadow root, with focus already there', () => {
      const { doc, restore } = makeShadowedFrame();
      try {
        const field = doc.body.appendChild(doc.createElement('input'));
        act(() => field.focus());
        const onEscape = vi.fn();
        render(<PortaledLayer doc={doc} onEscape={onEscape} />);
        expect(escapeIn(field).defaultPrevented).toBe(true);
        expect(onEscape).toHaveBeenCalledTimes(1);
      } finally {
        restore();
      }
    });

    it('follows an open layer whose element moves into an iframe', () => {
      const doc = makeFrame();
      const onEscape = vi.fn();
      function Moving({ target }: { target: HTMLElement }) {
        const ref = useRef<HTMLDivElement>(null);
        useEscapeKey(true, true, onEscape, ref);
        return createPortal(<div ref={ref} />, target);
      }
      const { rerender } = render(<Moving target={document.body} />);
      rerender(<Moving target={doc.body} />);
      expect(escapeIn(doc.body).defaultPrevented).toBe(true);
      expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it('does not hide an iframe layer from a modal dialog shown in the main document', () => {
      const doc = makeFrame();
      const onEscape = vi.fn();
      const { getByRole } = render(<dialog aria-label="sheet" />);
      (getByRole('dialog', { hidden: true }) as HTMLDialogElement).showModal();
      render(<Layer onEscape={onEscape} />, { container: doc.body.appendChild(doc.createElement('div')) });
      const event = escapeIn(doc.body);
      expect(onEscape).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(true);
    });
  });
});
