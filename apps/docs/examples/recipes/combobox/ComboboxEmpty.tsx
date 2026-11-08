'use client';

import { ChevronDown } from 'lucide-react';
import {
  Field,
  Label,
  OptionList,
  Popover,
  Text,
  useCombobox,
  useHighlight,
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

export default function ComboboxEmpty() {
  const cb = useCombobox({
    options: PACKAGES,
    presentation: 'popover',
  });
  const found = useHighlight({ name: 'combobox-match', query: cb.query });
  return (
    <>
      <Field.Group>
        <Label.Root {...cb.getLabelProps()}>Package</Label.Root>
        <Field.Root {...cb.getAnchorProps()}>
          <Field.TextInput {...cb.getInputProps()} />
          <Field.Icon>
            <ChevronDown />
          </Field.Icon>
        </Field.Root>
      </Field.Group>
      <Popover.Root {...cb.getPopoverProps()}>
        <Text.Root role="status">{cb.isEmpty ? 'No matches' : ''}</Text.Root>
        {/* Keep the listbox mounted: the input's aria-controls points at it. */}
        <OptionList.Root ref={found.ref} {...cb.getListboxProps()} hidden={cb.isEmpty}>
          {optionNodes(cb.items, cb.getOptionProps)}
        </OptionList.Root>
      </Popover.Root>
    </>
  );
}
