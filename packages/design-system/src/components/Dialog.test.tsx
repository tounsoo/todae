import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import type { ComboboxCloseReason } from '../hooks/useCombobox.types';
import type { SheetCloseReason } from './BottomSheet';
import { Dialog, type DialogCloseReason } from './Dialog';

afterEach(cleanup);

describe('Dialog', () => {
  it('calls showModal once per open and close when open becomes false', async () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    const close = vi.spyOn(HTMLDialogElement.prototype, 'close');
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Dialog.Root open={false} onOpenChange={onOpenChange}>
        <Dialog.Title>Save</Dialog.Title>
      </Dialog.Root>,
    );
    expect(showModal).not.toHaveBeenCalled();
    rerender(
      <Dialog.Root open onOpenChange={onOpenChange}>
        <Dialog.Title>Save</Dialog.Title>
      </Dialog.Root>,
    );
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(document.querySelector('dialog')?.hasAttribute('open')).toBe(true);
    rerender(
      <Dialog.Root open={false} onOpenChange={onOpenChange}>
        <Dialog.Title>Save</Dialog.Title>
      </Dialog.Root>,
    );
    const el = document.querySelector('dialog');
    expect(el?.hasAttribute('open')).toBe(true);
    expect(el?.hasAttribute('data-exiting')).toBe(true);
    expect(close).not.toHaveBeenCalled();
    await waitFor(() => expect(close).toHaveBeenCalled(), { timeout: 400 });
    expect(el?.hasAttribute('open')).toBe(false);
    showModal.mockRestore();
    close.mockRestore();
  });

  it('sets data-entered after open so enter can tween without starting-style', async () => {
    const { rerender } = render(
      <Dialog.Root open={false} onOpenChange={() => undefined}>
        <Dialog.Title>Save</Dialog.Title>
      </Dialog.Root>,
    );
    rerender(
      <Dialog.Root open onOpenChange={() => undefined}>
        <Dialog.Title>Save</Dialog.Title>
      </Dialog.Root>,
    );
    const el = document.querySelector('dialog');
    expect(el?.hasAttribute('open')).toBe(true);
    await waitFor(() => expect(el?.hasAttribute('data-entered')).toBe(true));
  });

  it('never renders the open attribute from React', () => {
    const { container } = render(
      <Dialog.Root open={false} onOpenChange={() => undefined}>
        Title
      </Dialog.Root>,
    );
    expect(container.querySelector('dialog')?.getAttribute('open')).toBeNull();
  });

  it('resyncs a native close while the prop is still open', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog.Root open onOpenChange={onOpenChange}>
        <Dialog.Title>Save</Dialog.Title>
      </Dialog.Root>,
    );
    const el = document.querySelector('dialog')!;
    act(() => el.close());
    expect(onOpenChange).toHaveBeenCalledWith(false, 'native');
  });

  it('shows again after an Escape close the browser forces through with dismissOnEscape false', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog.Root open onOpenChange={onOpenChange} dismissOnEscape={false}>
        <Dialog.Title>Save</Dialog.Title>
      </Dialog.Root>,
    );
    const el = document.querySelector('dialog')!;
    const cancel = new Event('cancel', { cancelable: true });
    el.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    // Chrome without user activation closes anyway, a task later.
    act(() => el.close());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(el.open).toBe(true);
    // A later close by script is not mistaken for that Escape.
    act(() => el.close());
    expect(onOpenChange).toHaveBeenCalledWith(false, 'native');
  });

  it('reports one Escape once, even when the browser also forces the close', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog.Root open onOpenChange={onOpenChange}>
        <Dialog.Title>Save</Dialog.Title>
      </Dialog.Root>,
    );
    const el = document.querySelector('dialog')!;
    el.dispatchEvent(new Event('cancel', { cancelable: true }));
    act(() => el.close());
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, 'escape');
  });

  it('focuses initialFocusRef after showModal, and restoreFocusRef after the exit', async () => {
    // As in browsers: showModal focuses the first focusable element, and close
    // sends focus back to the element focused before showModal.
    const showModal = HTMLDialogElement.prototype.showModal;
    const close = HTMLDialogElement.prototype.close;
    let opener: HTMLElement | null = null;
    const show = vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) {
      opener = document.activeElement as HTMLElement;
      showModal.call(this);
      this.querySelector('input')?.focus();
    });
    const shut = vi.spyOn(HTMLDialogElement.prototype, 'close').mockImplementation(function (this: HTMLDialogElement) {
      close.call(this);
      opener?.focus();
    });
    function Harness({ open }: { open: boolean }) {
      const second = useRef<HTMLInputElement>(null);
      const restore = useRef<HTMLButtonElement>(null);
      return (
        <>
          <button type="button">Opener</button>
          <button type="button" ref={restore}>
            Elsewhere
          </button>
          <Dialog.Root open={open} onOpenChange={() => undefined} initialFocusRef={second} restoreFocusRef={restore}>
            <Dialog.Title>Save</Dialog.Title>
            <input aria-label="first" />
            <input aria-label="second" ref={second} />
          </Dialog.Root>
        </>
      );
    }
    const { rerender } = render(<Harness open={false} />);
    screen.getByText('Opener').focus();
    rerender(<Harness open />);
    expect(document.activeElement).toBe(screen.getByLabelText('second'));
    rerender(<Harness open={false} />);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText('Elsewhere')), { timeout: 1000 });
    show.mockRestore();
    shut.mockRestore();
  });

  it('turns the native close request off when dismissOnEscape is false', () => {
    render(
      <Dialog.Root open onOpenChange={() => undefined} dismissOnEscape={false}>
        <Dialog.Title>Save</Dialog.Title>
      </Dialog.Root>,
    );
    expect(document.querySelector('dialog')!.getAttribute('closedby')).toBe('none');
  });

  it('does not resume focus in a modal written inside it', () => {
    const showModal = HTMLDialogElement.prototype.showModal;
    const spy = vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) {
      showModal.call(this);
      this.querySelector('input')?.focus();
    });
    render(
      <Dialog.Root open onOpenChange={() => undefined}>
        <Dialog.Title>Save</Dialog.Title>
        <input aria-label="outer" />
        <dialog open>
          <input aria-label="inner" />
        </dialog>
      </Dialog.Root>,
    );
    const outer = document.querySelector('dialog')!;
    screen.getByLabelText('inner').focus();
    act(() => {
      (document.activeElement as HTMLElement).blur();
      outer.close();
    });
    expect(document.activeElement).toBe(screen.getByLabelText('outer'));
    spy.mockRestore();
  });

  it('ignores a close event that arrives after the element opened again', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog.Root open onOpenChange={onOpenChange}>
        <Dialog.Title>Save</Dialog.Title>
      </Dialog.Root>,
    );
    const el = document.querySelector('dialog')!;
    // The browser queues close events, so one can land after showModal ran again.
    el.dispatchEvent(new Event('close'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('shows again where the person was after a native close while open', () => {
    // As in browsers: showModal focuses the first focusable element, and close
    // sends focus back out of the element.
    const showModal = HTMLDialogElement.prototype.showModal;
    const spy = vi.spyOn(HTMLDialogElement.prototype, 'showModal').mockImplementation(function (this: HTMLDialogElement) {
      showModal.call(this);
      this.querySelector('input')?.focus();
    });
    render(
      <Dialog.Root open onOpenChange={() => undefined}>
        <Dialog.Title>Save</Dialog.Title>
        <input aria-label="first" />
        <input aria-label="second" />
      </Dialog.Root>,
    );
    const el = document.querySelector('dialog')!;
    screen.getByLabelText('second').focus();
    act(() => {
      (document.activeElement as HTMLElement).blur();
      el.close();
    });
    expect(el.open).toBe(true);
    expect(document.activeElement).toBe(screen.getByLabelText('second'));
    spy.mockRestore();
  });
});

