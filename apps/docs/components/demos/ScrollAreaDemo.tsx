'use client';

import { Link, ScrollArea, Stack, Text } from '@tounsoo/todae';

const SECTIONS = ['Overview', 'Install', 'Tokens', 'Themes', 'Density', 'Components', 'Hooks', 'Recipes', 'Testing', 'Releases'];

export function ScrollAreaLinks() {
  return (
    <nav aria-label="Guide sections" style={{ inlineSize: '14rem' }}>
      <ScrollArea.Root style={{ blockSize: '9rem' }}>
        <Stack.Root as="ul" gap="condensed">
          {SECTIONS.map((section) => (
            <li key={section}>
              <Link.Root href={`#${section.toLowerCase()}`}>{section}</Link.Root>
            </li>
          ))}
        </Stack.Root>
      </ScrollArea.Root>
    </nav>
  );
}

export function ScrollAreaText() {
  return (
    <ScrollArea.Root aria-label="Release notes" style={{ blockSize: '7rem', maxInlineSize: '28rem' }}>
      <Text.Root>
        Tokens now follow DTCG 2025.10 and alias with JSON Pointer. Density modes scale spacing and control heights
        together. Every overlay renders in place on a native dialog or popover, so it inherits the theme of the page
        around it. Focus rings draw from focus.ring.width and focus.ring.offset, and scroll containers leave room for
        them, so no ring is cut at an edge.
      </Text.Root>
    </ScrollArea.Root>
  );
}
