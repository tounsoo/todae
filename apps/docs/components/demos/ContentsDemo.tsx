'use client';

import { Contents, ScrollArea, Stack, Text } from '@tounsoo/todae';

const SECTIONS = [
  { id: 'demo-install', title: 'Install', text: 'Add the package and its stylesheet, then wrap the app in its providers.' },
  { id: 'demo-tokens', title: 'Tokens', text: 'Build your token package on top of the base set, and keep your overrides in your own layer.' },
  { id: 'demo-colors', title: 'Colors', text: 'Point the appearance tokens at your palette. Every component follows.', sub: true },
  { id: 'demo-spacing', title: 'Spacing', text: 'Density tokens set the gaps, so a compact screen needs no new CSS.', sub: true },
  { id: 'demo-ship', title: 'Ship', text: 'Publish the package with a changeset.' },
] as const;

/** A guide that scrolls in its own box, with its sections listed beside it. The last section is short, so only a click marks it. */
export function ContentsGuide() {
  return (
    <Stack.Root direction="row" gap="spacious" style={{ inlineSize: '100%', maxInlineSize: '40rem' }}>
      <Contents.Root label="On this page" style={{ flex: '0 0 9rem' }}>
        {SECTIONS.filter((section) => !('sub' in section)).map((section) => (
          <Contents.Item key={section.id}>
            <Contents.Link href={`#${section.id}`}>{section.title}</Contents.Link>
            {section.id === 'demo-tokens' ? (
              <Contents.List>
                {SECTIONS.filter((sub) => 'sub' in sub).map((sub) => (
                  <Contents.Item key={sub.id}>
                    <Contents.Link href={`#${sub.id}`}>{sub.title}</Contents.Link>
                  </Contents.Item>
                ))}
              </Contents.List>
            ) : null}
          </Contents.Item>
        ))}
      </Contents.Root>
      <ScrollArea.Root aria-label="Guide" style={{ flex: '1 1 0', minInlineSize: 0, blockSize: '14rem' }}>
        <Stack.Root gap="spacious">
          {SECTIONS.map((section, index) => (
            <Stack.Root key={section.id} gap="condensed" style={{ minBlockSize: index < SECTIONS.length - 1 ? '12rem' : undefined }}>
              <Text.Root as={'sub' in section ? 'h4' : 'h3'} id={section.id}>
                {section.title}
              </Text.Root>
              <Text.Root as="p">{section.text}</Text.Root>
            </Stack.Root>
          ))}
        </Stack.Root>
      </ScrollArea.Root>
    </Stack.Root>
  );
}
