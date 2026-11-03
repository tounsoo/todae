'use client';

import { Code, ScrollArea, Splitter, Stack, Text } from '@tounsoo/todae';
import { useId, type CSSProperties, type ReactNode } from 'react';

// The product gives a splitter its block size. These frames add a border for the page.
const frame = (blockSize: string): CSSProperties => ({
  blockSize,
  border: '1px solid var(--todae-color-border-subtle)',
  borderRadius: 'var(--todae-radius-md)',
});

function Pane({ children }: { children: ReactNode }) {
  return <Stack.Root style={{ padding: 'var(--todae-space-4)' }}>{children}</Stack.Root>;
}

const ROWS = ['id  name', '1   Atlas', '2   Beacon', '3   Cedar', '4   Delta', '5   Ember', '6   Fjord'];

export default function SplitterEditor() {
  const editorId = useId();

  return (
    <Splitter.Root orientation="vertical" defaultValue={120} min={80} max={240} style={frame('18rem')}>
      <Splitter.Panel>
        <Pane>
          <Text.Root as="h2" id={editorId}>
            Query
          </Text.Root>
          <Code.Root>select id, name from projects order by id;</Code.Root>
        </Pane>
      </Splitter.Panel>
      <Splitter.Handle aria-labelledby={editorId} />
      <Splitter.Panel>
        <ScrollArea.Root style={{ blockSize: '100%' }}>
          <Pane>
            <Text.Root as="h2">
              Results
            </Text.Root>
            <Stack.Root as="ul" gap="none">
              {ROWS.map((row) => (
                <li key={row}>
                  <Code.Root>{row}</Code.Root>
                </li>
              ))}
            </Stack.Root>
          </Pane>
        </ScrollArea.Root>
      </Splitter.Panel>
    </Splitter.Root>
  );
}
