import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { cdp } from '@vitest/browser/context';
import { Activity, useState, type ReactNode } from 'react';
import { expect } from 'vitest';
import { BottomSheet } from '../components/BottomSheet.js';
import { Button } from '../components/Button.js';
import { Dialog, type DialogCloseReason } from '../components/Dialog.js';
import { Drawer } from '../components/Drawer.js';
import { Drilldown, type DrilldownChangeReason } from '../components/Drilldown.js';
import { Popover } from '../components/Popover.js';
import { usePopover } from '../hooks/usePopover.js';

/** vitest types the session without its methods; Playwright's session has `send`. */
export function emulateMedia(features: { name: string; value: string }[]) {
  return (cdp() as unknown as { send(method: string, params: object): Promise<unknown> }).send('Emulation.setEmulatedMedia', {
    features,
  });
}

export function Themed({ dir, children }: { dir?: 'rtl'; children: ReactNode }) {
  return (
    <div data-appearance="light" data-density="comfortable" dir={dir}>
      {children}
    </div>
  );
}

export function SettingsDialog({
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

export const dialog = () => document.querySelector('dialog')!;
export const view = (label: string) => document.querySelector<HTMLElement>(`[role="group"][aria-label="${label}"]`)!;
// Off Back, whose tip, shown while it had focus, would take the first Escape.
export async function focusInView(textbox: string) {
  screen.getByRole('textbox', { name: textbox }).focus();
  await waitFor(() => expect(document.querySelector('[role="tooltip"]:popover-open')).toBeNull());
}
export const settled = () => waitFor(() => expect(screen.getByTestId('viewport').hasAttribute('data-direction')).toBe(false));

export async function openDialog(ui: ReactNode) {
  render(ui);
  await waitFor(() => expect(dialog().matches(':modal')).toBe(true));
}

export function InPopover({
  defaultValue,
  defaultOpen,
  onValueChange,
}: {
  defaultValue: readonly string[];
  defaultOpen?: boolean;
  onValueChange?: (value: readonly string[], reason: DrilldownChangeReason) => void;
}) {
  const popover = usePopover({ defaultOpen });
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

export function ScrollList({ controlled = false }: { controlled?: boolean }) {
  const rows = Array.from({ length: 40 }, (_, i) => `Item ${i + 1}`);
  const [stack, setStack] = useState<readonly string[]>(['list']);
  const value = controlled ? { value: stack, onValueChange: setStack } : { defaultValue: ['list'] };
  return (
    <Themed>
      <Drawer.Root open onOpenChange={() => undefined}>
        <Drilldown.Root {...value}>
          <Drawer.Header>
            <Drilldown.Back />
            <Drawer.Title>
              <Drilldown.Label />
            </Drawer.Title>
          </Drawer.Header>
          <Drawer.Body data-testid="body">
            <Drilldown.Viewport data-testid="viewport">
              <Drilldown.View value="list" label="Items">
                {rows.map((row) =>
                  controlled ? (
                    <div key={row}>
                      <Button.Root variant="ghost" onClick={() => setStack(['list', row])}>
                        {row}
                      </Button.Root>
                    </div>
                  ) : (
                    <div key={row}>
                      <Drilldown.Trigger value={row} variant="ghost">
                        {row}
                      </Drilldown.Trigger>
                    </div>
                  ),
                )}
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
    </Themed>
  );
}

export const surfaceOpen = () => document.querySelector('dialog[open], [popover]:popover-open') !== null;

export function Surfaced({
  kind,
  open,
  drilldown = 'shown',
  onValueChange,
}: {
  kind: 'Dialog' | 'BottomSheet' | 'Popover';
  open: boolean;
  drilldown?: 'shown' | 'hidden' | 'gone';
  onValueChange: (value: readonly string[], reason: DrilldownChangeReason) => void;
}) {
  const content =
    drilldown === 'gone' ? null : (
      <Activity mode={drilldown === 'hidden' ? 'hidden' : 'visible'}>
        <Drilldown.Root defaultValue={['filters']} onValueChange={onValueChange}>
          <Drilldown.Viewport data-testid="viewport">
            <Drilldown.View value="filters" label="Filters">
              <Drilldown.Trigger value="brand">Brand</Drilldown.Trigger>
            </Drilldown.View>
            <Drilldown.View value="brand" label="Brand">
              <input aria-label="Search brands" />
            </Drilldown.View>
          </Drilldown.Viewport>
        </Drilldown.Root>
      </Activity>
    );
  const onOpenChange = () => undefined;
  return (
    <Themed>
      {kind === 'Dialog' ? (
        <Dialog.Root open={open} onOpenChange={onOpenChange} aria-label="Filters">
          {content}
        </Dialog.Root>
      ) : kind === 'BottomSheet' ? (
        <BottomSheet.Root open={open} onOpenChange={onOpenChange} aria-label="Filters">
          {content}
        </BottomSheet.Root>
      ) : (
        <PopoverSurface open={open}>{content}</PopoverSurface>
      )}
    </Themed>
  );
}

export function PopoverSurface({ open, children }: { open: boolean; children: ReactNode }) {
  const popover = usePopover({ open, onOpenChange: () => undefined });
  return (
    <>
      <Button.Root {...popover.getTriggerProps()}>Filters</Button.Root>
      <Popover.Root {...popover.getPopoverProps()} role="dialog" aria-label="Filters panel">
        {children}
      </Popover.Root>
    </>
  );
}

export function cleanupAll() {
  cleanup();
  document.body.replaceChildren();
}