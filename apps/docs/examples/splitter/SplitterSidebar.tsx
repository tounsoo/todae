'use client';

import { Button, Link, Splitter, Stack, Text } from '@tounsoo/todae';
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

export default function SplitterSidebar() {
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
          <Text.Root as="h2" id={navId}>
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
            <Text.Root as="h2">
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
