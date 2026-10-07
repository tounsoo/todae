import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { BottomSheet } from './BottomSheet';
import { Dialog } from './Dialog';

afterEach(cleanup);

type Harness = {
  name: string;
  reasonBackdrop: 'backdrop' | 'scrim';
  renderSurface: (open: boolean, props: Record<string, unknown>) => void;
  getSurface: () => HTMLElement;
  clickBackdrop: (surface: HTMLElement) => void;
};

function dialogHarness(): Harness {
  return {
    name: 'Dialog',
    reasonBackdrop: 'backdrop',
    renderSurface(open, props) {
      const onOpenChange = (props.onOpenChange as (open: boolean, reason: string) => void) ?? (() => undefined);
      render(
        <Dialog.Root
          open={open}
          onOpenChange={onOpenChange}
          dismissOnEscape={props.dismissOnEscape as boolean | undefined}
          dismissOnBackdrop={props.dismissOnBackdrop as boolean | undefined}
          initialFocusRef={props.initialFocusRef as never}
        >
          <Dialog.Title>Save file</Dialog.Title>
          <Dialog.Description>This cannot be undone.</Dialog.Description>
          <button type="button">First</button>
          <Dialog.Close>X</Dialog.Close>
        </Dialog.Root>,
      );
    },
    getSurface() {
      return document.querySelector('dialog') as HTMLElement;
    },
    clickBackdrop(surface) {
      // The dialog element spans the viewport; its panel is a child.
      fireEvent.pointerDown(surface);
      fireEvent.click(surface);
    },
  };
}

function sheetHarness(): Harness {
  return {
    name: 'BottomSheet',
    reasonBackdrop: 'scrim',
    renderSurface(open, props) {
      const onOpenChange = (props.onOpenChange as (open: boolean, reason: string) => void) ?? (() => undefined);
      render(
        <BottomSheet.Root
          open={open}
          onOpenChange={onOpenChange}
          dismissOnEscape={props.dismissOnEscape as boolean | undefined}
          dismissOnScrim={props.dismissOnBackdrop as boolean | undefined}
          initialFocusRef={props.initialFocusRef as never}
        >
          <BottomSheet.Title>Save file</BottomSheet.Title>
          <BottomSheet.Description>This cannot be undone.</BottomSheet.Description>
          <button type="button">First</button>
          <BottomSheet.Close>X</BottomSheet.Close>
        </BottomSheet.Root>,
      );
    },
    getSurface() {
      return document.querySelector('dialog') as HTMLElement;
    },
    clickBackdrop(surface) {
      // The sheet is the dialog element; its ::backdrop hit-tests as the
      // dialog, outside the sheet's box.
      surface.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 400, width: 800, height: 400 });
      fireEvent.pointerDown(surface, { clientX: 10, clientY: 100 });
      fireEvent.click(surface, { clientX: 10, clientY: 100 });
    },
  };
}

afterEach(() => {
  document.documentElement.style.overflow = '';
});

