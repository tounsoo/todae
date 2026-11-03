'use client';

import { Avatar, Badge, Button, Card, categoryTone, Field, Label, Stack, Switch, Tabs, Text, type CategoryTone } from '@tounsoo/todae';
import { useId, useState, type CSSProperties } from 'react';
import { localizePath, type Locale } from '../lib/i18n/config';
import { DICTIONARIES } from '../lib/i18n/dictionaries';
import { SiteLink } from './SiteLink';

const smallAvatar = { '--todae-avatar-size': '1.5rem' } as CSSProperties;

const MEMBERS: readonly { id: 'ada' | 'grace' | 'alan'; teamTone: CategoryTone }[] = [
  { id: 'ada', teamTone: 'category-7' },
  { id: 'grace', teamTone: 'category-6' },
  { id: 'alan', teamTone: 'category-2' },
];

const SHOWCASE_DOCS = [
  { id: 'card', href: '/card' },
  { id: 'tabs', href: '/tabs' },
  { id: 'field', href: '/field' },
  { id: 'switch', href: '/switch' },
] as const;

/** A small settings panel built only from Todae parts, so the home page shows the real thing. */
export function HomeShowcase({ locale }: { locale: Locale }) {
  const copy = DICTIONARIES[locale].homeShowcase;
  const nameId = useId();
  const [name, setName] = useState(copy.nameValue);
  return (
    <>
      <Card.Root className="showcase-card">
        <Card.Header>
          <Stack.Root className="showcase-title" direction="row" wrap align="center" justify="between">
            <Text.Root as="span" weight="bold">
              {copy.workspace}
            </Text.Root>
            <Stack.Root className="showcase-meta" direction="row" align="center">
              <Stack.Root direction="row" gap="condensed" role="group" aria-label={copy.members} style={smallAvatar}>
                {MEMBERS.map((member) => (
                  <Avatar.Root key={member.id} label={copy.people[member.id].name} tone={categoryTone(member.id)}>
                    <Avatar.Fallback>{copy.people[member.id].initials}</Avatar.Fallback>
                  </Avatar.Root>
                ))}
              </Stack.Root>
              <Badge.Root tone="success">{copy.active}</Badge.Root>
            </Stack.Root>
          </Stack.Root>
        </Card.Header>
        <Card.Body>
          <Tabs.Root defaultValue="general">
            <Tabs.List aria-label={copy.settings}>
              <Tabs.Tab value="general">{copy.general}</Tabs.Tab>
              <Tabs.Tab value="members">{copy.members}</Tabs.Tab>
              <Tabs.Tab value="billing">{copy.billing}</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="general" className="showcase-panel">
              <Field.Group>
                <Label.Root htmlFor={nameId}>{copy.name}</Label.Root>
                <Field.Root id={nameId}>
                  <Field.TextInput value={name} onChange={(event) => setName(event.target.value)} />
                </Field.Root>
              </Field.Group>
              <Switch.Root defaultChecked>{copy.weeklyDigest}</Switch.Root>
              <Switch.Root>{copy.mentionAlerts}</Switch.Root>
            </Tabs.Panel>
            <Tabs.Panel value="members" className="showcase-panel">
              {MEMBERS.map((member) => (
                <div key={member.id} className="showcase-member" style={smallAvatar}>
                  <Avatar.Root tone={categoryTone(member.id)}>
                    <Avatar.Fallback>{copy.people[member.id].initials}</Avatar.Fallback>
                  </Avatar.Root>
                  <Text.Root as="span">{copy.people[member.id].name}</Text.Root>
                  <Badge.Root tone={member.teamTone}>{copy.people[member.id].team}</Badge.Root>
                </div>
              ))}
              <Text.Root tone="muted">{copy.pending}</Text.Root>
            </Tabs.Panel>
            <Tabs.Panel value="billing" className="showcase-panel">
              <Text.Root tone="muted">{copy.plan}</Text.Root>
            </Tabs.Panel>
          </Tabs.Root>
        </Card.Body>
        <Card.Footer>
          <Button.Root variant="ghost">{copy.cancel}</Button.Root>
          <Button.Root>{copy.save}</Button.Root>
        </Card.Footer>
      </Card.Root>
      <nav className="showcase-docs" aria-label={copy.docsLabel}>
        {SHOWCASE_DOCS.map((piece) => (
          <SiteLink key={piece.id} href={localizePath(piece.href, locale)}>
            {copy.docs[piece.id]}
          </SiteLink>
        ))}
      </nav>
    </>
  );
}
