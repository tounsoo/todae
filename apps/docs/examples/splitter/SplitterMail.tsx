'use client';

import { Button, ScrollArea, Splitter, Stack, Text } from '@tounsoo/todae';
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

export default function SplitterMail() {
  const mailboxesId = useId();
  const inboxId = useId();
  const [selected, setSelected] = useState(0);
  const [from, subject] = MESSAGES[selected] ?? MESSAGES[0] ?? ['', ''];

  return (
    <Splitter.Root defaultValue={160} min={120} max={240} collapsible style={frame('18rem')}>
      <Splitter.Panel>
        <Pane>
          <Text.Root as="h2" id={mailboxesId}>
            Mailboxes
          </Text.Root>
          <Stack.Root as="ul" gap="condensed">
            {['Inbox', 'Sent', 'Archive'].map((name) => (
              <li key={name}>
                <Text.Root>{name}</Text.Root>
              </li>
            ))}
          </Stack.Root>
        </Pane>
      </Splitter.Panel>
      <Splitter.Handle aria-labelledby={mailboxesId} />
      <Splitter.Panel>
        <Splitter.Root defaultValue={190} min={150} max={320} style={{ blockSize: '100%' }}>
          <Splitter.Panel>
            <ScrollArea.Root style={{ blockSize: '100%' }}>
              <Pane>
                <Text.Root as="h2" id={inboxId}>
                  Inbox
                </Text.Root>
                <Stack.Root as="ul" gap="condensed">
                  {MESSAGES.map(([, title], index) => (
                    <li key={title}>
                      <Button.Root
                        variant="ghost"
                        aria-current={selected === index ? 'true' : undefined}
                        onClick={() => setSelected(index)}
                      >
                        {title}
                      </Button.Root>
                    </li>
                  ))}
                </Stack.Root>
              </Pane>
            </ScrollArea.Root>
          </Splitter.Panel>
          <Splitter.Handle aria-labelledby={inboxId} />
          <Splitter.Panel>
            <ScrollArea.Root style={{ blockSize: '100%' }}>
              <Pane>
                <Text.Root as="h2">
                  {subject}
                </Text.Root>
                <Text.Root tone="muted">From {from}</Text.Root>
                <Text.Root>
                  Each pane is a splitter inside another: the mailboxes split from the rest, and the list splits from
                  the message.
                </Text.Root>
              </Pane>
            </ScrollArea.Root>
          </Splitter.Panel>
        </Splitter.Root>
      </Splitter.Panel>
    </Splitter.Root>
  );
}
