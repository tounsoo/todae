'use client';

import { Link, ScrollArea, Stack } from '@tounsoo/todae';

const FONTS = ['Inter', 'IBM Plex Sans', 'Source Serif', 'Lora', 'Noto Sans KR', 'Pretendard', 'Fira Code', 'JetBrains Mono', 'Atkinson Hyperlegible', 'Merriweather', 'Work Sans', 'Space Grotesk'];

export default function ScrollAreaArrows() {
  return (
    <nav aria-label="Fonts" style={{ inlineSize: '14rem' }}>
      <ScrollArea.Root arrows style={{ blockSize: '9rem' }}>
        <Stack.Root as="ul" gap="condensed">
          {FONTS.map((font) => (
            <li key={font}>
              <Link.Root href={`#${font.toLowerCase().replaceAll(' ', '-')}`}>{font}</Link.Root>
            </li>
          ))}
        </Stack.Root>
      </ScrollArea.Root>
    </nav>
  );
}
