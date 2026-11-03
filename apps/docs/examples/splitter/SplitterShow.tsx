'use client';

import { Code, Splitter, Stack, Text, ToggleGroup } from '@tounsoo/todae';
import { useId, useState, type CSSProperties, type ReactNode } from 'react';

// The product gives a splitter its block size. These frames add a border for the page.
const frame = (blockSize: string): CSSProperties => ({
  blockSize,
  border: '1px solid var(--todae-color-border-subtle)',
  borderRadius: 'var(--todae-radius-md)',
});

function Pane({ children }: { children: ReactNode }) {
  return <Stack.Root style={{ padding: 'var(--todae-space-4)' }}>{children}</Stack.Root>;
}

const MESSAGES = [
  ['Ana Ruiz', 'Launch checklist'],
  ['Ben Okafor', 'Token review'],
  ['Chen Wei', 'Lunch on Friday?'],
  ['Dara Singh', 'Invoice 2041'],
];

type Show = 'both' | 'start' | 'end';

export default function SplitterShow() {
  const listId = useId();
  const [show, setShow] = useState<Show>('both');

  return (
    <Stack.Root>
      <ToggleGroup.Root
        aria-label="Show"
        value={show}
        onValueChange={(next) => {
          if (next) setShow(next as Show);
        }}
      >
        <ToggleGroup.Item value="both">both</ToggleGroup.Item>
        <ToggleGroup.Item value="start">start</ToggleGroup.Item>
        <ToggleGroup.Item value="end">end</ToggleGroup.Item>
      </ToggleGroup.Root>
      <Splitter.Root show={show} defaultValue={200} min={140} max={320} style={frame('14rem')}>
        <Splitter.Panel>
          <Pane>
            <Text.Root as="h2" id={listId}>
              Inbox
            </Text.Root>
            <Stack.Root as="ul" gap="condensed">
              {MESSAGES.map(([name, title]) => (
                <li key={title}>
                  <Text.Root>{name}</Text.Root>
                </li>
              ))}
            </Stack.Root>
          </Pane>
        </Splitter.Panel>
        <Splitter.Handle aria-labelledby={listId} />
        <Splitter.Panel>
          <Pane>
            <Text.Root as="h2">
              Launch checklist
            </Text.Root>
            <Text.Root tone="muted">
              <Code.Root>show=&quot;{show}&quot;</Code.Root>.{' '}
              {show === 'both'
                ? 'Both panels and the handle show.'
                : `Only the ${show} panel shows, across the whole splitter. The other panel and the handle stay mounted, out of the layout.`}
            </Text.Root>
          </Pane>
        </Splitter.Panel>
      </Splitter.Root>
    </Stack.Root>
  );
}
