'use client';

import { Badge, Stack, Text } from '@tounsoo/todae';

export default function StackSpread() {
  return (
    <Stack.Root direction="row" justify="between" align="center" wrap style={{ inlineSize: '100%' }}>
      <Text.Root weight="bold">Billing</Text.Root>
      <Stack.Root as="ul" direction="row" gap="condensed" aria-label="Plan features">
        <li>
          <Badge.Root>Monthly</Badge.Root>
        </li>
        <li>
          <Badge.Root>Invoices</Badge.Root>
        </li>
      </Stack.Root>
    </Stack.Root>
  );
}
