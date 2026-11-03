'use client';

import { Button, Stack } from '@tounsoo/todae';
import { ArrowRight as PhArrowRight, GearSix, Plus as PhPlus } from '@phosphor-icons/react';
import { IconArrowRight, IconPlus, IconSettings } from '@tabler/icons-react';
import { ArrowRight, Plus, Settings } from 'lucide-react';

export default function ButtonIconLibraries() {
  return (
    <Stack.Root>
      <Stack.Root direction="row">
        <Button.Root>
          <Button.Icon>
            <Plus />
          </Button.Icon>
          Lucide
        </Button.Root>
        <Button.Root variant="secondary">
          Next
          <Button.Icon>
            <ArrowRight />
          </Button.Icon>
        </Button.Root>
        <Button.Root variant="secondary" aria-label="Lucide settings">
          <Button.Icon>
            <Settings />
          </Button.Icon>
        </Button.Root>
      </Stack.Root>
      <Stack.Root direction="row">
        <Button.Root>
          <Button.Icon>
            <PhPlus />
          </Button.Icon>
          Phosphor
        </Button.Root>
        <Button.Root variant="secondary">
          Next
          <Button.Icon>
            <PhArrowRight />
          </Button.Icon>
        </Button.Root>
        <Button.Root variant="secondary" aria-label="Phosphor settings">
          <Button.Icon>
            <GearSix />
          </Button.Icon>
        </Button.Root>
      </Stack.Root>
      <Stack.Root direction="row">
        <Button.Root>
          <Button.Icon>
            <IconPlus />
          </Button.Icon>
          Tabler
        </Button.Root>
        <Button.Root variant="secondary">
          Next
          <Button.Icon>
            <IconArrowRight />
          </Button.Icon>
        </Button.Root>
        <Button.Root variant="secondary" aria-label="Tabler settings">
          <Button.Icon>
            <IconSettings />
          </Button.Icon>
        </Button.Root>
      </Stack.Root>
    </Stack.Root>
  );
}
