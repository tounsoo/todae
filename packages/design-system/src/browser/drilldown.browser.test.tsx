import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { cdp, userEvent } from '@vitest/browser/context';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from '../components/Button.js';
import { Dialog, type DialogCloseReason } from '../components/Dialog.js';
import { Drawer } from '../components/Drawer.js';
import { Drilldown, type DrilldownChangeReason } from '../components/Drilldown.js';
import { Menu } from '../components/Menu.js';
import { Popover } from '../components/Popover.js';
import { usePopover } from '../hooks/usePopover.js';
import { cssTimeMs } from '../overlay/cssTime.js';

/** vitest types the session without its methods; Playwright's session has `send`. */
function emulateMedia(features: { name: string; value: string }[]) {
  return (cdp() as unknown as { send(method: string, params: object): Promise<unknown> }).send('Emulation.setEmulatedMedia', {
    features,
  });
}

function Themed({ dir, children }: { dir?: 'rtl'; children: ReactNode }) {
  return (
    <div data-appearance="light" data-density="comfortable" dir={dir}>
      {children}
    </div>
  );
}

function SettingsDialog({
  onClose = () => undefined,
  onValueChange,
  dir,
  defaultValue = ['settings'],
  dismissOnEscape,
  inHeader,
  inAccount,
}: {
  onClose?: (reason: DialogCloseReason) => void;
  onValueChange?: (value: readonly string[], reason: DrilldownChangeReason) => void;
  dir?: 'rtl';
  defaultValue?: readonly string[];
  dismissOnEscape?: boolean;
  inHeader?: ReactNode;
  inAccount?: ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Themed dir={dir}>
      <Dialog.Root
        open={open}
        dismissOnEscape={dismissOnEscape}
        onOpenChange={(next, reason) => {
          setOpen(next);
          if (!next) onClose(reason);
        }}
      >
        <Drilldown.Root defaultValue={defaultValue} onValueChange={onValueChange}>
          <Dialog.Header>
            <Drilldown.Back />
            <Dialog.Title>
              <Drilldown.Label />
            </Dialog.Title>
            {inHeader}
            <Dialog.Close />
          </Dialog.Header>
          <Dialog.Body>
            <Drilldown.Viewport data-testid="viewport">
              <Drilldown.View value="settings" label="Settings">
                <Drilldown.Trigger value="account" variant="ghost">
                  Account
                </Drilldown.Trigger>
                <Drilldown.Trigger value="about" variant="ghost">
                  About
                </Drilldown.Trigger>
              </Drilldown.View>
              <Drilldown.View value="account" label="Account">
                <input aria-label="Display name" />
                <Drilldown.Trigger value="email" variant="ghost">
                  Email
                </Drilldown.Trigger>
                {inAccount}
              </Drilldown.View>
              <Drilldown.View value="email" label="Email">
                <input aria-label="Address" />
              </Drilldown.View>
              <Drilldown.View value="about" label="About">
                <p>Version 1.0</p>
              </Drilldown.View>
            </Drilldown.Viewport>
          </Dialog.Body>
        </Drilldown.Root>
      </Dialog.Root>
    </Themed>
  );
}

const dialog = () => screen.getByRole('dialog', { hidden: true }) as HTMLDialogElement;
const view = (label: string) => document.querySelector<HTMLElement>(`[role="group"][aria-label="${label}"]`)!;
// Off Back, whose tip, shown while it had focus, would take the first Escape.
async function focusInView(textbox: string) {
  screen.getByRole('textbox', { name: textbox }).focus();
  await waitFor(() => expect(document.querySelector('[role="tooltip"]:popover-open')).toBeNull());
}
const settled = () => waitFor(() => expect(screen.getByTestId('viewport').hasAttribute('data-direction')).toBe(false));

async function openDialog(ui: ReactNode) {
  render(ui);
  await waitFor(() => expect(dialog().matches(':modal')).toBe(true));
}

