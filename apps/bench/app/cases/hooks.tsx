/**
 * Public hooks that apps call on their own, without a todae component that
 * wraps them. Each case wires its hook to plain HTML where the hook allows, so
 * the numbers are the hook's own cost, and its id starts with `use-`. A hook
 * that only reaches apps through one component points at that component's
 * cases with `via`.
 */
import {
  Field,
  OptionList,
  Popover,
  useCombobox,
  useHighlight,
  useHotkey,
  useInlineEdit,
  useRovingFocus,
  type ComboboxOption,
} from '@tounsoo/todae';
import { useState } from 'react';
import { click, first, many, type CoverageGroup, type ItemProps } from './types.tsx';

const PLANS: ComboboxOption[] = [
  { value: 'free', label: 'Free' },
  { value: 'team', label: 'Team' },
  { value: 'business', label: 'Business' },
  { value: 'enterprise', label: 'Enterprise' },
];

/** A closed single-select combobox with Field, Popover and OptionList, and a plain label. */
function ComboboxItem({ index, tick }: ItemProps) {
  const cb = useCombobox({ options: PLANS, presentation: 'popover' });
  return (
    <div>
      <label {...cb.getLabelProps()}>
        Plan {index} {tick}
      </label>
      <Field.Root {...cb.getAnchorProps()}>
        <Field.TextInput {...cb.getInputProps()} />
      </Field.Root>
      <Popover.Root {...cb.getPopoverProps()}>
        <OptionList.Root {...cb.getListboxProps()}>
          {cb.items.map((item) => (
            <OptionList.Option key={item.id} {...cb.getOptionProps(item)} />
          ))}
        </OptionList.Root>
      </Popover.Root>
    </div>
  );
}

/** A three-button toolbar of plain buttons. */
function RovingFocusItem({ index, tick }: ItemProps) {
  const roving = useRovingFocus({ orientation: 'horizontal' });
  return (
    <div role="toolbar" aria-label={`Format ${index}`} {...roving.getContainerProps()}>
      <button type="button" data-bench-trigger {...roving.getItemProps('bold')}>
        Bold {tick}
      </button>
      <button type="button" {...roving.getItemProps('italic')}>
        Italic
      </button>
      <button type="button" {...roving.getItemProps('underline')}>
        Underline
      </button>
    </div>
  );
}

const noop = () => {};

/** A plain button with its own keyboard shortcut. */
function HotkeyItem({ index, tick }: ItemProps) {
  const keys = ['Control+K', 'Meta+K'];
  useHotkey(keys, noop);
  return (
    <button type="button" aria-keyshortcuts={keys.join(' ')}>
      Search {index} {tick}
    </button>
  );
}

/** A paragraph that highlights a search term, under its own highlight name as the docs ask. */
function HighlightItem({ index, tick }: ItemProps) {
  const found = useHighlight({ name: `bench-search-${index}`, query: 'invoice' });
  return (
    <p ref={found.ref} data-matches={found.matches.length}>
      Invoice {index} for the order of a customer, version {tick}
    </p>
  );
}

/** A name with a Rename button that opens a plain input in place. */
function InlineEditItem({ index, tick }: ItemProps) {
  const [name, setName] = useState(`Report ${index}`);
  const edit = useInlineEdit({ value: name, onCommit: setName });
  if (edit.editing) {
    return (
      <div {...edit.getGroupProps()}>
        <input aria-label="Name" {...edit.getInputProps()} />
        <button type="button" onClick={edit.commit}>
          Save
        </button>
      </div>
    );
  }
  return (
    <div>
      <span>
        {name} {tick}
      </span>
      <button type="button" data-bench-trigger {...edit.getTriggerProps()}>
        Rename
      </button>
    </div>
  );
}

export const HOOKS = {
  useCombobox: [
    {
      id: 'use-combobox',
      title: 'useCombobox, closed, with Field, Popover and OptionList',
      Case: many(ComboboxItem),
      // Focus opens the list.
      interact: (container) => first<HTMLInputElement>(container, 'input').focus(),
    },
  ],
  useRovingFocus: [
    {
      id: 'use-roving-focus',
      title: 'useRovingFocus on a toolbar of three plain buttons',
      Case: many(RovingFocusItem),
      interact: (container) => {
        const item = first<HTMLElement>(container, '[data-bench-trigger]');
        item.focus();
        item.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }));
      },
    },
  ],
  useHotkey: [
    {
      id: 'use-hotkey',
      title: 'useHotkey on a plain button',
      Case: many(HotkeyItem),
      // A key no hotkey matches, as when someone types on the page: every copy's listener checks it.
      interact: () => {
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true }));
      },
    },
  ],
  useHighlight: [
    {
      id: 'use-highlight',
      title: 'useHighlight on a paragraph',
      Case: many(HighlightItem),
    },
  ],
  useInlineEdit: [
    {
      id: 'use-inline-edit',
      title: 'useInlineEdit on a name with a Rename button',
      Case: many(InlineEditItem),
      interact: click('[data-bench-trigger]'),
    },
  ],
  usePopover: { via: 'Popover' },
  useTooltip: { via: 'Tooltip' },
} satisfies CoverageGroup;
