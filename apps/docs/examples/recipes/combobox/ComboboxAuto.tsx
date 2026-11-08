'use client';

import {
  BottomSheet,
  Button,
  Field,
  Label,
  OptionList,
  Popover,
  Stack,
  Text,
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

export default function ComboboxAuto() {
  const cb = useCombobox({
    options: FRAMEWORKS,
    presentation: 'auto',
  });
  const found = useHighlight({ name: 'combobox-match', query: cb.query });
  return (
    <Stack.Root>
      <Text.Root tone="muted">
        presentation: {cb.presentation}
      </Text.Root>
      {cb.isSheet ? (
        <>
          <Field.Group>
            <Label.Root {...cb.getLabelProps()}>
              Framework
            </Label.Root>
            <Button.Root {...cb.getTriggerProps()} variant="secondary">
              {FRAMEWORKS.find((item) => item.value === cb.value)?.label ?? 'Choose'}
            </Button.Root>
          </Field.Group>
          <BottomSheet.Root {...cb.getSheetProps()}>
            <BottomSheet.Body>
              <Field.Root id={cb.ids.input} aria-label="Framework">
                <Field.TextInput {...cb.getInputProps()} />
              </Field.Root>
              <OptionList.Root ref={found.ref} {...cb.getListboxProps()}>
                {optionNodes(cb.items, cb.getOptionProps)}
              </OptionList.Root>
            </BottomSheet.Body>
          </BottomSheet.Root>
        </>
      ) : (
        <>
          <Field.Group>
            <Label.Root {...cb.getLabelProps()}>Framework</Label.Root>
            <Field.Root {...cb.getAnchorProps()}>
              <Field.TextInput {...cb.getInputProps()} />
            </Field.Root>
          </Field.Group>
          <Popover.Root {...cb.getPopoverProps()}>
            <OptionList.Root ref={found.ref} {...cb.getListboxProps()}>
              {optionNodes(cb.items, cb.getOptionProps)}
            </OptionList.Root>
          </Popover.Root>
        </>
      )}
    </Stack.Root>
  );
}
