'use client';

import { Button, Dialog, Stack, Toast, createToaster, type ToastLayout, type ToastTone } from '@tounsoo/todae';
import { useState } from 'react';

// One store for the page. In an app, make it once at module scope.
const toaster = createToaster<{ onUndo?: () => void }>();

const MESSAGES: Record<ToastTone, string> = {
  info: 'Draft synced',
  success: 'Changes saved',
  warning: 'You are offline',
  critical: 'Payment failed',
};

let count = 0;

function notify(tone: ToastTone) {
  count += 1;
  // A toast with an action stays until it is dismissed, so the action can't leave before someone reaches it.
  const undo = tone === 'success' ? { duration: Infinity, onUndo: () => toaster.add({ title: 'Changes undone' }) } : {};
  toaster.add({ tone, title: MESSAGES[tone], description: `Toast ${count}`, ...undo });
}

export function ToastDemo() {
  const [layout, setLayout] = useState<ToastLayout>('list');
  const [open, setOpen] = useState(false);
  return (
    <Stack.Root>
      <Stack.Root direction="row">
        {(Object.keys(MESSAGES) as ToastTone[]).map((tone) => (
          <Button.Root key={tone} variant="secondary" onClick={() => notify(tone)}>
            {tone}
          </Button.Root>
        ))}
      </Stack.Root>
      <Stack.Root direction="row">
        <Button.Root variant="ghost" pressed={layout === 'stack'} onPressedChange={(pressed) => setLayout(pressed ? 'stack' : 'list')}>
          Stack layout
        </Button.Root>
        <Button.Root variant="ghost" onClick={() => setOpen(true)}>
          Open a dialog
        </Button.Root>
      </Stack.Root>
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Title>Toasts over a dialog</Dialog.Title>
        <Dialog.Description>Toasts already showing moved in front of this dialog. New ones land there too.</Dialog.Description>
        <Dialog.Footer>
          <Button.Root variant="secondary" onClick={() => notify('success')}>
            Show a toast
          </Button.Root>
          <Dialog.Close>Close</Dialog.Close>
        </Dialog.Footer>
      </Dialog.Root>
      <Toast.Region toaster={toaster} layout={layout}>
        {(toast) => (
          <Toast.Root>
            <Toast.Title>{toast.title}</Toast.Title>
            <Toast.Description>{toast.description}</Toast.Description>
            {toast.onUndo ? <Toast.Action onClick={toast.onUndo}>Undo save</Toast.Action> : null}
            <Toast.Close />
          </Toast.Root>
        )}
      </Toast.Region>
    </Stack.Root>
  );
}
