'use client';

import { Stack, Tabs, Text } from '@omsoo.design/todae';
import { useState } from 'react';

export function TabsBasic() {
  return (
    <Tabs.Root defaultValue="account">
      <Tabs.List aria-label="Settings">
        <Tabs.Tab value="account">Account</Tabs.Tab>
        <Tabs.Tab value="billing">Billing</Tabs.Tab>
        <Tabs.Tab value="audit" disabled>
          Audit log
        </Tabs.Tab>
        <Tabs.Tab value="team">Team</Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="account">
        <Text.Root>Name, email and password.</Text.Root>
      </Tabs.Panel>
      <Tabs.Panel value="billing">
        <Text.Root>Plan, invoices and payment method.</Text.Root>
      </Tabs.Panel>
      <Tabs.Panel value="audit">
        <Text.Root>Sign-ins and changes, for admins.</Text.Root>
      </Tabs.Panel>
      <Tabs.Panel value="team">
        <Text.Root>Members and roles.</Text.Root>
      </Tabs.Panel>
    </Tabs.Root>
  );
}

export function TabsManualVertical() {
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
      <Text.Root size="s" tone="muted">
        Selected: {value}
      </Text.Root>
    </Stack.Root>
  );
}
