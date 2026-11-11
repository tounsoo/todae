'use client';

import { Text } from '@tounsoo/todae/text';
import { VisuallyHidden } from '@tounsoo/todae/visually-hidden';

export default function VisuallyHiddenLabel() {
  return (
    <Text.Root>
      3 <VisuallyHidden.Root>unread messages</VisuallyHidden.Root>
      <span aria-hidden="true"> ✉</span>
    </Text.Root>
  );
}
