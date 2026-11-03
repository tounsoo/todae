'use client';

import { Button, EmptyState } from '@tounsoo/todae';
import { FolderPlus } from 'lucide-react';

// Todae ships no icons. These come from Lucide; any icon library works.

export default function EmptyStateProjects() {
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
