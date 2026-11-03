'use client';

import { Kbd } from '@tounsoo/todae/kbd';
import { Text } from '@tounsoo/todae/text';

export default function KbdShortcut() {
  return (
    <Text.Root>
      Press{' '}
      <Kbd.Root>
        <Kbd.Root>Ctrl</Kbd.Root>+<Kbd.Root>K</Kbd.Root>
      </Kbd.Root>{' '}
      to search, or <Kbd.Root>Esc</Kbd.Root> to close.
    </Text.Root>
  );
}
