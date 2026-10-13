'use client';

import { Badge, Button, Stack, Text } from '@omsoo.design/todae';

export function StackButtons() {
  return (
    <Stack.Root>
      <Text.Root>Stacked label</Text.Root>
      <Button.Root>Primary</Button.Root>
      <Button.Root variant="secondary">Secondary</Button.Root>
    </Stack.Root>
  );
}

export function StackGaps() {
  return (
    <Stack.Root gap="spacious">
      {(['none', 'condensed', 'normal', 'spacious'] as const).map((gap) => (
        <Stack.Root key={gap} gap="condensed">
          <Text.Root size="s">{gap}</Text.Root>
          <Stack.Root direction="row" gap={gap}>
            <Badge.Root>One</Badge.Root>
            <Badge.Root>Two</Badge.Root>
            <Badge.Root>Three</Badge.Root>
          </Stack.Root>
        </Stack.Root>
      ))}
    </Stack.Root>
  );
}

export function StackSpread() {
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
