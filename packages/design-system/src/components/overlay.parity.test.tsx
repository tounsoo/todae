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
};

function dialogHarness(): Harness {
  return {
    name: 'Dialog',
    reasonBackdrop: 'backdrop',
    renderSurface(open, props) {
      const onOpenChange = (props.onOpenChange as (open: boolean, reason: string) => void) ?? (() => undefined);
      render(
        <Dialog
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
        </Dialog>,
      );
    },
    getSurface() {
      return document.querySelector('dialog') as HTMLElement;
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
        <BottomSheet
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
        </BottomSheet>,
      );
    },
    getSurface() {
      return document.querySelector('[role="dialog"]') as HTMLElement;
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
          <Dialog open onOpenChange={() => undefined} initialFocusRef={initialFocusRef}>
            <Dialog.Title>Save file</Dialog.Title>
            <button type="button" ref={initialFocusRef}>
              Target
            </button>
          </Dialog>
        ) : (
          <BottomSheet open onOpenChange={() => undefined} initialFocusRef={initialFocusRef}>
            <BottomSheet.Title>Save file</BottomSheet.Title>
            <button type="button" ref={initialFocusRef}>
              Target
            </button>
          </BottomSheet>
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
      if (h.name === 'Dialog') h.getSurface().dispatchEvent(new Event('cancel', { cancelable: true }));
      expect(onOpenChange).toHaveBeenCalledWith(false, 'escape');
      cleanup();
      const blocked = vi.fn();
      h.renderSurface(true, { onOpenChange: blocked, dismissOnEscape: false });
      fireEvent.keyDown(h.getSurface(), { key: 'Escape' });
      fireEvent.keyDown(document, { key: 'Escape' });
      if (h.name === 'Dialog') h.getSurface().dispatchEvent(new Event('cancel', { cancelable: true }));
      expect(blocked).not.toHaveBeenCalled();
      expect(h.getSurface()).not.toBeNull();
    });

    it('dismisses on scrim and ignores panel clicks', () => {
      const onOpenChange = vi.fn();
      const h = harness();
      h.renderSurface(true, { onOpenChange });
      const surface = h.getSurface();
      if (h.name === 'Dialog') {
        fireEvent.pointerDown(surface);
        fireEvent.click(surface);
      } else {
        fireEvent.click(surface.parentElement!.querySelector('[class*="scrim"]')!);
      }
      expect(onOpenChange).toHaveBeenCalledWith(false, h.reasonBackdrop);
      cleanup();
      const blocked = vi.fn();
      h.renderSurface(true, { onOpenChange: blocked, dismissOnBackdrop: false });
      const again = h.getSurface();
      if (h.name === 'Dialog') {
        fireEvent.pointerDown(again);
        fireEvent.click(again);
      } else {
        fireEvent.click(again.parentElement!.querySelector('[class*="scrim"]')!);
      }
      expect(blocked).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText('Save file'));
      expect(blocked).not.toHaveBeenCalled();
    });

    it('locks scroll while open and restores on close', async () => {
      const h = harness();
      const { rerender } = render(
        h.name === 'Dialog' ? (
          <Dialog open onOpenChange={() => undefined}>
            <Dialog.Title>Save file</Dialog.Title>
          </Dialog>
        ) : (
          <BottomSheet open onOpenChange={() => undefined}>
            <BottomSheet.Title>Save file</BottomSheet.Title>
          </BottomSheet>
        ),
      );
      expect(document.documentElement.style.overflow).toBe('hidden');
      rerender(
        h.name === 'Dialog' ? (
          <Dialog open={false} onOpenChange={() => undefined}>
            <Dialog.Title>Save file</Dialog.Title>
          </Dialog>
        ) : (
          <BottomSheet open={false} onOpenChange={() => undefined}>
            <BottomSheet.Title>Save file</BottomSheet.Title>
          </BottomSheet>
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
          <Dialog open onOpenChange={() => undefined}>
            <Dialog.Title>Save file</Dialog.Title>
            <button type="button">First</button>
          </Dialog>
        ) : (
          <BottomSheet open onOpenChange={() => undefined}>
            <BottomSheet.Title>Save file</BottomSheet.Title>
            <button type="button">First</button>
          </BottomSheet>
        ),
      );
      rerender(
        h.name === 'Dialog' ? (
          <Dialog open={false} onOpenChange={() => undefined}>
            <Dialog.Title>Save file</Dialog.Title>
            <button type="button">First</button>
          </Dialog>
        ) : (
          <BottomSheet open={false} onOpenChange={() => undefined}>
            <BottomSheet.Title>Save file</BottomSheet.Title>
            <button type="button">First</button>
          </BottomSheet>
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
