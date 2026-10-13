'use client';

import { ChevronDown, Search } from 'lucide-react';
import { useId, useState } from 'react';
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
  useSheetPresentation,
  type ComboboxOption,
} from '@omsoo.design/todae';

const FRAMEWORKS: ComboboxOption[] = [
  { value: 'react', label: 'React' },
  { value: 'redux', label: 'Redux' },
  { value: 'svelte', label: 'Svelte' },
];

const TYPES: ComboboxOption[] = [
  { value: 'design', label: 'design' },
  { value: 'tokens', label: 'tokens' },
];

const CITIES: ComboboxOption[] = [
  { value: 'sf', label: 'San Francisco' },
  { value: 'sj', label: 'San Jose' },
  { value: 'sc', label: 'Santa Clara' },
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

export function ComboboxSingle() {
  const cb = useCombobox({
    options: FRAMEWORKS,
    presentation: 'popover',
    defaultValue: 'react',
  });
  return (
    <>
      <Field.Group>
        <Label.Root htmlFor={cb.ids.input}>Framework</Label.Root>
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
      </Popover.Root>
    </>
  );
}

export function ComboboxHighlight() {
  const cb = useCombobox({ options: CITIES, presentation: 'popover' });
  const found = useHighlight({ name: 'docs-combobox-match', query: cb.query });
  return (
    <>
      <Field.Group>
        <Label.Root htmlFor={cb.ids.input}>City</Label.Root>
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

export function ComboboxMulti() {
  const cb = useCombobox({
    selectionMode: 'multiple',
    options: TYPES,
    presentation: 'popover',
    defaultValue: ['design'],
  });
  return (
    <>
      <Field.Group>
        <Label.Root htmlFor={cb.ids.input}>Type</Label.Root>
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

export function ComboboxSheet() {
  const cb = useCombobox({
    options: CITIES,
    presentation: 'sheet',
    defaultValue: 'sf',
  });
  const labelId = useId();
  const selected = CITIES.find((city) => city.value === cb.value)?.label ?? 'Choose';
  return (
    <>
      <Field.Group>
        <Label.Root id={labelId} htmlFor={cb.ids.trigger}>
          City
        </Label.Root>
        {/* Named by the label and its own text, so it reads "City, San Francisco". */}
        <Button.Root {...cb.getTriggerProps()} aria-labelledby={`${labelId} ${cb.ids.trigger}`} variant="secondary">
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
          <OptionList.Root {...cb.getListboxProps()}>
            {optionNodes(cb.items, cb.getOptionProps)}
          </OptionList.Root>
        </BottomSheet.Body>
      </BottomSheet.Root>
    </>
  );
}

export function ComboboxAuto() {
  const labelId = useId();
  const cb = useCombobox({
    options: FRAMEWORKS,
    presentation: 'auto',
  });
  return (
    <Stack.Root>
      <Text.Root size="s" tone="muted">
        presentation: {cb.presentation}
      </Text.Root>
      {cb.isSheet ? (
        <>
          <Field.Group>
            <Label.Root id={labelId} htmlFor={cb.ids.trigger}>
              Framework
            </Label.Root>
            <Button.Root {...cb.getTriggerProps()} aria-labelledby={`${labelId} ${cb.ids.trigger}`} variant="secondary">
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
            <Label.Root htmlFor={cb.ids.input}>Framework</Label.Root>
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

export function ComboboxAsync() {
  const cb = useCombobox({
    loadOptions: loadPackages,
    presentation: 'popover',
  });
  return (
    <>
      <Field.Group>
        <Label.Root htmlFor={cb.ids.input}>Package</Label.Root>
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

export function ComboboxEmpty() {
  const cb = useCombobox({
    options: PACKAGES,
    presentation: 'popover',
  });
  return (
    <>
      <Field.Group>
        <Label.Root htmlFor={cb.ids.input}>Package</Label.Root>
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

export function ComboboxCreate() {
  const [options, setOptions] = useState(PACKAGES);
  const cb = useCombobox({
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
        <Label.Root htmlFor={cb.ids.input}>Package</Label.Root>
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
        <Label.Root htmlFor={cb.ids.input}>Tags</Label.Root>
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

export function PresentationBadge() {
  const sheet = useSheetPresentation();
  return (
    <Text.Root size="s">
      {sheet.presentation} · isSheet={String(sheet.isSheet)}
    </Text.Root>
  );
}
