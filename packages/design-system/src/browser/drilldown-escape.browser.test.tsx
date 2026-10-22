import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from '../components/Dialog.js';
import { Drilldown } from '../components/Drilldown.js';
import { Menu } from '../components/Menu.js';
import { Tabs } from '../components/Tabs.js';
import { cleanupAll, dialog, focusInView, InPopover, openDialog, settled, SettingsDialog, Themed, view } from '../test/drilldown.js';

describe('Drilldown Escape and the back gesture in a browser', () => {
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

  it('answers a close request as it answers Escape when focus is outside the Popover around it', async () => {
    for (const close of ['key', 'request'] as const) {
      const onValueChange = vi.fn();
      await openDialog(
        <Themed>
          <Dialog.Root open aria-label="Search" onOpenChange={() => undefined}>
            <button type="button">Outside</button>
            <InPopover defaultValue={['filters', 'brand']} defaultOpen onValueChange={onValueChange} />
          </Dialog.Root>
        </Themed>,
      );
      const panel = document.querySelector<HTMLElement>('[popover]')!;
      await waitFor(() => expect(panel.matches(':popover-open')).toBe(true));
      screen.getByRole('button', { name: 'Outside' }).focus();
      if (close === 'key') await userEvent.keyboard('{Escape}');
      else dialog().requestClose();
      await waitFor(() => expect(panel.matches(':popover-open')).toBe(false));
      expect(onValueChange).not.toHaveBeenCalled();
      expect(dialog().open).toBe(true);
      cleanupAll();
    }
  });

  it('keeps taking close requests for a Drilldown shown by a tab switch, with dismissOnEscape off', async () => {
    const onClose = vi.fn();
    const onValueChange = vi.fn();
    await openDialog(
      <Themed>
        <Dialog.Root open aria-label="Settings" dismissOnEscape={false} onOpenChange={(_, reason) => onClose(reason)}>
          <Tabs.Root defaultValue="general">
            <Tabs.List aria-label="Sections">
              <Tabs.Tab value="general">General</Tabs.Tab>
              <Tabs.Tab value="account">Account</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="general">
              <p>General settings</p>
            </Tabs.Panel>
            <Tabs.Panel value="account" keepMounted>
              <Drilldown.Root defaultValue={['account', 'email']} onValueChange={onValueChange}>
                <Drilldown.Viewport>
                  <Drilldown.View value="account" label="Account" />
                  <Drilldown.View value="email" label="Email">
                    <input aria-label="Address" />
                  </Drilldown.View>
                </Drilldown.Viewport>
              </Drilldown.Root>
            </Tabs.Panel>
          </Tabs.Root>
        </Dialog.Root>
      </Themed>,
    );
    await userEvent.click(screen.getByRole('tab', { name: 'Account' }));
    expect(view('Email').checkVisibility()).toBe(true);
    // The back gesture reaches the dialog only while closedby lets close requests through.
    expect(dialog().getAttribute('closedby')).toBe('closerequest');
    await userEvent.click(screen.getByRole('tab', { name: 'General' }));
    expect(view('Email').checkVisibility()).toBe(false);
    // A hidden Drilldown takes nothing, so an uncancelable request closes the
    // dialog natively and the shell shows it again.
    dialog().dispatchEvent(new Event('cancel', { cancelable: false }));
    dialog().close();
    await waitFor(() => expect(dialog().matches(':modal')).toBe(true));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(dialog().open).toBe(true);
    expect(onValueChange).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
