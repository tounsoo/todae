import { act, render } from '@testing-library/react';
import { startTransition, Suspense, use, useCallback, useRef, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useModalDialog } from './useModalDialog.js';

const MARK = 'data-todae-no-page-scrollbar';

function setWidths(innerWidth: number, clientWidth: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, get: () => innerWidth });
  Object.defineProperty(document.documentElement, 'clientWidth', { configurable: true, get: () => clientWidth });
}

afterEach(() => {
  document.documentElement.removeAttribute(MARK);
  setWidths(1024, 0);
});

describe('useModalDialog', () => {
  it('closes the element from what React committed, not from a render it threw away', async () => {
    const never = new Promise<never>(() => undefined);
    let update: (next: { present: boolean; suspend: boolean }) => void = () => undefined;
    let remove: () => void = () => undefined;
    function Suspends({ when }: { when: boolean }) {
      if (when) use(never);
      return null;
    }
    function Modal({ present, suspend }: { present: boolean; suspend: boolean }) {
      const dialogRef = useRef<HTMLDialogElement | null>(null);
      const [node, setNode] = useState<HTMLDialogElement | null>(null);
      const setRef = useCallback((el: HTMLDialogElement | null) => {
        dialogRef.current = el;
        setNode(el);
      }, []);
      useModalDialog({
        dialogRef,
        node,
        present,
        open: present,
        dismissOnEscape: true,
        onOpenChange: () => undefined,
        requestClose: () => undefined,
      });
      return (
        <>
          <dialog ref={setRef} aria-label="Modal" />
          <Suspends when={suspend} />
        </>
      );
    }
    function Page() {
      const [state, setState] = useState({ present: true, suspend: false });
      const [mounted, setMounted] = useState(true);
      update = setState;
      remove = () => setMounted(false);
      return <Suspense fallback={null}>{mounted && <Modal {...state} />}</Suspense>;
    }
    render(<Page />);
    const dialog = document.querySelector('dialog')!;
    expect(dialog.open).toBe(true);
    // Renders the end of the exit, then suspends, so React never commits it.
    await act(async () => startTransition(() => update({ present: false, suspend: true })));
    expect(dialog.open).toBe(true);
    // Removed while the committed element is still present: no exit ended.
    act(() => remove());
    expect(dialog.isConnected).toBe(false);
    expect(dialog.open).toBe(true);
  });

  it('clears the marker after the dialog closes', () => {
    setWidths(390, 390);
    let setPresent: (present: boolean) => void = () => undefined;
    function Modal({ present }: { present: boolean }) {
      const dialogRef = useRef<HTMLDialogElement | null>(null);
      const [node, setNode] = useState<HTMLDialogElement | null>(null);
      const setRef = useCallback((el: HTMLDialogElement | null) => {
        dialogRef.current = el;
        setNode(el);
      }, []);
      useModalDialog({
        dialogRef,
        node,
        present,
        open: present,
        dismissOnEscape: true,
        onOpenChange: () => undefined,
        requestClose: () => undefined,
      });
      return <dialog ref={setRef} aria-label="Modal" />;
    }
    function Page() {
      const [present, next] = useState(true);
      setPresent = next;
      return <Modal present={present} />;
    }
    render(<Page />);
    expect(document.documentElement.hasAttribute(MARK)).toBe(true);
    act(() => setPresent(false));
    expect(document.querySelector('dialog')!.open).toBe(false);
    expect(document.documentElement.hasAttribute(MARK)).toBe(false);
  });

  it('clears the marker when the dialog unmounts while open', async () => {
    setWidths(390, 390);
    const { unmount } = render(<OpenModal />);
    expect(document.documentElement.hasAttribute(MARK)).toBe(true);
    unmount();
    await Promise.resolve();
    expect(document.documentElement.hasAttribute(MARK)).toBe(false);
  });
});

function OpenModal() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [node, setNode] = useState<HTMLDialogElement | null>(null);
  const setRef = useCallback((el: HTMLDialogElement | null) => {
    dialogRef.current = el;
    setNode(el);
  }, []);
  useModalDialog({
    dialogRef,
    node,
    present: true,
    open: true,
    dismissOnEscape: true,
    onOpenChange: () => undefined,
    requestClose: () => undefined,
  });
  return <dialog ref={setRef} aria-label="Modal" />;
}
