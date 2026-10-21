'use client';

import { Button, EmptyState, Field, Label, Stack, Text, useAnnouncer, type EmptyStateTitleAs } from '@tounsoo/todae';
import { FolderPlus, SearchX } from 'lucide-react';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

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

function search(query: string) {
  return PROJECTS.filter((name) => name.toLowerCase().includes(query.trim().toLowerCase()));
}

export function EmptyStateSearch() {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const announce = useAnnouncer();
  const [query, setQuery] = useState('');
  const matches = search(query);
  const count = matches.length;
  const announced = useRef(count);

  // Announce once the result settles, and only when it changed.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (announced.current === count) return;
      announced.current = count;
      announce(count === 0 ? 'No projects found' : `${count} ${count === 1 ? 'project' : 'projects'} found`);
    }, 500);
    return () => clearTimeout(timer);
  }, [count, announce]);

  return (
    <Stack.Root>
      <Field.Group>
        <Label.Root htmlFor={id}>Search projects</Label.Root>
        <Field.Root id={id}>
          <Field.TextInput ref={input} value={query} onChange={(event) => setQuery(event.target.value)} />
        </Field.Root>
      </Field.Group>
      {count > 0 ? (
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
            <Button.Root
              variant="secondary"
              onClick={() => {
                setQuery('');
                input.current?.focus();
              }}
            >
              Clear search
            </Button.Root>
          </EmptyState.Actions>
        </EmptyState.Root>
      )}
    </Stack.Root>
  );
}

type EmptyListProps = { title: string; level: EmptyStateTitleAs; children: ReactNode };

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
