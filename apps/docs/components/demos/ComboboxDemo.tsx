'use client';

import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
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
  type ComboboxOption,
} from '@tounsoo/todae';

const FRAMEWORKS: ComboboxOption[] = [
  { value: 'react', label: 'React' },
  { value: 'redux', label: 'Redux' },
  { value: 'svelte', label: 'Svelte' },
];

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

export function ComboboxAuto() {
  const cb = useCombobox({
    options: FRAMEWORKS,
    presentation: 'auto',
  });
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
              <OptionList.Root {...cb.getListboxProps()}>
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
            <OptionList.Root {...cb.getListboxProps()}>
              {optionNodes(cb.items, cb.getOptionProps)}
            </OptionList.Root>
          </Popover.Root>
        </>
      )}
    </Stack.Root>
  );
}

export function ComboboxEmpty() {
  const cb = useCombobox({
    options: PACKAGES,
    presentation: 'popover',
  });
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
        <OptionList.Root {...cb.getListboxProps()} hidden={cb.isEmpty}>
          {optionNodes(cb.items, cb.getOptionProps)}
        </OptionList.Root>
      </Popover.Root>
    </>
  );
}

function appendCreated(current: readonly ComboboxOption[], label: string): ComboboxOption[] {
  if (current.some((item) => item.label.toLowerCase() === label.toLowerCase())) return [...current];
  return [...current, { value: label, label }];
}

function savePackage(label: string): Promise<string> {
  return new Promise((resolve, reject) => {
    window.setTimeout(() => {
      if (label.includes('fail')) reject(new Error('Couldn’t create the package'));
      else resolve(label);
    }, 400);
  });
}

export function ComboboxCreate() {
  const [options, setOptions] = useState(PACKAGES);
  const cb = useCombobox({
    options,
    allowCreate: true,
    presentation: 'popover',
    createLabel: (query) => `+ Create "${query}"`,
    onCreate: async (label) => {
      const saved = await savePackage(label);
      setOptions((current) => appendCreated(current, saved));
      return saved;
    },
  });
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
        <OptionList.Root {...cb.getListboxProps()}>
          {optionNodes(cb.items, cb.getOptionProps)}
        </OptionList.Root>
        {/* Under the create row; a load error would go in its own status. */}
        <Text.Root role="status">
          {cb.creating ? 'Creating…' : cb.createError ? 'Couldn’t create that package.' : ''}
        </Text.Root>
      </Popover.Root>
    </>
  );
}

export function ComboboxCreateMulti() {
  const [options, setOptions] = useState(PACKAGES);
  const cb = useCombobox({
    selectionMode: 'multiple',
    options,
    allowCreate: true,
    presentation: 'popover',
    createLabel: (query) => `+ Create "${query}"`,
    onCreate: (label) => {
      setOptions((current) => appendCreated(current, label));
      return label;
    },
  });
  return (
    <>
      <Field.Group>
        <Label.Root {...cb.getLabelProps()}>Tags</Label.Root>
        <Field.Root {...cb.getAnchorProps()}>
          <Field.ChipInput {...cb.getChipInputProps()} />
          <Field.Icon>
            <ChevronDown />
          </Field.Icon>
        </Field.Root>
      </Field.Group>
      <Popover.Root {...cb.getPopoverProps()}>
        <OptionList.Root {...cb.getListboxProps()}>
          {optionNodes(cb.items, cb.getOptionProps)}
        </OptionList.Root>
      </Popover.Root>
    </>
  );
}
