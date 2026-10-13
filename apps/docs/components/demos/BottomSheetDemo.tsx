'use client';

import { BottomSheet, Button, Field } from '@omsoo.design/todae';
import { useRef, useState } from 'react';

const OPTIONS = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];

export function BottomSheetBasic() {
  const [open, setOpen] = useState(false);
  const [snap, setSnap] = useState<'mid' | 'full'>('mid');
  return (
    <>
      <Button.Root onClick={() => setOpen(true)}>Open sheet</Button.Root>
      <BottomSheet.Root open={open} onOpenChange={setOpen} snap={snap} onSnapChange={setSnap}>
        <BottomSheet.Header>
          <BottomSheet.Title>Share</BottomSheet.Title>
          <BottomSheet.Close>Close</BottomSheet.Close>
        </BottomSheet.Header>
        <BottomSheet.Description>Drag the grabber. Mid and full snap.</BottomSheet.Description>
        <BottomSheet.Body>
          <ul aria-label="Share to">
            {OPTIONS.map((item) => (
              <li key={item}>
                <button type="button" onClick={() => setOpen(false)}>
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </BottomSheet.Body>
        <BottomSheet.Footer>
          <Button.Root variant="secondary" onClick={() => setOpen(false)}>
            Cancel
          </Button.Root>
        </BottomSheet.Footer>
      </BottomSheet.Root>
    </>
  );
}

export function ComboboxTouchSketch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [value, setValue] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const matches = OPTIONS.filter((item) => item.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <Button.Root onClick={() => setOpen(true)}>{value ?? 'Choose option'}</Button.Root>
      <BottomSheet.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery('');
        }}
        initialFocusRef={searchRef}
      >
        <BottomSheet.Header>
          <BottomSheet.Title>Search options</BottomSheet.Title>
          <Field.Root aria-label="Filter options">
            <Field.TextInput
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter"
              type="search"
            />
          </Field.Root>
        </BottomSheet.Header>
        <BottomSheet.Body>
          <ul aria-label="Options">
            {matches.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => {
                    setValue(item);
                    setOpen(false);
                    setQuery('');
                  }}
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </BottomSheet.Body>
      </BottomSheet.Root>
    </>
  );
}
