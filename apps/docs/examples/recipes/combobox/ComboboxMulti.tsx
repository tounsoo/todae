'use client';

import { ChevronDown } from 'lucide-react';
import {
  Field,
  Label,
  OptionList,
  Popover,
  useCombobox,
  useHighlight,
  type ComboboxOption,
} from '@tounsoo/todae';

const TYPES: ComboboxOption[] = [
  { value: 'design', label: 'design' },
  { value: 'tokens', label: 'tokens' },
];

function optionNodes(
  items: ReturnType<typeof useCombobox>['items'],
  getOptionProps: ReturnType<typeof useCombobox>['getOptionProps'],
) {
  return items.map((item) => <OptionList.Option key={item.id} {...getOptionProps(item)} />);
}

export default function ComboboxMulti() {
  const cb = useCombobox({
    selectionMode: 'multiple',
    options: TYPES,
    presentation: 'popover',
    defaultValue: ['design'],
  });
  const found = useHighlight({ name: 'combobox-match', query: cb.query });
  return (
    <>
      <Field.Group>
        <Label.Root {...cb.getLabelProps()}>Type</Label.Root>
        <Field.Root {...cb.getAnchorProps()}>
          <Field.ChipInput {...cb.getChipInputProps()} />
          <Field.Icon>
            <ChevronDown />
          </Field.Icon>
        </Field.Root>
      </Field.Group>
      <Popover.Root {...cb.getPopoverProps()}>
        <OptionList.Root ref={found.ref} {...cb.getListboxProps()}>
          {optionNodes(cb.items, cb.getOptionProps)}
        </OptionList.Root>
      </Popover.Root>
    </>
  );
}
