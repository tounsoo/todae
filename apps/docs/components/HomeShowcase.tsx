'use client';

import { Avatar, Badge, Button, Card, categoryTone, Field, Label, Switch, Tabs, Text, type CategoryTone } from '@omsoo/todae';
import { useId, useState } from 'react';

const MEMBERS: { id: string; name: string; initials: string; team: string; teamTone: CategoryTone }[] = [
  { id: 'ada', name: 'Ada Lovelace', initials: 'AL', team: 'Design', teamTone: 'category-7' },
  { id: 'grace', name: 'Grace Hopper', initials: 'GH', team: 'Platform', teamTone: 'category-6' },
  { id: 'alan', name: 'Alan Turing', initials: 'AT', team: 'Research', teamTone: 'category-2' },
];

/** A small settings panel built only from Todae parts, so the home page shows the real thing. */
export function HomeShowcase() {
  const nameId = useId();
  const [name, setName] = useState('Acme Inc.');
  return (
    <Card.Root className="showcase-card">
      <Card.Header>
        <div className="showcase-title">
          <Text as="span" size="l" weight="bold">
            Workspace
          </Text>
          <Badge.Root tone="success">Active</Badge.Root>
        </div>
      </Card.Header>
      <Card.Body>
        <Tabs.Root defaultValue="general">
          <Tabs.List aria-label="Workspace settings">
            <Tabs.Tab value="general">General</Tabs.Tab>
            <Tabs.Tab value="members">Members</Tabs.Tab>
            <Tabs.Tab value="billing">Billing</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="general" className="showcase-panel">
            <div className="labelled-field">
              <Label htmlFor={nameId}>Name</Label>
              <Field.Root id={nameId}>
                <Field.TextInput value={name} onChange={(event) => setName(event.target.value)} />
              </Field.Root>
            </div>
            <Switch defaultChecked>Weekly digest</Switch>
            <Switch>Mention alerts</Switch>
          </Tabs.Panel>
          <Tabs.Panel value="members" className="showcase-panel">
            {MEMBERS.map((member) => (
              <div key={member.id} className="showcase-member">
                <Avatar.Root size="sm" tone={categoryTone(member.id)}>
                  <Avatar.Fallback>{member.initials}</Avatar.Fallback>
                </Avatar.Root>
                <Text as="span">{member.name}</Text>
                <Badge.Root tone={member.teamTone}>{member.team}</Badge.Root>
              </div>
            ))}
            <Text tone="muted">12 members, 3 pending invites.</Text>
          </Tabs.Panel>
          <Tabs.Panel value="billing" className="showcase-panel">
            <Text tone="muted">Pro plan, renews 2027-01-04.</Text>
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
