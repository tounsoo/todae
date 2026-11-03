'use client';

import { ScrollArea, Text } from '@tounsoo/todae';

export default function ScrollAreaText() {
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
