import { cleanup, fireEvent, render } from '@testing-library/react';
import { useRef, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dropModal, pushModal } from './modalStack.js';
import { takeCloseRequest, useEscapeKey } from './useEscapeKey.js';

afterEach(cleanup);

function Layer({
  active = true,
  enabled = true,
  onEscape,
}: {
  active?: boolean;
  enabled?: boolean;
  onEscape: () => void;
}) {
  useEscapeKey(active, enabled, onEscape);
  return null;
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

  it('lets a layer turn down a key by the event, passing it to the next one', () => {
    function Picky({ onEscape }: { onEscape: () => void }) {
      useEscapeKey(true, (event) => !event?.shiftKey, onEscape);
      return null;
    }
    const outer = vi.fn();
    const inner = vi.fn();
    render(
      <>
        <Layer onEscape={outer} />
        <Picky onEscape={inner} />
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape', shiftKey: true });
    expect(outer).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(inner).toHaveBeenCalledTimes(1);
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
});
