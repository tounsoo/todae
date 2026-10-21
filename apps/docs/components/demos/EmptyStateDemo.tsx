'use client';

import { Button, EmptyState, Field, Label, Stack, Text, useAnnouncer, type EmptyStateTitleElement } from '@tounsoo/todae';
import { FolderPlus, SearchX } from 'lucide-react';
import { useId, useState, type ReactNode } from 'react';

// Todae ships no icons. These come from Lucide; any icon library works.

export function EmptyStateProjects() {
  return (
    <EmptyState.Root>
      <EmptyState.Icon>
        <FolderPlus />
      </EmptyState.Icon>
      <EmptyState.Title>No projects yet</EmptyState.Title>
      <EmptyState.Description>Projects group your files and teammates. Create one to get started.</EmptyState.Description>
      <EmptyState.Actions>
        <Button.Root>New project</Button.Root>
        <Button.Root variant="secondary">Import a project</Button.Root>
      </EmptyState.Actions>
    </EmptyState.Root>
  );
}

const PROJECTS = ['Atlas', 'Beacon', 'Cedar', 'Delta'];

export function EmptyStateSearch() {
  const id = useId();
  const announce = useAnnouncer();
  const [query, setQuery] = useState('');
  const matches = PROJECTS.filter((name) => name.toLowerCase().includes(query.trim().toLowerCase()));

  return (
    <Stack.Root>
      <Field.Group>
        <Label.Root htmlFor={id}>Search projects</Label.Root>
        <Field.Root id={id}>
          <Field.TextInput
            value={query}
            onChange={(event) => {
              const next = event.target.value;
              setQuery(next);
              const count = PROJECTS.filter((name) => name.toLowerCase().includes(next.trim().toLowerCase())).length;
              announce(count === 0 ? 'No projects found' : `${count} ${count === 1 ? 'project' : 'projects'} found`);
            }}
          />
        </Field.Root>
      </Field.Group>
      {matches.length > 0 ? (
        <ul>
          {matches.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      ) : (
        <EmptyState.Root>
          <EmptyState.Icon>
            <SearchX />
          </EmptyState.Icon>
          <EmptyState.Title as="h3">No projects found</EmptyState.Title>
          <EmptyState.Description>Nothing matches “{query}”. Check the spelling or try a shorter search.</EmptyState.Description>
          <EmptyState.Actions>
            <Button.Root variant="secondary" onClick={() => setQuery('')}>
              Clear search
            </Button.Root>
          </EmptyState.Actions>
        </EmptyState.Root>
      )}
    </Stack.Root>
  );
}

type EmptyListProps = { title: string; level: EmptyStateTitleElement; children: ReactNode };

function EmptyList({ title, level, children }: EmptyListProps) {
  return (
    <EmptyState.Root>
      <EmptyState.Title as={level}>{title}</EmptyState.Title>
      <EmptyState.Description>{children}</EmptyState.Description>
    </EmptyState.Root>
  );
}

export function EmptyStateLevels() {
  return (
    <Stack.Root>
      <Text.Root as="h2">Team settings</Text.Root>
      <EmptyList title="No members yet" level="h3">
        Invite people to give them access.
      </EmptyList>
    </Stack.Root>
  );
}
