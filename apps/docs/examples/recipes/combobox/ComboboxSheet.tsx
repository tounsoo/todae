'use client';

import { ChevronDown, Search } from 'lucide-react';
import {
  BottomSheet,
  Button,
  Field,
  Label,
  OptionList,
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

export default function ComboboxSheet() {
  const cb = useCombobox({
    options: CITIES,
    presentation: 'sheet',
    defaultValue: 'sf',
  });
  const found = useHighlight({ name: 'combobox-match', query: cb.query });
  const selected = CITIES.find((city) => city.value === cb.value)?.label ?? 'Choose';
  return (
    <>
      <Field.Group>
        <Label.Root {...cb.getLabelProps()}>
          City
        </Label.Root>
        <Button.Root {...cb.getTriggerProps()} variant="secondary">
          {selected}
          <Button.Icon>
            <ChevronDown />
          </Button.Icon>
        </Button.Root>
      </Field.Group>
      <BottomSheet.Root {...cb.getSheetProps()}>
        <BottomSheet.Grabber />
        <BottomSheet.Body>
          <Field.Group>
            <Label.Root htmlFor={cb.ids.input}>Search</Label.Root>
            <Field.Root id={cb.ids.input}>
              <Field.Icon>
                <Search />
              </Field.Icon>
              <Field.TextInput {...cb.getInputProps()} placeholder="Filter cities" />
            </Field.Root>
          </Field.Group>
          <OptionList.Root ref={found.ref} {...cb.getListboxProps()}>
            {optionNodes(cb.items, cb.getOptionProps)}
          </OptionList.Root>
        </BottomSheet.Body>
      </BottomSheet.Root>
    </>
  );
}
