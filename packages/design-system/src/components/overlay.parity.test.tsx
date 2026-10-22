import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRef, type ComponentProps, type ComponentType, type ReactNode, type RefObject } from 'react';
import { BottomSheet } from './BottomSheet.js';
import { Dialog } from './Dialog.js';
import { Drawer } from './Drawer.js';
import { Drilldown } from './Drilldown.js';
import { Tooltip } from './Tooltip.js';
import { useTooltip } from '../hooks/useTooltip.js';

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

    it('goes back in a Drilldown on Escape before it closes', () => {
      const onOpenChange = vi.fn();
      const onValueChange = vi.fn();
      const h = harness();
      const cancel = () => act(() => void getSurface().dispatchEvent(new Event('cancel', { cancelable: true })));
      render(
        <h.Root open onOpenChange={onOpenChange}>
          <h.Title>Settings</h.Title>
          <Drilldown.Root defaultValue={['settings', 'account']} onValueChange={onValueChange}>
            <Drilldown.Viewport>
              <Drilldown.View value="settings" label="Settings" />
              <Drilldown.View value="account" label="Account" />
            </Drilldown.Viewport>
          </Drilldown.Root>
        </h.Root>,
      );
      cancel();
      expect(onValueChange).toHaveBeenCalledWith(['settings'], 'escape');
      expect(onOpenChange).not.toHaveBeenCalled();
      cancel();
      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false, 'escape');
    });

    it("goes back in a Drilldown on a close request the browser won't let it cancel", () => {
      const onOpenChange = vi.fn();
      const onValueChange = vi.fn();
      const h = harness();
      render(
        <h.Root open onOpenChange={onOpenChange}>
          <h.Title>Settings</h.Title>
          <Drilldown.Root defaultValue={['settings', 'account']} onValueChange={onValueChange}>
            <Drilldown.Viewport>
              <Drilldown.View value="settings" label="Settings" />
              <Drilldown.View value="account" label="Account" />
            </Drilldown.Viewport>
          </Drilldown.Root>
        </h.Root>,
      );
      act(() => void getSurface().dispatchEvent(new Event('cancel', { cancelable: false })));
      expect(onValueChange).toHaveBeenCalledWith(['settings'], 'escape');
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('takes close requests for a Drilldown that can go back even with dismissOnEscape off', () => {
      const onOpenChange = vi.fn();
      const h = harness();
      render(
        <h.Root open onOpenChange={onOpenChange} dismissOnEscape={false}>
          <h.Title>Settings</h.Title>
          <Drilldown.Root defaultValue={['settings', 'account']}>
            <Drilldown.Viewport>
              <Drilldown.View value="settings" label="Settings" />
              <Drilldown.View value="account" label="Account" />
            </Drilldown.Viewport>
          </Drilldown.Root>
        </h.Root>,
      );
      expect(getSurface().getAttribute('closedby')).toBe('closerequest');
      act(() => void getSurface().dispatchEvent(new Event('cancel', { cancelable: true })));
      expect(screen.getByRole('group', { name: 'Settings' })).toBeTruthy();
      expect(getSurface().getAttribute('closedby')).toBe('none');
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('leaves close requests to the surface while a Tooltip inside takes only the Escape key', () => {
      const onOpenChange = vi.fn();
      const onTipChange = vi.fn();
      const h = harness();
      function Tip() {
        const tooltip = useTooltip({ open: true, onOpenChange: onTipChange });
        return (
          <>
            <button type="button" {...tooltip.getTriggerProps()}>
              Archive
            </button>
            <Tooltip.Root {...tooltip.getTooltipProps()}>Archive the file</Tooltip.Root>
          </>
        );
      }
      const surface = (dismissOnEscape: boolean) => (
        <h.Root open onOpenChange={onOpenChange} dismissOnEscape={dismissOnEscape}>
          <h.Title>Files</h.Title>
          <Tip />
        </h.Root>
      );
      const { rerender } = render(surface(false));
      expect(getSurface().getAttribute('closedby')).toBe('none');
      rerender(surface(true));
      act(() => void getSurface().dispatchEvent(new Event('cancel', { cancelable: true })));
      expect(onOpenChange).toHaveBeenCalledWith(false, 'escape');
      expect(onTipChange).not.toHaveBeenCalled();
      fireEvent.keyDown(screen.getByRole('button', { name: 'Archive', hidden: true }), { key: 'Escape' });
      expect(onTipChange).toHaveBeenCalledWith(false, 'escape');
      expect(onOpenChange).toHaveBeenCalledTimes(1);
    });

    it('starts an uncontrolled Drilldown over with reason reset when it closes', () => {
      const onValueChange = vi.fn();
      const h = harness();
      const surface = (open: boolean) => (
        <h.Root open={open} onOpenChange={() => undefined}>
          <h.Title>Settings</h.Title>
          <Drilldown.Root defaultValue={['settings']} onValueChange={onValueChange}>
            <Drilldown.Viewport>
              <Drilldown.View value="settings" label="Settings">
                <Drilldown.Trigger value="account">Account</Drilldown.Trigger>
              </Drilldown.View>
              <Drilldown.View value="account" label="Account" />
            </Drilldown.Viewport>
          </Drilldown.Root>
        </h.Root>
      );
      const { rerender } = render(surface(true));
      fireEvent.click(screen.getByRole('button', { name: 'Account' }));
      vi.useFakeTimers();
      try {
        rerender(surface(false));
        act(() => vi.runAllTimers());
      } finally {
        vi.useRealTimers();
      }
      expect(onValueChange.mock.calls).toEqual([
        [['settings', 'account'], 'push'],
        [['settings'], 'reset'],
      ]);
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
