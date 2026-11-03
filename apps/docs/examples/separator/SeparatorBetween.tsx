'use client';

import { Separator } from '@tounsoo/todae/separator';
import { Text } from '@tounsoo/todae/text';

export default function SeparatorBetween() {
  return (
    <div>
      <Text.Root>Account settings apply to every workspace.</Text.Root>
      <Separator.Root />
      <Text.Root>Workspace settings apply to this workspace only.</Text.Root>
    </div>
  );
}
