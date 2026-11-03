'use client';

import { Tabs, Text } from '@tounsoo/todae';

export default function TabsBasic() {
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
