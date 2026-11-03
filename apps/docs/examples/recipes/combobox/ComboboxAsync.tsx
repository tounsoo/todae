'use client';

import { ChevronDown } from 'lucide-react';
import {
  Button,
  Field,
  Label,
  OptionList,
  Popover,
  Text,
  useCombobox,
  type ComboboxOption,
} from '@tounsoo/todae';

const PACKAGES: ComboboxOption[] = [
  { value: 'todae', label: 'todae' },
  { value: 'tokens', label: 'tokens' },
];

function optionNodes(
  items: ReturnType<typeof useCombobox>['items'],
  getOptionProps: ReturnType<typeof useCombobox>['getOptionProps'],
) {
  return items.map((item) => <OptionList.Option key={item.id} {...getOptionProps(item)} />);
}

function loadPackages(query: string, signal: AbortSignal): Promise<ComboboxOption[]> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      if (query.includes('fail')) {
        reject(new Error('Couldn’t load options'));
        return;
      }
      resolve(PACKAGES.filter((item) => item.label.toLowerCase().includes(query.trim().toLowerCase())));
    }, 400);
    signal.addEventListener('abort', () => {
      window.clearTimeout(timer);
      reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    });
  });
}

export default function ComboboxAsync() {
  const cb = useCombobox({
    loadOptions: loadPackages,
    presentation: 'popover',
  });
  return (
    <>
      <Field.Group>
        <Label.Root {...cb.getLabelProps()}>Package</Label.Root>
        <Field.Root {...cb.getAnchorProps()}>
          <Field.TextInput {...cb.getInputProps()} placeholder="Type to load" />
          <Field.Icon>
            <ChevronDown />
          </Field.Icon>
        </Field.Root>
      </Field.Group>
      <Popover.Root {...cb.getPopoverProps()}>
        {/* One status element for loading and errors; only its text changes. */}
        <Text.Root role="status">{cb.loading ? 'Loading…' : cb.error ? 'Couldn’t load options.' : ''}</Text.Root>
        {cb.error && !cb.loading ? (
          <Button.Root variant="ghost" onClick={cb.retry}>
            Retry
          </Button.Root>
        ) : null}
        {/* Keep the listbox mounted: the input's aria-controls points at it. */}
        <OptionList.Root {...cb.getListboxProps()} hidden={cb.loading || cb.error != null}>
          {optionNodes(cb.items, cb.getOptionProps)}
        </OptionList.Root>
      </Popover.Root>
    </>
  );
}
