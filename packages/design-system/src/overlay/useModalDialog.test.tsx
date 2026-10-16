import { act, render } from '@testing-library/react';
import { startTransition, Suspense, use, useCallback, useRef, useState } from 'react';
import { describe, expect, it } from 'vitest';
import { useModalDialog } from './useModalDialog.js';

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
});
