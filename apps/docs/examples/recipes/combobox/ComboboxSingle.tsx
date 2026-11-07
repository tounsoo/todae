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

const FRAMEWORKS: ComboboxOption[] = [
  { value: 'react', label: 'React' },
  { value: 'redux', label: 'Redux' },
  { value: 'svelte', label: 'Svelte' },
];

function optionNodes(
  items: ReturnType<typeof useCombobox>['items'],
  getOptionProps: ReturnType<typeof useCombobox>['getOptionProps'],
) {
  return items.map((item) => <OptionList.Option key={item.id} {...getOptionProps(item)} />);
}

export default function ComboboxSingle() {
  const cb = useCombobox({
    options: FRAMEWORKS,
    presentation: 'popover',
    defaultValue: 'react',
  });
  const found = useHighlight({ name: 'combobox-match', query: cb.query });
  return (
    <>
      <Field.Group>
        <Label.Root {...cb.getLabelProps()}>Framework</Label.Root>
        <Field.Root {...cb.getAnchorProps()}>
          <Field.TextInput {...cb.getInputProps()} />
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
