import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';
import { Drawer } from './Drawer';

afterEach(cleanup);

describe('Drawer', () => {
  it('is a modal dialog pinned to the end edge by default, named by Dialog.Title', () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    render(
      <Drawer.Root open onOpenChange={() => undefined}>
        <Dialog.Title>Filters</Dialog.Title>
      </Drawer.Root>,
    );
    const drawer = screen.getByRole('dialog', { name: 'Filters' });
    expect(drawer.tagName).toBe('DIALOG');
    expect(drawer.getAttribute('data-side')).toBe('end');
    expect(showModal).toHaveBeenCalledTimes(1);
    showModal.mockRestore();
  });

  it('pins to the start edge', () => {
    render(
      <Drawer.Root open onOpenChange={() => undefined} side="start" aria-label="Nav">
        <p>Links</p>
      </Drawer.Root>,
    );
    expect(screen.getByRole('dialog', { name: 'Nav' }).getAttribute('data-side')).toBe('start');
  });

  it('asks to close from Dialog.Close and Escape', () => {
    const onOpenChange = vi.fn();
    render(
      <Drawer.Root open onOpenChange={onOpenChange} aria-label="d">
        <Dialog.Close />
      </Drawer.Root>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'close-button');
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'escape');
  });

  it('asks to close from a scrim click, and stays mounted through its exit', async () => {
    const onOpenChange = vi.fn();
    const close = vi.spyOn(HTMLDialogElement.prototype, 'close');
    const { rerender } = render(
      <Drawer.Root open onOpenChange={onOpenChange} aria-label="d">
        <p>x</p>
      </Drawer.Root>,
    );
    const drawer = screen.getByRole('dialog');
    fireEvent.pointerDown(drawer);
    fireEvent.click(drawer);
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'backdrop');
    rerender(
      <Drawer.Root open={false} onOpenChange={onOpenChange} aria-label="d">
        <p>x</p>
      </Drawer.Root>,
    );
    expect(drawer.hasAttribute('data-exiting')).toBe(true);
    expect(close).not.toHaveBeenCalled();
    await waitFor(() => expect(close).toHaveBeenCalled(), { timeout: 600 });
    close.mockRestore();
  });
});
