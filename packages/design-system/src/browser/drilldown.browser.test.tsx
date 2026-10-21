import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog, type DialogCloseReason } from '../components/Dialog.js';
import { Drawer } from '../components/Drawer.js';
import { Drilldown, type DrilldownChangeReason } from '../components/Drilldown.js';

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
}: {
  onClose?: (reason: DialogCloseReason) => void;
  onValueChange?: (value: readonly string[], reason: DrilldownChangeReason) => void;
  dir?: 'rtl';
}) {
  const [open, setOpen] = useState(true);
  return (
    <Themed dir={dir}>
      <Dialog.Root
        open={open}
        onOpenChange={(next, reason) => {
          setOpen(next);
          if (!next) onClose(reason);
        }}
      >
        <Drilldown.Root defaultValue={['settings']} onValueChange={onValueChange}>
          <Dialog.Header>
            <Drilldown.Back />
            <Dialog.Title>
              <Drilldown.Label />
            </Dialog.Title>
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
});
