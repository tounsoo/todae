'use client';

import { Stack, Tabs, Text } from '@omsoo/todae';
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
        <Text>Name, email and password.</Text>
      </Tabs.Panel>
      <Tabs.Panel value="billing">
        <Text>Plan, invoices and payment method.</Text>
      </Tabs.Panel>
      <Tabs.Panel value="audit">
        <Text>Sign-ins and changes, for admins.</Text>
      </Tabs.Panel>
      <Tabs.Panel value="team">
        <Text>Members and roles.</Text>
      </Tabs.Panel>
    </Tabs.Root>
  );
}

export function TabsManualVertical() {
  const [value, setValue] = useState('overview');
  return (
    <Stack>
      <Tabs.Root value={value} onValueChange={setValue} orientation="vertical" activation="manual">
        <Tabs.List aria-label="Report">
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="traffic">Traffic</Tabs.Tab>
          <Tabs.Tab value="errors">Errors</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="overview">
          <Text>Arrow keys move focus. Enter or Space shows the panel.</Text>
        </Tabs.Panel>
        <Tabs.Panel value="traffic">
          <Text>Requests per minute.</Text>
        </Tabs.Panel>
        <Tabs.Panel value="errors">
          <Text>Failed requests.</Text>
        </Tabs.Panel>
      </Tabs.Root>
      <Text size="s" tone="muted">
        Selected: {value}
      </Text>
    </Stack>
  );
}
