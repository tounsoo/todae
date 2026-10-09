'use client';

import { Button, Dialog, Field, OptionList, Stack, Text, useCombobox, type ComboboxOption } from '@tounsoo/todae';
import { useEffect, useRef, useState } from 'react';

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
  const [query, setQuery] = useState('');
  // Filled only when nothing had focus at open (Safari does not focus a clicked button).
  // Left null, Dialog returns focus to whatever had it when the palette opened.
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const cb = useCombobox({
    options: COMMANDS,
    presentation: 'sheet',
    // Controlled at null, so running a command never leaves a selection behind.
    value: null,
    // Only while open: the closing palette stays live, so a second Enter or click would run it again.
    onValueChange: (value: string | null) => {
      if (!value || !cb.open) return;
      setRan(COMMANDS.find((command) => command.value === value)?.label ?? value);
      onRun?.(value);
    },
    inputValue: query,
    onInputValueChange: setQuery,
    // Each time it opens, start from the full list with the top row active.
    onOpenChange: (open) => {
      if (!open) return;
      // Reopened while still closing: focus is inside, so keep the query and the focus target.
      if (cb.inputRef.current?.closest('dialog')?.contains(document.activeElement)) return;
      setQuery('');
      cb.highlight(null);
      returnFocusRef.current = document.activeElement === document.body ? cb.triggerRef.current : null;
    },
  });
  const { open, setOpen } = cb;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return;
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      // Match the letter K; fall back to the key's position when the layout has no Latin letters.
      const key = event.key.toLowerCase();
      const isK = /^[a-z]$/.test(key) ? key === 'k' : event.code === 'KeyK';
      if (!isK) return;
      event.preventDefault();
      if (!open) setOpen(true);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, setOpen]);

  return (
    <Stack>
      <Button.Root {...cb.getTriggerProps()} variant="secondary" aria-keyshortcuts="Control+K Meta+K">
        Search commands
      </Button.Root>
      <Dialog.Root
        open={cb.open}
        onOpenChange={setOpen}
        initialFocusRef={cb.inputRef}
        restoreFocusRef={returnFocusRef}
        aria-label="Commands"
      >
        <Field.Root id={cb.ids.input} aria-label="Command">
          <Field.TextInput {...cb.getInputProps()} placeholder="Type a command" />
        </Field.Root>
        <OptionList.Root {...cb.getListboxProps()} hidden={cb.isEmpty}>
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