for (const harness of [dialogHarness, sheetHarness]) {
  describe(`${harness().name} a11y contract`, () => {
    it('exposes a labelled modal dialog', () => {
      harness().renderSurface(true, {});
      const surface = harness().getSurface();
      expect(surface.tagName).toBe('DIALOG');
      expect((surface as HTMLDialogElement).open).toBe(true);
      expect(surface.getAttribute('aria-modal')).toBe('true');
      expect(surface.getAttribute('aria-labelledby')).toBe(screen.getByText('Save file').id);
      expect(surface.getAttribute('aria-describedby')).toBe(screen.getByText('This cannot be undone.').id);
    });

    it('moves initial focus to the provided ref', async () => {
      const initialFocusRef = createRef<HTMLButtonElement>();
      const extra = document.createElement('button');
      extra.textContent = 'seed';
      document.body.appendChild(extra);
      extra.focus();
      render(
        harness().name === 'Dialog' ? (
          <Dialog.Root open onOpenChange={() => undefined} initialFocusRef={initialFocusRef}>
            <Dialog.Title>Save file</Dialog.Title>
            <button type="button" ref={initialFocusRef}>
              Target
            </button>
          </Dialog.Root>
        ) : (
          <BottomSheet.Root open onOpenChange={() => undefined} initialFocusRef={initialFocusRef}>
            <BottomSheet.Title>Save file</BottomSheet.Title>
            <button type="button" ref={initialFocusRef}>
              Target
            </button>
          </BottomSheet.Root>
        ),
      );
      await waitFor(() => {
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Target' }));
      });
      extra.remove();
    });

    it('dismisses on Escape unless disabled', () => {
      const onOpenChange = vi.fn();
      const h = harness();
      h.renderSurface(true, { onOpenChange });
      fireEvent.keyDown(h.getSurface(), { key: 'Escape' });
      fireEvent.keyDown(document, { key: 'Escape' });
      h.getSurface().dispatchEvent(new Event('cancel', { cancelable: true }));
      expect(onOpenChange).toHaveBeenCalledWith(false, 'escape');
      cleanup();
      const blocked = vi.fn();
      h.renderSurface(true, { onOpenChange: blocked, dismissOnEscape: false });
      fireEvent.keyDown(h.getSurface(), { key: 'Escape' });
      fireEvent.keyDown(document, { key: 'Escape' });
      h.getSurface().dispatchEvent(new Event('cancel', { cancelable: true }));
      expect(blocked).not.toHaveBeenCalled();
      expect(h.getSurface()).not.toBeNull();
    });

    it('dismisses on scrim and ignores panel clicks', () => {
      const onOpenChange = vi.fn();
      const h = harness();
      h.renderSurface(true, { onOpenChange });
      const surface = h.getSurface();
      h.clickBackdrop(surface);
      expect(onOpenChange).toHaveBeenCalledWith(false, h.reasonBackdrop);
      cleanup();
      const blocked = vi.fn();
      h.renderSurface(true, { onOpenChange: blocked, dismissOnBackdrop: false });
      const again = h.getSurface();
      h.clickBackdrop(again);
      expect(blocked).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText('Save file'));
      expect(blocked).not.toHaveBeenCalled();
    });

    it('locks scroll while open and restores on close', async () => {
      const h = harness();
      const { rerender } = render(
        h.name === 'Dialog' ? (
          <Dialog.Root open onOpenChange={() => undefined}>
            <Dialog.Title>Save file</Dialog.Title>
          </Dialog.Root>
        ) : (
          <BottomSheet.Root open onOpenChange={() => undefined}>
            <BottomSheet.Title>Save file</BottomSheet.Title>
          </BottomSheet.Root>
        ),
      );
      expect(document.documentElement.style.overflow).toBe('hidden');
      rerender(
        h.name === 'Dialog' ? (
          <Dialog.Root open={false} onOpenChange={() => undefined}>
            <Dialog.Title>Save file</Dialog.Title>
          </Dialog.Root>
        ) : (
          <BottomSheet.Root open={false} onOpenChange={() => undefined}>
            <BottomSheet.Title>Save file</BottomSheet.Title>
          </BottomSheet.Root>
        ),
      );
      expect(h.getSurface()).not.toBeNull();
      await waitFor(() => {
        expect(document.documentElement.style.overflow).not.toBe('hidden');
      }, { timeout: 500 });
    });

    it('restores focus to the trigger', async () => {
      const trigger = document.createElement('button');
      trigger.textContent = 'open';
      document.body.appendChild(trigger);
      trigger.focus();
      const h = harness();
      const { rerender } = render(
        h.name === 'Dialog' ? (
          <Dialog.Root open onOpenChange={() => undefined}>
            <Dialog.Title>Save file</Dialog.Title>
            <button type="button">First</button>
          </Dialog.Root>
        ) : (
          <BottomSheet.Root open onOpenChange={() => undefined}>
            <BottomSheet.Title>Save file</BottomSheet.Title>
            <button type="button">First</button>
          </BottomSheet.Root>
        ),
      );
      rerender(
        h.name === 'Dialog' ? (
          <Dialog.Root open={false} onOpenChange={() => undefined}>
            <Dialog.Title>Save file</Dialog.Title>
            <button type="button">First</button>
          </Dialog.Root>
        ) : (
          <BottomSheet.Root open={false} onOpenChange={() => undefined}>
            <BottomSheet.Title>Save file</BottomSheet.Title>
            <button type="button">First</button>
          </BottomSheet.Root>
        ),
      );
      await Promise.resolve();
      expect(document.activeElement).toBe(trigger);
      trigger.remove();
    });

    it('stays open when the parent ignores a dismiss request', () => {
      const h = harness();
      h.renderSurface(true, { onOpenChange: () => undefined });
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(h.getSurface()).not.toBeNull();
      if (h.name === 'Dialog') expect(h.getSurface().hasAttribute('open')).toBe(true);
    });

    it('names the close button', () => {
      harness().renderSurface(true, {});
      expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    });
  });
}
