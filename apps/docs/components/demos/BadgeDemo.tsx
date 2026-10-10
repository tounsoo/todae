import { Badge, CATEGORY_TONES } from '@omsoo/todae/badge';
import { Stack } from '@omsoo/todae/stack';
import { Text } from '@omsoo/todae/text';
import { VisuallyHidden } from '@omsoo/todae/visually-hidden';

const CATEGORIES = ['Bug', 'Design', 'Docs', 'Tokens', 'Research', 'Mobile', 'Web', 'Infra'];

export function BadgeTones() {
  return (
    <Stack.Root>
      <Stack.Root direction="row" style={{ flexWrap: 'wrap' }}>
        <Badge.Root>Draft</Badge.Root>
        <Badge.Root tone="info">Beta</Badge.Root>
        <Badge.Root tone="success">Paid</Badge.Root>
        <Badge.Root tone="warning">Due soon</Badge.Root>
        <Badge.Root tone="critical">Overdue</Badge.Root>
      </Stack.Root>
      <Stack.Root direction="row" style={{ flexWrap: 'wrap' }}>
        {CATEGORY_TONES.map((tone, i) => (
          <Badge.Root key={tone} tone={tone}>
            {CATEGORIES[i]}
          </Badge.Root>
        ))}
      </Stack.Root>
    </Stack.Root>
  );
}

export function BadgeCount() {
  return (
    <Text.Root>
      Inbox{' '}
      <Badge.Root>
        3<VisuallyHidden.Root> unread</VisuallyHidden.Root>
      </Badge.Root>
    </Text.Root>
  );
}
