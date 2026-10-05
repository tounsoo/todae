import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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
    const el = document.querySelector('dialog');
    el?.dispatchEvent(new Event('close'));
    expect(onOpenChange).toHaveBeenCalledWith(false, 'native');
  });

  it('reports a close right after an Escape cancel as escape', () => {
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
    expect(onOpenChange).not.toHaveBeenCalled();
    // Chrome without user activation closes anyway, a task later.
    el.dispatchEvent(new Event('close'));
    expect(onOpenChange).toHaveBeenCalledWith(false, 'escape');
    // A later close by script is not mistaken for that Escape.
    onOpenChange.mockClear();
    el.dispatchEvent(new Event('close'));
    expect(onOpenChange).toHaveBeenCalledWith(false, 'native');
  });
});

describe('Dialog close reasons', () => {
  it('adds form and native to Dialog only', () => {
    expectTypeOf<DialogCloseReason>().toEqualTypeOf<'escape' | 'backdrop' | 'close-button' | 'form' | 'native'>();
    expectTypeOf<'form'>().not.toMatchTypeOf<ComboboxCloseReason>();
    expectTypeOf<'native'>().not.toMatchTypeOf<ComboboxCloseReason>();
    expectTypeOf<'form'>().not.toMatchTypeOf<SheetCloseReason>();
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
    const submit = new Event('submit', { bubbles: true, cancelable: true });
    dialog.querySelector('form')!.dispatchEvent(submit);
    expect(submit.defaultPrevented).toBe(true);
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
