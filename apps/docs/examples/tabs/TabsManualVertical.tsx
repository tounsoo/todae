'use client';

import { Stack, Tabs, Text } from '@tounsoo/todae';
import { useState } from 'react';

export default function TabsManualVertical() {
  const [value, setValue] = useState('overview');
  return (
    <Stack.Root>
      <Tabs.Root value={value} onValueChange={setValue} orientation="vertical" activation="manual">
        <Tabs.List aria-label="Report">
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="traffic">Traffic</Tabs.Tab>
          <Tabs.Tab value="errors">Errors</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="overview">
          <Text.Root>Arrow keys move focus. Enter or Space shows the panel.</Text.Root>
        </Tabs.Panel>
        <Tabs.Panel value="traffic">
          <Text.Root>Requests per minute.</Text.Root>
        </Tabs.Panel>
        <Tabs.Panel value="errors">
          <Text.Root>Failed requests.</Text.Root>
        </Tabs.Panel>
      </Tabs.Root>
      <Text.Root tone="muted">
        Selected: {value}
      </Text.Root>
    </Stack.Root>
  );
}