describe('Dialog close reasons', () => {
  it('adds form and native to every <dialog>-backed surface', () => {
    expectTypeOf<DialogCloseReason>().toEqualTypeOf<'escape' | 'backdrop' | 'close-button' | 'form' | 'native'>();
    // BottomSheet is a <dialog> too, and a combobox can present as one.
    for (const reason of ['form', 'native'] as const) {
      expectTypeOf(reason).toMatchTypeOf<SheetCloseReason>();
      expectTypeOf(reason).toMatchTypeOf<ComboboxCloseReason>();
    }
  });
});

describe('Dialog form close', () => {
  function setup(form: React.ReactNode, onFormSubmit?: (event: React.FormEvent) => void) {
    const onOpenChange = vi.fn();
    render(
      <Dialog.Root open onOpenChange={onOpenChange}>
        <Dialog.Title>Delete file?</Dialog.Title>
        <div onSubmit={onFormSubmit}>{form}</div>
      </Dialog.Root>,
    );
    return { onOpenChange, dialog: document.querySelector('dialog')! };
  }

  it('reports a method="dialog" submit as form and keeps the submitter value', () => {
    const { onOpenChange, dialog } = setup(
      <form method="dialog">
        <button value="cancel">Cancel</button>
        <button value="delete">Delete</button>
      </form>,
    );
    fireEvent.click(screen.getByText('Delete'));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, 'form');
    expect(dialog.returnValue).toBe('delete');
  });

  it('leaves the element open until the owner closes it', () => {
    const close = vi.spyOn(HTMLDialogElement.prototype, 'close');
    const { dialog } = setup(
      <form method="dialog">
        <button>OK</button>
      </form>,
    );
    dialog.returnValue = 'previous';
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    dialog.querySelector('form')!.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
    // No submitter, so returnValue stays as it was, as natively.
    expect(dialog.returnValue).toBe('previous');
    expect(close).not.toHaveBeenCalled();
    expect(dialog.hasAttribute('open')).toBe(true);
    close.mockRestore();
  });

  it('honors formmethod on the submitter over the form method', () => {
    const { onOpenChange } = setup(
      <form method="post" action="#">
        <button formMethod="dialog" value="done">
          Done
        </button>
        <button formMethod="post">Save</button>
      </form>,
      (event) => {
        // Stop the post submit from navigating jsdom; it still reaches the dialog unprevented first.
        if ((event.nativeEvent as SubmitEvent).submitter?.getAttribute('formmethod') === 'post') event.preventDefault();
      },
    );
    fireEvent.click(screen.getByText('Save'));
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Done'));
    expect(onOpenChange).toHaveBeenCalledWith(false, 'form');
  });

  it('stays open when the form prevents its own submit', () => {
    const { onOpenChange } = setup(
      <form method="dialog" onSubmit={(event) => event.preventDefault()}>
        <button>OK</button>
      </form>,
    );
    fireEvent.click(screen.getByText('OK'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('ignores a dialog-method form portaled outside the element', () => {
    // jsdom cannot run the native submission this form falls through to.
    const stop = (event: Event) => event.preventDefault();
    document.addEventListener('submit', stop);
    const { onOpenChange } = setup(
      createPortal(
        <form method="dialog">
          <button>Elsewhere</button>
        </form>,
        document.body,
      ),
    );
    fireEvent.click(screen.getByText('Elsewhere'));
    expect(onOpenChange).not.toHaveBeenCalled();
    document.removeEventListener('submit', stop);
  });

  it('runs the consumer onSubmit on the dialog first and lets it keep the dialog open', () => {
    const onOpenChange = vi.fn();
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <Dialog.Root open onOpenChange={onOpenChange} onSubmit={onSubmit}>
        <form method="dialog">
          <button>OK</button>
        </form>
      </Dialog.Root>,
    );
    fireEvent.click(screen.getByText('OK'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
