'use client';

import { Text } from '@tounsoo/todae/text';

export default function TextLabel() {
  return (
    <hgroup>
      <Text.Root variant="label">Release notes</Text.Root>
      <Text.Root as="h2">
        What changed in 0.4
      </Text.Root>
    </hgroup>
  );
}
