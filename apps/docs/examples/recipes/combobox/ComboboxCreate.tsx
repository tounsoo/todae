'use client';

import { ChevronDown } from 'lucide-react';
import { useLayoutEffect, useState } from 'react';
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

/** The create row's words. The typed text sits between its quotes. */
const createLabel = (query: string) => `+ Create "${query}"`;

/**
 * The options, then the create row. Matches are marked in the options only, and
 * in the create row only the text it was typed for, so its own word "Create" is
 * never marked. Both hooks share the name, so they paint as one.
 */
function MarkedOptions({ cb }: { cb: ReturnType<typeof useCombobox> }) {
  const found = useHighlight({ name: 'combobox-match', query: cb.query });
  const create = cb.items.find((item) => item.kind === 'create');
  const asked = create?.kind === 'create' ? create.value : '';
  const [row, setRow] = useState<HTMLElement | null>(null);
  const [typed, setTyped] = useState<readonly Range[]>([]);
  useLayoutEffect(() => {
    // OptionList.Option renders its label last, as a bare text node; the browser test
    // fails if that changes. (`Text` here is todae's component, so check the node type.)
    // Mark only what is between the label's quotes.
    const last = row?.lastChild;
    const text = last?.nodeType === Node.TEXT_NODE ? (last as CharacterData) : null;
    const at = text && asked !== '' ? text.data.indexOf(`"${asked}"`) : -1;
    if (!text || at < 0) {
      setTyped([]);
      return;
    }
    const range = document.createRange();
    range.setStart(text, at + 1);
    range.setEnd(text, at + 1 + asked.length);
    setTyped([range]);
  }, [row, asked]);
  useHighlight({ name: 'combobox-match', ranges: typed });
  return (
    <>
      <div ref={found.ref} role="none" style={{ display: 'contents' }}>
        {optionNodes(
          cb.items.filter((item) => item.kind !== 'create'),
          cb.getOptionProps,
        )}
      </div>
      {create ? <OptionList.Option {...cb.getOptionProps(create)} ref={setRow} /> : null}
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

export default function ComboboxCreate() {
  const [options, setOptions] = useState(PACKAGES);
  const cb = useCombobox({
    options,
    allowCreate: true,
    presentation: 'popover',
    createLabel,
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
          <MarkedOptions cb={cb} />
        </OptionList.Root>
        {/* Under the create row; a load error would go in its own status. */}
        <Text.Root role="status">
          {cb.creating ? 'Creating…' : cb.createError ? 'Couldn’t create that package.' : ''}
        </Text.Root>
      </Popover.Root>
    </>
  );
}