describe('Drilldown in a browser', () => {
  it('focuses the first tab stop of a pushed view, or the view itself, and returns focus to the trigger', async () => {
    await openDialog(<SettingsDialog />);
    const account = screen.getByRole('button', { name: 'Account' });
    await userEvent.click(account);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Display name' }));
    await settled();
    await userEvent.click(screen.getByRole('button', { name: 'Back to Settings' }));
    expect(document.activeElement).toBe(account);
    await settled();
    await userEvent.click(screen.getByRole('button', { name: 'About' }));
    expect(document.activeElement).toBe(view('About'));
    expect(screen.getByRole('dialog', { name: 'About' })).toBe(dialog());
  });

  it('keeps the leaving view on screen but inert and hidden from screen readers while it slides, then hides it', async () => {
    await openDialog(<SettingsDialog />);
    await userEvent.click(screen.getByRole('button', { name: 'Account' }));
    const leaving = view('Settings');
    expect(screen.getByTestId('viewport').getAttribute('data-direction')).toBe('forward');
    expect(leaving.inert).toBe(true);
    expect(leaving.getAttribute('aria-hidden')).toBe('true');
    expect(leaving.checkVisibility()).toBe(true);
    expect(view('Account').inert).toBe(false);
    await settled();
    expect(leaving.hidden).toBe(true);
    expect(leaving.checkVisibility()).toBe(false);
    expect(leaving.inert).toBe(false);
  });

  it('goes back on Escape and on a close request, and closes at the first view with reason escape', async () => {
    const onClose = vi.fn();
    const onValueChange = vi.fn();
    await openDialog(<SettingsDialog onClose={onClose} onValueChange={onValueChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Account' }));
    await userEvent.keyboard('{Escape}');
    expect(onValueChange).toHaveBeenLastCalledWith(['settings'], 'escape');
    expect(dialog().open).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Account' }));
    await settled();
    // The Android back gesture reaches a modal <dialog> as a close request with no key.
    await userEvent.click(screen.getByRole('button', { name: 'Account' }));
    dialog().requestClose();
    await waitFor(() => expect(onValueChange).toHaveBeenLastCalledWith(['settings'], 'escape'));
    expect(onValueChange).toHaveBeenCalledTimes(4);
    expect(dialog().open).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('escape'));
    expect(onValueChange).toHaveBeenCalledTimes(4);
  });

  it('scrolls to the top on push and brings back the offset on pop', async () => {
    const rows = Array.from({ length: 40 }, (_, i) => `Item ${i + 1}`);
    await openDialog(
      <Themed>
        <Drawer.Root open onOpenChange={() => undefined}>
          <Drilldown.Root defaultValue={['list']}>
            <Drawer.Header>
              <Drilldown.Back />
              <Drawer.Title>
                <Drilldown.Label />
              </Drawer.Title>
            </Drawer.Header>
            <Drawer.Body data-testid="body">
              <Drilldown.Viewport data-testid="viewport">
                <Drilldown.View value="list" label="Items">
                  {rows.map((row) => (
                    <div key={row}>
                      <Drilldown.Trigger value={row} variant="ghost">
                        {row}
                      </Drilldown.Trigger>
                    </div>
                  ))}
                </Drilldown.View>
                {rows.map((row) => (
                  <Drilldown.View key={row} value={row} label={row}>
                    <p>{row} details</p>
                  </Drilldown.View>
                ))}
              </Drilldown.Viewport>
            </Drawer.Body>
          </Drilldown.Root>
        </Drawer.Root>
      </Themed>,
    );
    const body = screen.getByTestId('body');
    await waitFor(() => expect(body.scrollHeight).toBeGreaterThan(body.clientHeight + 400));
    const trigger = screen.getByRole('button', { name: 'Item 30' });
    trigger.scrollIntoView({ block: 'center' });
    const offset = body.scrollTop;
    expect(offset).toBeGreaterThan(300);
    trigger.focus();
    await userEvent.keyboard('{Enter}');
    expect(body.scrollTop).toBe(0);
    await settled();
    await userEvent.click(screen.getByRole('button', { name: 'Back to Items' }));
    expect(body.scrollTop).toBe(offset);
    expect(document.activeElement).toBe(trigger);
  });

  it('slides the new view in from the inline end, from the left in right-to-left text', async () => {
    const start = async (dir?: 'rtl') => {
      await openDialog(<SettingsDialog dir={dir} />);
      await userEvent.click(screen.getByRole('button', { name: 'Account' }));
      const port = screen.getByTestId('viewport').getBoundingClientRect();
      const entering = view('Account').getBoundingClientRect();
      return { fromLeft: entering.left - port.left, fromRight: port.right - entering.right };
    };
    const ltr = await start();
    expect(ltr.fromLeft).toBeGreaterThan(ltr.fromRight);
    expect(ltr.fromLeft).toBeGreaterThan(0);
    document.body.replaceChildren();
    const rtl = await start('rtl');
    expect(rtl.fromRight).toBeGreaterThan(rtl.fromLeft);
    expect(rtl.fromRight).toBeGreaterThan(0);
  });

  it('walks back on Escape pressed again and again without the dialog closing', async () => {
    const onClose = vi.fn();
    const onValueChange = vi.fn();
    await openDialog(<SettingsDialog defaultValue={['settings', 'account', 'email']} onClose={onClose} onValueChange={onValueChange} />);
    const closes = vi.fn();
    const cancels = vi.fn();
    dialog().addEventListener('close', closes);
    dialog().addEventListener('cancel', cancels);
    await focusInView('Address');
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{Escape}');
    expect(onValueChange.mock.calls).toEqual([
      [['settings', 'account'], 'escape'],
      [['settings'], 'escape'],
    ]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(closes).not.toHaveBeenCalled();
    // Chromium sends a close request with no user activation since the last
    // one as an uncancelable cancel and closes the dialog, so Escape must not
    // become a close request while there is a view to go back to. Whether a
    // given Escape counts depends on the page's activation history.
    expect(cancels).not.toHaveBeenCalled();
    expect(dialog().open).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('escape'));
  });

  it('walks back on close requests sent one after another', async () => {
    const onValueChange = vi.fn();
    await openDialog(<SettingsDialog defaultValue={['settings', 'account', 'email']} onValueChange={onValueChange} />);
    await focusInView('Address');
    const closes = vi.fn();
    dialog().addEventListener('close', closes);
    dialog().requestClose();
    await waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(1));
    dialog().requestClose();
    await waitFor(() => expect(onValueChange).toHaveBeenCalledTimes(2));
    expect(onValueChange).toHaveBeenLastCalledWith(['settings'], 'escape');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(closes).not.toHaveBeenCalled();
    expect(dialog().open).toBe(true);
  });

  it('goes back on Escape with dismissOnEscape off, and does nothing at the first view', async () => {
    const onClose = vi.fn();
    const onValueChange = vi.fn();
    await openDialog(
      <SettingsDialog defaultValue={['settings', 'account']} dismissOnEscape={false} onClose={onClose} onValueChange={onValueChange} />,
    );
    await focusInView('Display name');
    await userEvent.keyboard('{Escape}');
    expect(onValueChange).toHaveBeenLastCalledWith(['settings'], 'escape');
    await settled();
    await userEvent.keyboard('{Escape}');
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(dialog().open).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('leaves Escape and close requests to the dialog when the deep Drilldown is hidden', async () => {
    const onClose = vi.fn();
    const onValueChange = vi.fn();
    function Hidden() {
      const [open, setOpen] = useState(true);
      return (
        <Themed>
          <Dialog.Root
            open={open}
            aria-label="Settings"
            onOpenChange={(next, reason) => {
              setOpen(next);
              if (!next) onClose(reason);
            }}
          >
            <button type="button">Focus me</button>
            <div hidden>
              <Drilldown.Root defaultValue={['settings', 'account']} onValueChange={onValueChange}>
                <Drilldown.Viewport>
                  <Drilldown.View value="settings" label="Settings" />
                  <Drilldown.View value="account" label="Account" />
                </Drilldown.Viewport>
              </Drilldown.Root>
            </div>
          </Dialog.Root>
        </Themed>
      );
    }
    await openDialog(<Hidden />);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('escape'));
    expect(onValueChange).not.toHaveBeenCalled();
    cleanupAll();
    onClose.mockClear();
    await openDialog(<Hidden />);
    dialog().requestClose();
    await waitFor(() => expect(onClose).toHaveBeenCalledWith('escape'));
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it('takes Escape and close requests in the innermost of nested Drilldowns first', async () => {
    const outer = vi.fn();
    const inner = vi.fn();
    await openDialog(
      <Themed>
        <Dialog.Root open aria-label="Nested" onOpenChange={() => undefined}>
          <Drilldown.Root defaultValue={['list', 'item']} onValueChange={outer}>
            <Drilldown.Viewport>
              <Drilldown.View value="list" label="List" />
              <Drilldown.View value="item" label="Item">
                <Drilldown.Root defaultValue={['summary', 'history']} onValueChange={inner}>
                  <Drilldown.Viewport>
                    <Drilldown.View value="summary" label="Summary" />
                    <Drilldown.View value="history" label="History">
                      <button type="button">Revert</button>
                    </Drilldown.View>
                  </Drilldown.Viewport>
                </Drilldown.Root>
              </Drilldown.View>
            </Drilldown.Viewport>
          </Drilldown.Root>
        </Dialog.Root>
      </Themed>,
    );
    screen.getByRole('button', { name: 'Revert' }).focus();
    await userEvent.keyboard('{Escape}');
    expect(inner).toHaveBeenLastCalledWith(['summary'], 'escape');
    expect(outer).not.toHaveBeenCalled();
    await userEvent.keyboard('{Escape}');
    expect(outer).toHaveBeenLastCalledWith(['list'], 'escape');
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('takes close requests in the innermost of nested Drilldowns first', async () => {
    const outer = vi.fn();
    const inner = vi.fn();
    await openDialog(
      <Themed>
        <Dialog.Root open aria-label="Nested" onOpenChange={() => undefined}>
          <Drilldown.Root defaultValue={['list', 'item']} onValueChange={outer}>
            <Drilldown.Viewport>
              <Drilldown.View value="list" label="List" />
              <Drilldown.View value="item" label="Item">
                <Drilldown.Root defaultValue={['summary', 'history']} onValueChange={inner}>
                  <Drilldown.Viewport>
                    <Drilldown.View value="summary" label="Summary" />
                    <Drilldown.View value="history" label="History" />
                  </Drilldown.Viewport>
                </Drilldown.Root>
              </Drilldown.View>
            </Drilldown.Viewport>
          </Drilldown.Root>
        </Dialog.Root>
      </Themed>,
    );
    dialog().requestClose();
    await waitFor(() => expect(inner).toHaveBeenLastCalledWith(['summary'], 'escape'));
    expect(outer).not.toHaveBeenCalled();
    dialog().requestClose();
    await waitFor(() => expect(outer).toHaveBeenLastCalledWith(['list'], 'escape'));
  });

  it('goes back on Escape in a Popover before the popover closes', async () => {
    const onValueChange = vi.fn();
    for (const defaultValue of [['filters'], ['filters', 'brand']]) {
      render(<InPopover defaultValue={defaultValue} onValueChange={onValueChange} />);
      const panel = document.querySelector<HTMLElement>('[popover]')!;
      await userEvent.click(screen.getByRole('button', { name: 'Filters' }));
      await waitFor(() => expect(panel.matches(':popover-open')).toBe(true));
      if (defaultValue.length === 1) await userEvent.click(screen.getByRole('button', { name: 'Brand' }));
      await focusInView('Search brands');
      await userEvent.keyboard('{Escape}');
      expect(onValueChange).toHaveBeenLastCalledWith(['filters'], 'escape');
      expect(panel.matches(':popover-open')).toBe(true);
      await settled();
      await userEvent.keyboard('{Escape}');
      expect(panel.matches(':popover-open')).toBe(false);
      cleanupAll();
      onValueChange.mockClear();
    }
  });
  it('settles at once under reduced motion', async () => {
    await emulateMedia([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    try {
      await openDialog(<SettingsDialog />);
      await userEvent.click(screen.getByRole('button', { name: 'Account' }));
      expect(screen.getByTestId('viewport').hasAttribute('data-direction')).toBe(false);
      expect(view('Settings').hidden).toBe(true);
      expect(view('Account').getAnimations()).toEqual([]);
      expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Display name' }));
    } finally {
      await emulateMedia([]);
    }
  });

  it('lets a Menu open in a view take a close request before the stack goes back', async () => {
    const onValueChange = vi.fn();
    const onClose = vi.fn();
    await openDialog(
      <SettingsDialog
        defaultValue={['settings', 'account']}
        onValueChange={onValueChange}
        onClose={onClose}
        inAccount={
          <Menu.Root>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Content>
              <Menu.Item>Rename</Menu.Item>
            </Menu.Content>
          </Menu.Root>
        }
      />,
    );
    await focusInView('Display name');
    await userEvent.click(screen.getByRole('button', { name: 'Actions' }));
    const menu = await screen.findByRole('menu');
    await waitFor(() => expect(menu.matches(':popover-open')).toBe(true));
    dialog().requestClose();
    await waitFor(() => expect(menu.matches(':popover-open')).toBe(false));
    expect(onValueChange).not.toHaveBeenCalled();
    dialog().requestClose();
    await waitFor(() => expect(onValueChange).toHaveBeenCalledWith(['settings'], 'escape'));
    expect(dialog().open).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('gives Escape and close requests to a Menu open in the header before the stack goes back', async () => {
    const onValueChange = vi.fn();
    const header = (
      <Menu.Root defaultOpen>
        <Menu.Trigger>More</Menu.Trigger>
        <Menu.Content>
          <Menu.Item>Help</Menu.Item>
        </Menu.Content>
      </Menu.Root>
    );
    for (const close of ['key', 'request'] as const) {
      await openDialog(<SettingsDialog defaultValue={['settings', 'account', 'email']} onValueChange={onValueChange} inHeader={header} />);
      const menu = await screen.findByRole('menu');
      await waitFor(() => expect(menu.matches(':popover-open')).toBe(true));
      screen.getByRole('menuitem', { name: 'Help' }).focus();
      await waitFor(() => expect(document.querySelector('[role="tooltip"]:popover-open')).toBeNull());
      if (close === 'key') await userEvent.keyboard('{Escape}');
      else dialog().requestClose();
      await waitFor(() => expect(menu.matches(':popover-open')).toBe(false));
      expect(onValueChange).not.toHaveBeenCalled();
      expect(view('Email').hidden).toBe(false);
      cleanupAll();
    }
  });

  it('goes back on a close request Chromium does not let the page cancel, and shows the dialog again', async () => {
    for (const dismissOnEscape of [true, false]) {
      const onClose = vi.fn();
      const onValueChange = vi.fn();
      await openDialog(
        <SettingsDialog
          defaultValue={['settings', 'account', 'email']}
          dismissOnEscape={dismissOnEscape}
          onClose={onClose}
          onValueChange={onValueChange}
        />,
      );
      await focusInView('Address');
      // What Chromium does with a close request past the page's activation:
      // an uncancelable cancel, then it closes the dialog itself.
      dialog().dispatchEvent(new Event('cancel', { cancelable: false }));
      dialog().close();
      await waitFor(() => expect(dialog().matches(':modal')).toBe(true));
      expect(onValueChange.mock.calls).toEqual([[['settings', 'account'], 'escape']]);
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(dialog().open).toBe(true);
      expect(onClose).not.toHaveBeenCalled();
      cleanupAll();
    }
  });

  it('starts an uncontrolled stack over when the Popover around it closes', async () => {
    const onValueChange = vi.fn();
    render(<InPopover defaultValue={['filters']} onValueChange={onValueChange} />);
    const panel = document.querySelector<HTMLElement>('[popover]')!;
    const trigger = screen.getByRole('button', { name: 'Filters' });
    await userEvent.click(trigger);
    await waitFor(() => expect(panel.matches(':popover-open')).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: 'Brand' }));
    await settled();
    await userEvent.click(trigger);
    await waitFor(() => expect(panel.matches(':popover-open')).toBe(false));
    await userEvent.click(trigger);
    await waitFor(() => expect(panel.matches(':popover-open')).toBe(true));
    expect(view('Filters').hidden).toBe(false);
    expect(view('Brand')).toBeNull();
    expect(onValueChange).toHaveBeenLastCalledWith(['filters'], 'reset');
  });

  it('returns focus to the first tab stop of the view below when the trigger is gone', async () => {
    function Gone() {
      const [shown, setShown] = useState(true);
      return (
        <Themed>
          <Dialog.Root open aria-label="Items" onOpenChange={() => undefined}>
            <Drilldown.Root defaultValue={['list']}>
              <Drilldown.Back />
              <Drilldown.Viewport data-testid="viewport">
                <Drilldown.View value="list" label="List">
                  <button type="button">Sort</button>
                  {shown ? <Drilldown.Trigger value="item">Item</Drilldown.Trigger> : null}
                </Drilldown.View>
                <Drilldown.View value="item" label="Item">
                  <button type="button" onClick={() => setShown(false)}>
                    Delete
                  </button>
                </Drilldown.View>
              </Drilldown.Viewport>
            </Drilldown.Root>
          </Dialog.Root>
        </Themed>
      );
    }
    await openDialog(<Gone />);
    await userEvent.click(screen.getByRole('button', { name: 'Item' }));
    await settled();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back to List' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Sort' }));
  });

  it('keeps the leaving view on screen until its slide ends, when CSS makes the slide longer', async () => {
    await openDialog(<SettingsDialog />);
    const style = document.createElement('style');
    style.textContent = '[data-entering], [data-leaving] { animation-duration: 700ms; }';
    document.head.append(style);
    try {
      const token = cssTimeMs(getComputedStyle(screen.getByTestId('viewport')).getPropertyValue('--todae-drilldown-motion-duration'))!;
      expect(token).toBeLessThan(500);
      await userEvent.click(screen.getByRole('button', { name: 'Account' }));
      await new Promise((resolve) => setTimeout(resolve, token + 100));
      expect(view('Settings').checkVisibility()).toBe(true);
      expect(view('Settings').inert).toBe(true);
      await settled();
      expect(view('Settings').hidden).toBe(true);
    } finally {
      style.remove();
    }
  });

  it('leaves focus on a control outside the views that set a controlled stack', async () => {
    function Wizard() {
      const [stack, setStack] = useState<readonly string[]>(['details']);
      return (
        <Themed>
          <Dialog.Root open aria-label="Wizard" onOpenChange={() => undefined}>
            <Drilldown.Root value={stack} onValueChange={setStack}>
              <Drilldown.Viewport data-testid="viewport">
                <Drilldown.View value="details" label="Details">
                  <input aria-label="Name" />
                </Drilldown.View>
                <Drilldown.View value="review" label="Review">
                  <input aria-label="Notes" />
                </Drilldown.View>
              </Drilldown.Viewport>
            </Drilldown.Root>
            <button type="button" onClick={() => setStack(['details', 'review'])}>
              Next
            </button>
          </Dialog.Root>
        </Themed>
      );
    }
    await openDialog(<Wizard />);
    const next = screen.getByRole('button', { name: 'Next' });
    await userEvent.click(next);
    expect(view('Review').hidden).toBe(false);
    expect(document.activeElement).toBe(next);
  });

  it('moves the views part of the way at the middle of the slide, in both text directions', async () => {
    for (const dir of [undefined, 'rtl'] as const) {
      await openDialog(<SettingsDialog dir={dir} />);
      await userEvent.click(screen.getByRole('button', { name: 'Account' }));
      const port = screen.getByTestId('viewport').getBoundingClientRect();
      for (const label of ['Account', 'Settings']) {
        for (const animation of view(label).getAnimations()) {
          animation.pause();
          animation.currentTime = Number(animation.effect!.getComputedTiming().duration) / 2;
        }
      }
      const offset = (label: string) => {
        const box = view(label).getBoundingClientRect();
        return dir === 'rtl' ? port.right - box.right : box.left - port.left;
      };
      // Coming in from the inline end, and the view below shifting toward the inline start.
      expect(offset('Account')).toBeGreaterThan(1);
      expect(offset('Account')).toBeLessThan(port.width - 1);
      expect(offset('Settings')).toBeLessThan(-1);
      expect(offset('Settings')).toBeGreaterThan(-0.3 * port.width + 1);
      cleanupAll();
    }
  });
});

function InPopover({
  defaultValue,
  onValueChange,
}: {
  defaultValue: readonly string[];
  onValueChange?: (value: readonly string[], reason: DrilldownChangeReason) => void;
}) {
  const popover = usePopover();
  return (
    <Themed>
      <Button.Root {...popover.getTriggerProps()}>Filters</Button.Root>
      <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Filters panel">
        <Drilldown.Root defaultValue={defaultValue} onValueChange={onValueChange}>
          <Drilldown.Back />
          <Drilldown.Viewport data-testid="viewport">
            <Drilldown.View value="filters" label="Filters">
              <Drilldown.Trigger value="brand">Brand</Drilldown.Trigger>
            </Drilldown.View>
            <Drilldown.View value="brand" label="Brand">
              <input aria-label="Search brands" />
            </Drilldown.View>
          </Drilldown.Viewport>
        </Drilldown.Root>
      </Popover.Root>
    </Themed>
  );
}

function cleanupAll() {
  cleanup();
  document.body.replaceChildren();
}
