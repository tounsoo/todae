import { Badge, Stack, Text } from '@tounsoo/todae';

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
        3<span className="todae-visually-hidden"> unread</span>
      </Badge.Root>
    </Text>
  );
}
