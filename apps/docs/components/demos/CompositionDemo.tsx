'use client';

import { Button, Field, Option, OptionList, Popover, usePopover } from '@tounsoo/todae';
import { useState } from 'react';

export function FieldPartsAllowed() {
  const [value, setValue] = useState('12');
  return (
    <Field.Root>
      <Field.Icon>
        <span>⌕</span>
      </Field.Icon>
      <Field.TextInput value={value} onChange={(event) => setValue(event.target.value)} />
      <Field.Affix>USD</Field.Affix>
    </Field.Root>
  );
}

export function SiblingsAllowed() {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [sort, setSort] = useState<string | null>(null);
  const popover = usePopover({ open, onOpenChange: setOpen });
  return (
    <>
      <Field.Root>
        <Field.TextInput
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter"
        />
      </Field.Root>
      <Button.Root tooltip={false} {...popover.getTriggerProps()}>
        {sort ?? 'Sort'}
      </Button.Root>
      <Popover {...popover.getPopoverProps()} aria-label="Sort">
        <OptionList
          value={sort}
          onChange={(next) => {
            setSort(next);
            setOpen(false);
          }}
        >
          <Option value="name">Name</Option>
          <Option value="recent">Recent</Option>
        </OptionList>
      </Popover>
    </>
  );
}
