'use client';

import { Avatar, Badge, Button, Card, categoryTone, Field, Label, Stack, Switch, Tabs, Text, type CategoryTone } from '@tounsoo/todae';
import { useId, useState } from 'react';

const MEMBERS = [
  { id: 'ada', name: 'Ada Lovelace', initials: 'AL', team: 'Design', teamTone: 'category-7' },
  { id: 'grace', name: 'Grace Hopper', initials: 'GH', team: 'Platform', teamTone: 'category-6' },
  { id: 'alan', name: 'Alan Turing', initials: 'AT', team: 'Research', teamTone: 'category-2' },
].map((member) => ({ ...member, teamTone: member.teamTone as CategoryTone, tone: categoryTone(member.id) }));

/** A small settings panel built only from Todae parts, so the home page shows the real thing. */
export function HomeShowcase() {
  const nameId = useId();
  const [name, setName] = useState('Acme Inc.');
  return (
    <Card.Root className="showcase-card">
      <Card.Header>
        {/* On a phone the avatars and badge drop below the title. */}
        <Stack.Root className="showcase-title" direction="row" wrap align="center" justify="between">
          <Text.Root as="span" weight="bold">
            Workspace
          </Text.Root>
          <Stack.Root className="showcase-meta" direction="row" align="center">
            <Stack.Root direction="row" gap="condensed" role="group" aria-label="Members">
              {MEMBERS.map((member) => (
                <Avatar.Root key={member.id} size="sm" label={member.name} tone={member.tone}>
                  <Avatar.Fallback>{member.initials}</Avatar.Fallback>
                </Avatar.Root>
              ))}
            </Stack.Root>
            <Badge.Root tone="success">Active</Badge.Root>
          </Stack.Root>
        </Stack.Root>
      </Card.Header>
      <Card.Body>
        <Tabs.Root defaultValue="general">
          <Tabs.List aria-label="Workspace settings">
            <Tabs.Tab value="general">General</Tabs.Tab>
            <Tabs.Tab value="members">Members</Tabs.Tab>
            <Tabs.Tab value="billing">Billing</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="general" className="showcase-panel">
            <Field.Group>
              <Label.Root htmlFor={nameId}>Name</Label.Root>
              <Field.Root id={nameId}>
                <Field.TextInput value={name} onChange={(event) => setName(event.target.value)} />
              </Field.Root>
            </Field.Group>
            <Switch.Root defaultChecked>Weekly digest</Switch.Root>
            <Switch.Root>Mention alerts</Switch.Root>
          </Tabs.Panel>
          <Tabs.Panel value="members" className="showcase-panel">
            {MEMBERS.map((member) => (
              <div key={member.id} className="showcase-member">
                <Avatar.Root size="sm" tone={member.tone}>
                  <Avatar.Fallback>{member.initials}</Avatar.Fallback>
                </Avatar.Root>
                <Text.Root as="span">{member.name}</Text.Root>
                <Badge.Root tone={member.teamTone}>{member.team}</Badge.Root>
              </div>
            ))}
            <Text.Root tone="muted">12 members, 3 pending invites.</Text.Root>
          </Tabs.Panel>
          <Tabs.Panel value="billing" className="showcase-panel">
            <Text.Root tone="muted">Pro plan, renews 2027-01-04.</Text.Root>
          </Tabs.Panel>
        </Tabs.Root>
      </Card.Body>
      <Card.Footer>
        <Button.Root variant="ghost">Cancel</Button.Root>
        <Button.Root>Save changes</Button.Root>
      </Card.Footer>
    </Card.Root>
  );
}
