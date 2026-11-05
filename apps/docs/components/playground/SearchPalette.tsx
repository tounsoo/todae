'use client';

import {
  Button,
  Dialog,
  Field,
  OptionList,
  Text,
  useCombobox,
  useHotkey,
  type ComboboxFilterOptions,
  type ComboboxOption,
} from '@tounsoo/todae';
import type { ReactNode } from 'react';
import type { Invoice } from './billing';
import type { Kit } from './kit';

/** A command the search runs: its words, and what it does. */
export type PaletteCommand = { value: string; label: string; run: () => void };

/** Options that start with the text come first, then the others that hold it. */
const rank: ComboboxFilterOptions = (options, query) => {
  const needle = query.toLocaleLowerCase();
  const holds = options.filter((option) => option.label.toLocaleLowerCase().includes(needle));
  const starts = holds.filter((option) => option.label.toLocaleLowerCase().startsWith(needle));
  return [...starts, ...holds.filter((option) => !starts.includes(option))];
};

/**
 * The header's search: Ctrl K or ⌘K, or its button, opens a dialog that finds
 * a command or an invoice by its number or customer. Picking an invoice opens it.
 */
export function SearchPalette({
  kit,
  commands,
  invoices,
  onOpenInvoice,
  icon,
}: {
  kit: Kit;
  commands: readonly PaletteCommand[];
  invoices: readonly Invoice[];
  onOpenInvoice: (id: string) => void;
  icon?: ReactNode;
}) {
  const { copy } = kit;
  const options: ComboboxOption[] = [
    ...commands.map(({ value, label }) => ({ value, label })),
    ...invoices.map((invoice) => ({ value: `invoice:${invoice.id}`, label: copy.palette.open(invoice) })),
  ];
  const cb = useCombobox({
    options,
    filterOptions: rank,
    presentation: 'dialog',
    // Held at null, so a command run leaves no selection behind.
    value: null,
    onValueChange: (value: string | null) => {
      if (!value) return;
      if (value.startsWith('invoice:')) onOpenInvoice(value.slice('invoice:'.length));
      else commands.find((command) => command.value === value)?.run();
    },
  });
  useHotkey(['Control+K', 'Meta+K'], () => {
    if (!cb.open) cb.setOpen(true);
  });

  return (
    <>
      <Button.Root {...cb.getTriggerProps()} variant="secondary" aria-keyshortcuts="Control+K Meta+K">
        {icon ? <Button.Icon>{icon}</Button.Icon> : null}
        {copy.search}
      </Button.Root>
      <Dialog.Root {...cb.getDialogProps()} aria-label={copy.search}>
        <Field.Root id={cb.ids.input} aria-label={copy.palette.input}>
          <Field.TextInput {...cb.getInputProps()} placeholder={copy.palette.placeholder} />
        </Field.Root>
        <OptionList.Root {...cb.getListboxProps({ 'aria-label': copy.palette.input })} hidden={cb.isEmpty}>
          {cb.items.map((item) => (
            <OptionList.Option key={item.id} {...cb.getOptionProps(item)} />
          ))}
        </OptionList.Root>
        <Text.Root tone="muted" role="status">
          {cb.isEmpty ? copy.palette.empty : ''}
        </Text.Root>
      </Dialog.Root>
    </>
  );
}
