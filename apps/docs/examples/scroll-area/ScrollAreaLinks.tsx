'use client';

import { Link, ScrollArea, Stack } from '@tounsoo/todae';

const SECTIONS = ['Overview', 'Install', 'Tokens', 'Themes', 'Density', 'Components', 'Hooks', 'Recipes', 'Testing', 'Releases'];

export default function ScrollAreaLinks() {
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
