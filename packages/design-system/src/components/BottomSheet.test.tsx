import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi, expectTypeOf } from 'vitest';
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
    const sheet = document.querySelector('[role="dialog"]') as HTMLElement;
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
    const body = document.querySelector('[role="dialog"] .todae_body') ?? document.querySelector('[class*="body"]');
    expect(body).toBeInstanceOf(HTMLElement);
    Object.defineProperty(body!, 'scrollTop', { configurable: true, value: 20 });
    fireEvent.pointerDown(body!, { button: 0, pointerId: 2, clientY: 80 });
    fireEvent.pointerMove(window, { pointerId: 2, clientY: 400 });
    fireEvent.pointerUp(window, { pointerId: 2, clientY: 400 });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('releases lock and inert on unmount while open', () => {
    const sibling = document.createElement('div');
    document.body.appendChild(sibling);
    const { unmount } = render(
      <BottomSheet.Root open onOpenChange={() => undefined}>
        <BottomSheet.Title>Gone</BottomSheet.Title>
      </BottomSheet.Root>,
    );
    expect(document.documentElement.style.overflow).toBe('hidden');
    expect(sibling.inert).toBe(true);
    unmount();
    expect(document.documentElement.style.overflow).not.toBe('hidden');
    expect(sibling.inert).toBe(false);
    sibling.remove();
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
    const sheet = document.querySelector('[role="dialog"]') as HTMLElement;
    expect(sheet).not.toBeNull();
    expect(sheet.parentElement?.hasAttribute('data-exiting')).toBe(true);
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull(), { timeout: 500 });
  });

  it('types snapPoints and close reasons', () => {
    expectTypeOf<NonNullable<BottomSheetRootProps['snapPoints']>>().toEqualTypeOf<readonly ('mid' | 'full')[]>();
    expectTypeOf<SheetCloseReason>().toEqualTypeOf<'escape' | 'scrim' | 'drag' | 'close-button'>();
    expectTypeOf(['peek'] as const).not.toMatchTypeOf<NonNullable<BottomSheetRootProps['snapPoints']>>();
  });
});
