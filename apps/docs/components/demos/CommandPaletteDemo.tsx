'use client';

import { Button, Dialog, Field, OptionList, Stack, Text, useCombobox, type ComboboxOption } from '@tounsoo/todae';
import { useEffect, useState } from 'react';

const COMMANDS: ComboboxOption[] = [
  { value: 'new-invoice', label: 'Create invoice' },
  { value: 'new-customer', label: 'Add customer' },
  { value: 'billing', label: 'Open billing settings' },
  { value: 'theme', label: 'Switch theme' },
  { value: 'sign-out', label: 'Sign out' },
];

export function CommandPalette() {
  const [ran, setRan] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const cb = useCombobox({
    options: COMMANDS,
    presentation: 'sheet',
    // Controlled at null, so running a command never leaves a selection behind.
    value: null,
    onChange: (value: string | null) => {
      if (value) setRan(COMMANDS.find((command) => command.value === value)?.label ?? value);
    },
    inputValue: query,
    onInputValueChange: setQuery,
    // Each time it opens, start from the full list.
    onOpenChange: (open) => {
      if (open) setQuery('');
    },
  });
  const { setOpen } = cb;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      // event.code names the physical key, so the shortcut works on any keyboard layout.
      if ((event.metaKey || event.ctrlKey) && event.code === 'KeyK') {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [setOpen]);

  return (
    <Stack>
      <Button.Root {...cb.getTriggerProps()} variant="secondary" aria-keyshortcuts="Control+K Meta+K">
        Search commands
      </Button.Root>
      <Dialog.Root open={cb.open} onOpenChange={setOpen} initialFocusRef={cb.inputRef} aria-label="Commands">
        <Field.Root id={cb.ids.input} aria-label="Command">
          <Field.TextInput {...cb.getInputProps()} placeholder="Type a command" />
        </Field.Root>
        <OptionList.Root {...cb.getListboxProps()}>
          {cb.items.map((item) => (
            <OptionList.Option key={item.id} {...cb.getOptionProps(item)} />
          ))}
        </OptionList.Root>
        <Text tone="muted" role="status">
          {cb.isEmpty ? 'No matching commands.' : ''}
        </Text>
      </Dialog.Root>
      <Text size="s" tone="muted" role="status">
        {ran ? `Ran: ${ran}` : 'Press Ctrl+K or ⌘K, or use the button.'}
      </Text>
    </Stack>
  );
}
