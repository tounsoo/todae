'use client';

import { useState } from 'react';
import { BottomSheet, Button, Field, Label, OptionList, Popover, Text, useCombobox, useSheetPresentation, type ComboboxOption } from '@tounsoo/todae';

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

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function Search() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

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
    <div className="labelled-field">
      <Label htmlFor={cb.ids.input}>Framework</Label>
      <Field.Root {...cb.getAnchorProps()}>
        <Field.TextInput {...cb.getInputProps()} />
        <Field.Icon>
          <Chevron />
        </Field.Icon>
      </Field.Root>
      <Popover.Root {...cb.getPopoverProps()}>
        <OptionList.Root {...cb.getListboxProps()}>
          {optionNodes(cb.items, cb.getOptionProps)}
        </OptionList.Root>
      </Popover.Root>
    </div>
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
    <div className="labelled-field">
      <Label htmlFor={cb.ids.input}>Type</Label>
      <Field.Root {...cb.getAnchorProps()}>
        <Field.ChipInput {...cb.getChipInputProps()} />
        <Field.Icon>
          <Chevron />
        </Field.Icon>
      </Field.Root>
      <Popover.Root {...cb.getPopoverProps()}>
        <OptionList.Root {...cb.getListboxProps()}>
          {optionNodes(cb.items, cb.getOptionProps)}
        </OptionList.Root>
      </Popover.Root>
    </div>
  );
}

export function ComboboxSheet() {
  const cb = useCombobox({
    options: CITIES,
    presentation: 'sheet',
    defaultValue: 'sf',
  });
  const selected = CITIES.find((city) => city.value === cb.value)?.label ?? 'City';
  return (
    <div className="labelled-field">
      <Label htmlFor={cb.ids.trigger}>City</Label>
      <Button.Root {...cb.getTriggerProps()} variant="secondary">
        {selected}
        <Button.Icon>
          <Chevron />
        </Button.Icon>
      </Button.Root>
      <BottomSheet.Root {...cb.getSheetProps()}>
        <BottomSheet.Grabber />
        <BottomSheet.Body>
          <div className="labelled-field">
            <Label htmlFor={cb.ids.input}>Search</Label>
            <Field.Root>
              <Field.Icon>
                <Search />
              </Field.Icon>
              <Field.TextInput {...cb.getInputProps()} placeholder="Filter cities" />
            </Field.Root>
          </div>
          <OptionList.Root {...cb.getListboxProps()}>
            {optionNodes(cb.items, cb.getOptionProps)}
          </OptionList.Root>
        </BottomSheet.Body>
      </BottomSheet.Root>
    </div>
  );
}

export function ComboboxAuto() {
  const sheet = useSheetPresentation();
  const cb = useCombobox({
    options: FRAMEWORKS,
    presentation: 'auto',
  });
  return (
    <div className="labelled-field">
      <Text size="s" tone="muted">
        presentation: {sheet.presentation}
        {sheet.isSheet ? ' (sheet)' : ' (popover)'}
      </Text>
      {cb.isSheet ? (
        <>
          <Button.Root {...cb.getTriggerProps()} variant="secondary">
            {typeof cb.value === 'string' && cb.value
              ? FRAMEWORKS.find((item) => item.value === cb.value)?.label ?? 'Framework'
              : 'Framework'}
          </Button.Root>
          <BottomSheet.Root {...cb.getSheetProps()}>
            <BottomSheet.Body>
              <Field.Root aria-label="Framework">
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
          <Label htmlFor={cb.ids.input}>Framework</Label>
          <Field.Root {...cb.getAnchorProps()}>
            <Field.TextInput {...cb.getInputProps()} />
          </Field.Root>
          <Popover.Root {...cb.getPopoverProps()}>
            <OptionList.Root {...cb.getListboxProps()}>
              {optionNodes(cb.items, cb.getOptionProps)}
            </OptionList.Root>
          </Popover.Root>
        </>
      )}
    </div>
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
    <div className="labelled-field">
      <Label htmlFor={cb.ids.input}>Package</Label>
      <Field.Root {...cb.getAnchorProps()}>
        <Field.TextInput {...cb.getInputProps()} placeholder="Type to load" />
        <Field.Icon>
          <Chevron />
        </Field.Icon>
      </Field.Root>
      <Popover.Root {...cb.getPopoverProps()}>
        {cb.loading ? (
          <Text role="status" aria-live="polite">
            Loading…
          </Text>
        ) : cb.error ? (
          <div role="status" aria-live="polite">
            <Text as="span">Couldn’t load options.</Text>{' '}
            <Button.Root variant="ghost" onClick={cb.retry}>
              Retry
            </Button.Root>
          </div>
        ) : (
          <OptionList.Root {...cb.getListboxProps()}>
            {optionNodes(cb.items, cb.getOptionProps)}
          </OptionList.Root>
        )}
      </Popover.Root>
    </div>
  );
}

export function ComboboxEmpty() {
  const cb = useCombobox({
    options: PACKAGES,
    presentation: 'popover',
  });
  return (
    <div className="labelled-field">
      <Label htmlFor={cb.ids.input}>Package</Label>
      <Field.Root {...cb.getAnchorProps()}>
        <Field.TextInput {...cb.getInputProps()} />
        <Field.Icon>
          <Chevron />
        </Field.Icon>
      </Field.Root>
      <Popover.Root {...cb.getPopoverProps()}>
        {cb.isEmpty ? (
          <Text role="status">No matches</Text>
        ) : (
          <OptionList.Root {...cb.getListboxProps()}>
            {optionNodes(cb.items, cb.getOptionProps)}
          </OptionList.Root>
        )}
      </Popover.Root>
    </div>
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
    <div className="labelled-field">
      <Label htmlFor={cb.ids.input}>Package</Label>
      <Field.Root {...cb.getAnchorProps()}>
        <Field.TextInput {...cb.getInputProps()} />
        <Field.Icon>
          <Chevron />
        </Field.Icon>
      </Field.Root>
      <Popover.Root {...cb.getPopoverProps()}>
        <OptionList.Root {...cb.getListboxProps()}>
          {optionNodes(cb.items, cb.getOptionProps)}
        </OptionList.Root>
      </Popover.Root>
    </div>
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
    <div className="labelled-field">
      <Label htmlFor={cb.ids.input}>Tags</Label>
      <Field.Root {...cb.getAnchorProps()}>
        <Field.ChipInput {...cb.getChipInputProps()} />
        <Field.Icon>
          <Chevron />
        </Field.Icon>
      </Field.Root>
      <Popover.Root {...cb.getPopoverProps()}>
        <OptionList.Root {...cb.getListboxProps()}>
          {optionNodes(cb.items, cb.getOptionProps)}
        </OptionList.Root>
      </Popover.Root>
    </div>
  );
}

export function PresentationBadge() {
  const sheet = useSheetPresentation();
  return (
    <Text size="s">
      {sheet.presentation} · isSheet={String(sheet.isSheet)}
    </Text>
  );
}
