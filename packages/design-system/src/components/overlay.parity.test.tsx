import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRef, type ComponentProps, type ComponentType, type ReactNode, type RefObject } from 'react';
import { BottomSheet } from './BottomSheet';
import { Dialog } from './Dialog';
import { Drawer } from './Drawer';

afterEach(cleanup);

type RootProps = {
  open: boolean;
  onOpenChange: (open: boolean, reason: string) => void;
  dismissOnEscape?: boolean;
  dismissOnBackdrop?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
};

type Harness = {
  name: string;
  reasonBackdrop: 'backdrop';
  Root: ComponentType<RootProps>;
  Title: ComponentType<{ children: ReactNode }>;
  Description: ComponentType<{ children: ReactNode }>;
  Close: ComponentType<{ children: ReactNode }>;
  clickBackdrop: (surface: HTMLElement) => void;
};

// The dialog element spans the viewport; its panel is a child.
function clickDialogBackdrop(surface: HTMLElement) {
  fireEvent.pointerDown(surface);
  fireEvent.click(surface);
}

const dialogHarness = (): Harness => ({
  name: 'Dialog',
  reasonBackdrop: 'backdrop',
  Root: (props) => <Dialog.Root {...(props as ComponentProps<typeof Dialog.Root>)} />,
  Title: Dialog.Title,
  Description: Dialog.Description,
  Close: Dialog.Close,
  clickBackdrop: clickDialogBackdrop,
});

const drawerHarness = (): Harness => ({
  ...dialogHarness(),
  name: 'Drawer',
  Root: (props) => <Drawer.Root {...(props as ComponentProps<typeof Drawer.Root>)} />,
  Title: Drawer.Title,
  Description: Drawer.Description,
  Close: Drawer.Close,
});

const sheetHarness = (): Harness => ({
  name: 'BottomSheet',
  reasonBackdrop: 'backdrop',
  Root: ({ dismissOnBackdrop, ...props }) => (
    <BottomSheet.Root {...(props as ComponentProps<typeof BottomSheet.Root>)} dismissOnBackdrop={dismissOnBackdrop} />
  ),
  Title: BottomSheet.Title,
  Description: BottomSheet.Description,
  Close: BottomSheet.Close,
  clickBackdrop(surface) {
    // The sheet is the dialog element; its ::backdrop hit-tests as the
    // dialog, outside the sheet's box.
    surface.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 400, width: 800, height: 400 });
    fireEvent.pointerDown(surface, { clientX: 10, clientY: 100 });
    fireEvent.click(surface, { clientX: 10, clientY: 100 });
  },
});

function renderSurface(h: Harness, open: boolean, props: Partial<RootProps>) {
  render(
    <h.Root open={open} onOpenChange={() => undefined} {...props}>
      <h.Title>Save file</h.Title>
      <h.Description>This cannot be undone.</h.Description>
      <button type="button">First</button>
      <h.Close>X</h.Close>
    </h.Root>,
  );
}

const getSurface = () => document.querySelector('dialog') as HTMLElement;

afterEach(() => {
  document.documentElement.style.overflow = '';
});

for (const harness of [dialogHarness, drawerHarness, sheetHarness]) {
  describe(`${harness().name} a11y contract`, () => {
    it('exposes a labelled modal dialog', () => {
      renderSurface(harness(), true, {});
      const surface = getSurface();
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
      const h = harness();
      render(
        <h.Root open onOpenChange={() => undefined} initialFocusRef={initialFocusRef}>
          <h.Title>Save file</h.Title>
          <button type="button" ref={initialFocusRef}>
            Target
          </button>
        </h.Root>,
      );
      await waitFor(() => {
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Target' }));
      });
      extra.remove();
    });

    it('dismisses on Escape unless disabled', () => {
      const onOpenChange = vi.fn();
      const h = harness();
      renderSurface(h, true, { onOpenChange });
      fireEvent.keyDown(getSurface(), { key: 'Escape' });
      fireEvent.keyDown(document, { key: 'Escape' });
      getSurface().dispatchEvent(new Event('cancel', { cancelable: true }));
      expect(onOpenChange).toHaveBeenCalledWith(false, 'escape');
      cleanup();
      const blocked = vi.fn();
      renderSurface(h, true, { onOpenChange: blocked, dismissOnEscape: false });
      fireEvent.keyDown(getSurface(), { key: 'Escape' });
      fireEvent.keyDown(document, { key: 'Escape' });
      getSurface().dispatchEvent(new Event('cancel', { cancelable: true }));
      expect(blocked).not.toHaveBeenCalled();
      expect(getSurface()).not.toBeNull();
    });

    it('dismisses on scrim and ignores panel clicks', async () => {
      const onOpenChange = vi.fn();
      const h = harness();
      renderSurface(h, true, { onOpenChange });
      const surface = getSurface();
      // A sheet takes scrim taps once its enter motion has started.
      await waitFor(() => expect(surface.hasAttribute('data-entered')).toBe(true));
      h.clickBackdrop(surface);
      expect(onOpenChange).toHaveBeenCalledWith(false, h.reasonBackdrop);
      cleanup();
      const blocked = vi.fn();
      renderSurface(h, true, { onOpenChange: blocked, dismissOnBackdrop: false });
      const again = getSurface();
      h.clickBackdrop(again);
      expect(blocked).not.toHaveBeenCalled();
      fireEvent.click(screen.getByText('Save file'));
      expect(blocked).not.toHaveBeenCalled();
    });

    it('restores focus to the trigger', async () => {
      const trigger = document.createElement('button');
      trigger.textContent = 'open';
      document.body.appendChild(trigger);
      trigger.focus();
      const h = harness();
      const { rerender } = render(
        <h.Root open onOpenChange={() => undefined}>
          <h.Title>Save file</h.Title>
          <button type="button">First</button>
        </h.Root>,
      );
      rerender(
        <h.Root open={false} onOpenChange={() => undefined}>
          <h.Title>Save file</h.Title>
          <button type="button">First</button>
        </h.Root>,
      );
      // The sheet gives focus back once its exit motion ends and the page behind is no longer inert.
      await waitFor(() => expect(document.activeElement).toBe(trigger), { timeout: 1000 });
      trigger.remove();
    });

    it('names the close button', () => {
      renderSurface(harness(), true, {});
      expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
    });
  });
}
