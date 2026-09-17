import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

afterEach(cleanup);

describe('Dialog', () => {
  it('calls showModal once per open and close when open becomes false', () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    const close = vi.spyOn(HTMLDialogElement.prototype, 'close');
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <Dialog open={false} onOpenChange={onOpenChange}>
        <Dialog.Title>Save</Dialog.Title>
      </Dialog>,
    );
    expect(showModal).not.toHaveBeenCalled();
    rerender(
      <Dialog open onOpenChange={onOpenChange}>
        <Dialog.Title>Save</Dialog.Title>
      </Dialog>,
    );
    expect(showModal).toHaveBeenCalledTimes(1);
    expect(document.querySelector('dialog')?.hasAttribute('open')).toBe(true);
    rerender(
      <Dialog open={false} onOpenChange={onOpenChange}>
        <Dialog.Title>Save</Dialog.Title>
      </Dialog>,
    );
    expect(close).toHaveBeenCalled();
    showModal.mockRestore();
    close.mockRestore();
  });

  it('never renders the open attribute from React', () => {
    const { container } = render(
      <Dialog open={false} onOpenChange={() => undefined}>
        Title
      </Dialog>,
    );
    expect(container.querySelector('dialog')?.getAttribute('open')).toBeNull();
  });

  it('resyncs a native close while the prop is still open', () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <Dialog.Title>Save</Dialog.Title>
      </Dialog>,
    );
    const el = document.querySelector('dialog');
    el?.dispatchEvent(new Event('close'));
    expect(onOpenChange).toHaveBeenCalledWith(false, 'escape');
  });
});
