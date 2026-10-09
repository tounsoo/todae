import { Badge } from '@tounsoo/todae/badge';
import { Stack } from '@tounsoo/todae/stack';
import { Text } from '@tounsoo/todae/text';
import { VisuallyHidden } from '@tounsoo/todae/visually-hidden';

export function BadgeTones() {
  return (
    <Stack direction="row" style={{ flexWrap: 'wrap' }}>
      <Badge.Root>Draft</Badge.Root>
      <Badge.Root tone="info">Beta</Badge.Root>
      <Badge.Root tone="success">Paid</Badge.Root>
      <Badge.Root tone="warning">Due soon</Badge.Root>
      <Badge.Root tone="critical">Overdue</Badge.Root>
    </Stack>
  );
}

export function BadgeCount() {
  return (
    <Text>
      Inbox{' '}
      <Badge.Root>
        3<VisuallyHidden.Root> unread</VisuallyHidden.Root>
      </Badge.Root>
    </Text>
  );
}
