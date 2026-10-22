'use client';

import { Button, Code, Link, ScrollArea, Splitter, Stack, Text, ToggleGroup } from '@tounsoo/todae';
import { PanelLeft } from 'lucide-react';
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

const PROJECTS = ['Atlas', 'Beacon', 'Cedar', 'Delta'];

export function SplitterSidebar() {
  const navId = useId();
  const sidebarId = useId();
  const [width, setWidth] = useState(220);
  // Enter restores the size before a collapse; this button keeps its own, from every width above 0.
  const [lastWidth, setLastWidth] = useState(220);
  const resize = (next: number) => {
    if (next > 0) setLastWidth(next);
    setWidth(next);
  };
  const toggle = () => setWidth(width === 0 ? lastWidth : 0);

  return (
    <Splitter.Root value={width} onValueChange={resize} min={160} max={360} collapsible style={frame('16rem')}>
      <Splitter.Panel id={sidebarId}>
        <Pane>
          <Text.Root as="h2" size="m" id={navId}>
            Projects
          </Text.Root>
          <Stack.Root as="ul" gap="condensed">
            {PROJECTS.map((name) => (
              <li key={name}>
                <Link.Root href={`#${name.toLowerCase()}`}>{name}</Link.Root>
              </li>
            ))}
          </Stack.Root>
        </Pane>
      </Splitter.Panel>
      <Splitter.Handle aria-labelledby={navId} />
      <Splitter.Panel>
        <Pane>
          <Stack.Root direction="row" align="center">
            <Button.Root
              variant="ghost"
              aria-label="Sidebar"
              aria-controls={sidebarId}
              aria-expanded={width > 0}
              onClick={toggle}
            >
              <Button.Icon>
                <PanelLeft />
              </Button.Icon>
            </Button.Root>
            <Text.Root as="h2" size="m">
              Atlas
            </Text.Root>
          </Stack.Root>
          <Text.Root tone="muted">
            The sidebar is {width}px wide. Drag the handle, or focus it and use the arrow keys. Enter collapses the
            sidebar and restores it.
          </Text.Root>
        </Pane>
      </Splitter.Panel>
    </Splitter.Root>
  );
}

const ROWS = ['id  name', '1   Atlas', '2   Beacon', '3   Cedar', '4   Delta', '5   Ember', '6   Fjord'];

export function SplitterEditor() {
  const editorId = useId();

  return (
    <Splitter.Root orientation="vertical" defaultValue={120} min={80} max={240} style={frame('18rem')}>
      <Splitter.Panel>
        <Pane>
          <Text.Root as="h2" size="m" id={editorId}>
            Query
          </Text.Root>
          <Code.Root>select id, name from projects order by id;</Code.Root>
        </Pane>
      </Splitter.Panel>
      <Splitter.Handle aria-labelledby={editorId} />
      <Splitter.Panel>
        <ScrollArea.Root style={{ blockSize: '100%' }}>
          <Pane>
            <Text.Root as="h2" size="m">
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

const MESSAGES = [
  ['Ana Ruiz', 'Launch checklist'],
  ['Ben Okafor', 'Token review'],
  ['Chen Wei', 'Lunch on Friday?'],
  ['Dara Singh', 'Invoice 2041'],
];

export function SplitterMail() {
  const mailboxesId = useId();
  const inboxId = useId();
  const [selected, setSelected] = useState(0);
  const [from, subject] = MESSAGES[selected] ?? MESSAGES[0] ?? ['', ''];

  return (
    <Splitter.Root defaultValue={160} min={120} max={240} collapsible style={frame('18rem')}>
      <Splitter.Panel>
        <Pane>
          <Text.Root as="h2" size="m" id={mailboxesId}>
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
                <Text.Root as="h2" size="m" id={inboxId}>
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
                <Text.Root as="h2" size="m">
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

type Show = 'both' | 'start' | 'end';

export function SplitterShow() {
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
            <Text.Root as="h2" size="m" id={listId}>
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
            <Text.Root as="h2" size="m">
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
