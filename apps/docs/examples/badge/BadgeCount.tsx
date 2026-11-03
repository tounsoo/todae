'use client';

import { Badge } from '@tounsoo/todae/badge';
import { Text } from '@tounsoo/todae/text';
import { VisuallyHidden } from '@tounsoo/todae/visually-hidden';

export default function BadgeCount() {
  return (
    <Text.Root>
      Inbox{' '}
      <Badge.Root>
        3<VisuallyHidden.Root> unread</VisuallyHidden.Root>
      </Badge.Root>
    </Text.Root>
  );
}
