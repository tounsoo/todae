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

const CITIES: ComboboxOption[] = [
  { value: 'sf', label: 'San Francisco' },
  { value: 'sj', label: 'San Jose' },
  { value: 'sc', label: 'Santa Clara' },
];

function optionNodes(
  items: ReturnType<typeof useCombobox>['items'],
  getOptionProps: ReturnType<typeof useCombobox>['getOptionProps'],
) {
  return items.map((item) => <OptionList.Option key={item.id} {...getOptionProps(item)} />);
}

export default function ComboboxHighlight() {
  const cb = useCombobox({ options: CITIES, presentation: 'popover' });
  const found = useHighlight({ name: 'search', query: cb.query });
  return (
    <>
      <Field.Group>
        <Label.Root {...cb.getLabelProps()}>City</Label.Root>
        <Field.Root {...cb.getAnchorProps()}>
          <Field.TextInput {...cb.getInputProps()} placeholder="Try “san”" />
          <Field.Icon>
            <ChevronDown />
          </Field.Icon>
        </Field.Root>
      </Field.Group>
      <Popover.Root {...cb.getPopoverProps()}>
        <Text.Root role="status">{cb.isEmpty ? 'No matches' : ''}</Text.Root>
        <OptionList.Root ref={found.ref} {...cb.getListboxProps()} hidden={cb.isEmpty}>
          {optionNodes(cb.items, cb.getOptionProps)}
        </OptionList.Root>
      </Popover.Root>
    </>
  );
}
