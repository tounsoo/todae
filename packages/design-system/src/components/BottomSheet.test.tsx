import { Profiler, memo } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, expectTypeOf } from 'vitest';
import { heldModals } from '../overlay/modalStack';
import { BottomSheet, type BottomSheetRootProps, type SheetCloseReason } from './BottomSheet';

afterEach(cleanup);

describe('BottomSheet', () => {
  it('follows controlled snap and grabber arrows', () => {
    const onOpenChange = vi.fn();
    const onSnapChange = vi.fn();
    const { rerender } = render(
      <BottomSheet.Root open onOpenChange={onOpenChange} snap="mid" onSnapChange={onSnapChange}>
        <BottomSheet.Title>Pick</BottomSheet.Title>
      </BottomSheet.Root>,
    );
    expect(document.querySelector('[data-snap="mid"]')).not.toBeNull();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Resize sheet' }), { key: 'ArrowUp' });
    expect(onSnapChange).toHaveBeenCalledWith('full');
    rerender(
      <BottomSheet.Root open onOpenChange={onOpenChange} snap="full" onSnapChange={onSnapChange}>
        <BottomSheet.Title>Pick</BottomSheet.Title>
      </BottomSheet.Root>,
    );
    expect(document.querySelector('[data-snap="full"]')).not.toBeNull();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Resize sheet' }), { key: 'ArrowDown' });
    expect(onSnapChange).toHaveBeenCalledWith('mid');
  });

  it('disables mid when snapPoints is full only', () => {
    render(
      <BottomSheet.Root open onOpenChange={() => undefined} snapPoints={['full']}>
        <BottomSheet.Title>Full</BottomSheet.Title>
      </BottomSheet.Root>,
    );
    expect(document.querySelector('[data-snap="full"]')).not.toBeNull();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Resize sheet' }), { key: 'ArrowDown' });
    expect(document.querySelector('[data-snap="full"]')).not.toBeNull();
  });

  it('grows height with the pointer while dragging mid toward full', () => {
    const onSnapChange = vi.fn();
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    render(
      <BottomSheet.Root open onOpenChange={() => undefined} snap="mid" onSnapChange={onSnapChange}>
        <BottomSheet.Title>Resize</BottomSheet.Title>
        <BottomSheet.Body>list</BottomSheet.Body>
      </BottomSheet.Root>,
    );
    const sheet = document.querySelector('dialog') as HTMLElement;
    const handle = document.querySelector('[data-sheet-drag-handle]');
    expect(sheet).not.toBeNull();
    expect(handle).not.toBeNull();
    handle!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 7, clientY: 400 }));
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 7, clientY: 200 }));
    expect(sheet.hasAttribute('data-dragging')).toBe(true);
    expect(sheet.style.getPropertyValue('--todae-sheet-drag-height')).toBe('600px');
    expect(sheet.style.getPropertyValue('--todae-sheet-drag-y')).toBe('');
    expect(sheet.style.transform).toBe('');
    expect(onSnapChange).not.toHaveBeenCalled();
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 7, clientY: 200 }));
    expect(onSnapChange).toHaveBeenCalledWith('full');
  });

  it('dismisses from a handle drag past the threshold', () => {
    const onOpenChange = vi.fn();
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    render(
      <BottomSheet.Root open onOpenChange={onOpenChange}>
        <BottomSheet.Title>Drag</BottomSheet.Title>
        <BottomSheet.Body>list</BottomSheet.Body>
      </BottomSheet.Root>,
    );
    const handle = document.querySelector('[data-sheet-drag-handle]');
    expect(handle).not.toBeNull();
    handle!.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientY: 100 }));
    window.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 1, clientY: 500 }));
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1, clientY: 500 }));
    expect(onOpenChange).toHaveBeenCalledWith(false, 'drag');
  });

  it('does not drag from a scrolled body', () => {
    const onOpenChange = vi.fn();
    render(
      <BottomSheet.Root open onOpenChange={onOpenChange}>
        <BottomSheet.Title>List</BottomSheet.Title>
        <BottomSheet.Body>items</BottomSheet.Body>
      </BottomSheet.Root>,
    );
    const body = document.querySelector('dialog .todae_body') ?? document.querySelector('[class*="body"]');
    expect(body).toBeInstanceOf(HTMLElement);
    Object.defineProperty(body!, 'scrollTop', { configurable: true, value: 20 });
    fireEvent.pointerDown(body!, { button: 0, pointerId: 2, clientY: 80 });
    fireEvent.pointerMove(window, { pointerId: 2, clientY: 400 });
    fireEvent.pointerUp(window, { pointerId: 2, clientY: 400 });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('opens as a modal dialog and releases the scroll lock on unmount', () => {
    const { unmount } = render(
      <BottomSheet.Root open onOpenChange={() => undefined}>
        <BottomSheet.Title>Gone</BottomSheet.Title>
      </BottomSheet.Root>,
    );
    const sheet = screen.getByRole('dialog');
    expect(sheet.tagName).toBe('DIALOG');
    expect((sheet as HTMLDialogElement).open).toBe(true);
    expect(sheet.getAttribute('closedby')).toBe('closerequest');
    expect(document.querySelector('[data-todae-portal]')).toBeNull();
    expect(document.documentElement.style.overflow).toBe('hidden');
    unmount();
    expect(document.documentElement.style.overflow).not.toBe('hidden');
  });

  it('renders in place, so it inherits the theme from its parent', () => {
    render(
      <div data-testid="host">
        <BottomSheet.Root open onOpenChange={() => undefined} aria-label="s" />
      </div>,
    );
    expect(screen.getByTestId('host').contains(screen.getByRole('dialog'))).toBe(true);
  });

  it('turns the native close request off when dismissOnEscape is false', () => {
    const onOpenChange = vi.fn();
    render(<BottomSheet.Root open onOpenChange={onOpenChange} dismissOnEscape={false} aria-label="s" />);
    const sheet = screen.getByRole('dialog');
    expect(sheet.getAttribute('closedby')).toBe('none');
    const cancel = new Event('cancel', { cancelable: true });
    sheet.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('holds the cancel and asks the owner to close on Escape', () => {
    const onOpenChange = vi.fn();
    render(<BottomSheet.Root open onOpenChange={onOpenChange} aria-label="s" />);
    const cancel = new Event('cancel', { cancelable: true });
    screen.getByRole('dialog').dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(onOpenChange).toHaveBeenCalledWith(false, 'escape');
  });

  it('reports a close from outside Todae as native, and one right after a cancel as escape', () => {
    const onOpenChange = vi.fn();
    render(<BottomSheet.Root open onOpenChange={onOpenChange} aria-label="s" />);
    const sheet = screen.getByRole('dialog') as HTMLDialogElement;
    sheet.close();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'native');
    sheet.showModal();
    sheet.dispatchEvent(new Event('cancel', { cancelable: true }));
    sheet.close();
    expect(onOpenChange).toHaveBeenLastCalledWith(false, 'escape');
  });

  it('shows again after a native close while the owner keeps it open', () => {
    render(<BottomSheet.Root open onOpenChange={() => undefined} aria-label="s" />);
    const sheet = screen.getByRole('dialog') as HTMLDialogElement;
    act(() => sheet.close());
    expect(sheet.open).toBe(true);
    expect(sheet.getAttribute('aria-modal')).toBe('true');
  });

  it('ignores an Escape close the browser forced through when dismissOnEscape is false', () => {
    const onOpenChange = vi.fn();
    render(<BottomSheet.Root open onOpenChange={onOpenChange} dismissOnEscape={false} aria-label="s" />);
    const sheet = screen.getByRole('dialog') as HTMLDialogElement;
    sheet.dispatchEvent(new Event('cancel', { cancelable: true }));
    act(() => sheet.close());
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(sheet.open).toBe(true);
  });

  it('binds its cancel and close listeners once, not on every render', () => {
    const add = vi.spyOn(HTMLDialogElement.prototype, 'addEventListener');
    const { rerender } = render(<BottomSheet.Root open onOpenChange={() => undefined} aria-label="s" />);
    const count = () => add.mock.calls.filter(([type]) => type === 'cancel').length;
    const first = count();
    rerender(<BottomSheet.Root open onOpenChange={() => undefined} dismissOnEscape={false} aria-label="s" />);
    expect(count()).toBe(first);
    add.mockRestore();
  });

  it('closes through the owner on a method="dialog" form submit and keeps the submitter value', () => {
    const onOpenChange = vi.fn();
    const close = vi.spyOn(HTMLDialogElement.prototype, 'close');
    render(
      <BottomSheet.Root open onOpenChange={onOpenChange} aria-label="s">
        <BottomSheet.Body>
          <form method="dialog">
            <button value="later">Later</button>
            <button value="apply">Apply</button>
          </form>
        </BottomSheet.Body>
      </BottomSheet.Root>,
    );
    fireEvent.click(screen.getByText('Apply'));
    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false, 'form');
    const sheet = screen.getByRole('dialog') as HTMLDialogElement;
    expect(sheet.returnValue).toBe('apply');
    expect(close).not.toHaveBeenCalled();
    close.mockRestore();
  });

  it('leaves a form submit alone when the form prevents it or is not method="dialog"', () => {
    const onOpenChange = vi.fn();
    render(
      <BottomSheet.Root open onOpenChange={onOpenChange} aria-label="s">
        <BottomSheet.Body>
          <form method="dialog" onSubmit={(event) => event.preventDefault()}>
            <button>Prevented</button>
          </form>
          <form onSubmit={(event) => event.preventDefault()}>
            <button>Plain</button>
          </form>
        </BottomSheet.Body>
      </BottomSheet.Root>,
    );
    fireEvent.click(screen.getByText('Prevented'));
    fireEvent.click(screen.getByText('Plain'));
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('ignores a backdrop tap before the enter motion starts', async () => {
    const onOpenChange = vi.fn();
    render(<BottomSheet.Root open onOpenChange={onOpenChange} aria-label="s" />);
    const sheet = screen.getByRole('dialog');
    // Still at translateY(100%): below the viewport.
    sheet.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 800, width: 800, height: 400 });
    fireEvent.pointerDown(sheet, { clientX: 10, clientY: 900 });
    fireEvent.click(sheet, { clientX: 10, clientY: 900 });
    expect(onOpenChange).not.toHaveBeenCalled();
    await waitFor(() => expect(sheet.hasAttribute('data-entered')).toBe(true));
  });

  it('closes on a press and click on the backdrop, not on the sheet itself', async () => {
    const onOpenChange = vi.fn();
    const onClick = vi.fn();
    render(<BottomSheet.Root open onOpenChange={onOpenChange} onClick={onClick} aria-label="s" />);
    const sheet = screen.getByRole('dialog');
    sheet.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 400, width: 800, height: 400 });
    await waitFor(() => expect(sheet.hasAttribute('data-entered')).toBe(true));
    // On the sheet's own padding: the target is the dialog, but inside its box.
    fireEvent.pointerDown(sheet, { clientX: 10, clientY: 500 });
    fireEvent.click(sheet, { clientX: 10, clientY: 500 });
    expect(onOpenChange).not.toHaveBeenCalled();
    // A press that starts inside and ends on the backdrop is not a scrim click.
    fireEvent.pointerDown(sheet, { clientX: 10, clientY: 500 });
    fireEvent.click(sheet, { clientX: 10, clientY: 100 });
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.pointerDown(sheet, { clientX: 10, clientY: 100 });
    fireEvent.click(sheet, { clientX: 10, clientY: 100 });
    expect(onClick).toHaveBeenCalledTimes(3);
    expect(onOpenChange).toHaveBeenCalledWith(false, 'scrim');
  });

  it('keeps the backdrop open when dismissOnScrim is false or the consumer prevents the click', async () => {
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <BottomSheet.Root open onOpenChange={onOpenChange} dismissOnScrim={false} aria-label="s" />,
    );
    const sheet = screen.getByRole('dialog');
    sheet.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 400, width: 800, height: 400 });
    await waitFor(() => expect(sheet.hasAttribute('data-entered')).toBe(true));
    fireEvent.pointerDown(sheet, { clientX: 10, clientY: 100 });
    fireEvent.click(sheet, { clientX: 10, clientY: 100 });
    rerender(
      <BottomSheet.Root open onOpenChange={onOpenChange} onClick={(event) => event.preventDefault()} aria-label="s" />,
    );
    fireEvent.pointerDown(sheet, { clientX: 10, clientY: 100 });
    fireEvent.click(sheet, { clientX: 10, clientY: 100 });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('leaves the modal stack when it unmounts, open or not', async () => {
    const { rerender, unmount } = render(<BottomSheet.Root open onOpenChange={() => undefined} aria-label="s" />);
    expect(heldModals()).toHaveLength(1);
    rerender(<BottomSheet.Root open={false} onOpenChange={() => undefined} aria-label="s" />);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(heldModals()).toHaveLength(0);
    rerender(<BottomSheet.Root open onOpenChange={() => undefined} aria-label="s" />);
    unmount();
    expect(heldModals()).toHaveLength(0);
  });

  it('stays mounted while exiting then unmounts after the exit timeout', async () => {
    const { rerender } = render(
      <BottomSheet.Root open onOpenChange={() => undefined}>
        <BottomSheet.Title>Share</BottomSheet.Title>
      </BottomSheet.Root>,
    );
    rerender(
      <BottomSheet.Root open={false} onOpenChange={() => undefined}>
        <BottomSheet.Title>Share</BottomSheet.Title>
      </BottomSheet.Root>,
    );
    const sheet = document.querySelector('dialog') as HTMLElement;
    expect(sheet).not.toBeNull();
    expect(sheet.hasAttribute('data-exiting')).toBe(true);
    await waitFor(() => expect(document.querySelector('dialog')).toBeNull(), { timeout: 500 });
  });

  it('types snapPoints and close reasons', () => {
    expectTypeOf<NonNullable<BottomSheetRootProps['snapPoints']>>().toEqualTypeOf<readonly ('mid' | 'full')[]>();
    expectTypeOf<SheetCloseReason>().toEqualTypeOf<'escape' | 'scrim' | 'drag' | 'close-button' | 'form' | 'native'>();
    expectTypeOf(['peek'] as const).not.toMatchTypeOf<NonNullable<BottomSheetRootProps['snapPoints']>>();
  });

  it('keeps its context stable across renders with the default snap points', () => {
    const onRender = vi.fn();
    const Parts = memo(function Parts() {
      return (
        <Profiler id="title" onRender={onRender}>
          <BottomSheet.Title>Pick</BottomSheet.Title>
        </Profiler>
      );
    });
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <BottomSheet.Root open onOpenChange={onOpenChange}>
        <Parts />
      </BottomSheet.Root>,
    );
    const before = onRender.mock.calls.length;
    rerender(
      <BottomSheet.Root open onOpenChange={onOpenChange}>
        <Parts />
      </BottomSheet.Root>,
    );
    expect(onRender.mock.calls.length).toBe(before);
  });
});
