'use client';

import { Button, Dialog, Field, OptionList, Stack, Text, useCombobox, useHotkey, type ComboboxOption } from '@tounsoo/todae';
import { useState } from 'react';

const COMMANDS: ComboboxOption[] = [
  { value: 'new-invoice', label: 'Create invoice' },
  { value: 'new-customer', label: 'Add customer' },
  { value: 'billing', label: 'Open billing settings' },
  { value: 'theme', label: 'Switch theme' },
  { value: 'sign-out', label: 'Sign out' },
];

/** `onRun` lets tests count runs; the page renders it without props. */
export function CommandPalette({ onRun }: { onRun?: (value: string) => void } = {}) {
  const [ran, setRan] = useState<string | null>(null);
  const cb = useCombobox({
    options: COMMANDS,
    presentation: 'dialog',
    // Controlled at null, so running a command never leaves a selection behind.
    value: null,
    onValueChange: (value: string | null) => {
      if (!value) return;
      setRan(COMMANDS.find((command) => command.value === value)?.label ?? value);
      onRun?.(value);
    },
  });
  useHotkey(['Control+K', 'Meta+K'], () => {
    if (!cb.open) cb.setOpen(true);
  });

  return (
    <Stack.Root>
      <Button.Root {...cb.getTriggerProps()} variant="secondary" aria-keyshortcuts="Control+K Meta+K">
        Search commands
      </Button.Root>
      <Dialog.Root {...cb.getDialogProps()} aria-label="Commands">
        <Field.Root id={cb.ids.input} aria-label="Command">
          <Field.TextInput {...cb.getInputProps()} placeholder="Type a command" />
        </Field.Root>
        <OptionList.Root {...cb.getListboxProps()} hidden={cb.isEmpty}>
          {cb.items.map((item) => (
            <OptionList.Option key={item.id} {...cb.getOptionProps(item)} />
          ))}
        </OptionList.Root>
        <Text.Root tone="muted" role="status">
          {cb.isEmpty ? 'No matching commands.' : ''}
        </Text.Root>
      </Dialog.Root>
      <Text.Root size="s" tone="muted" role="status">
        {ran ? `Ran: ${ran}` : 'Press Ctrl+K or ⌘K, or use the button.'}
      </Text.Root>
    </Stack.Root>
  );
}
