'use client';

import { Button, Stack } from '@tounsoo/todae';
import { ArrowRight as PhArrowRight, GearSix, Plus as PhPlus } from '@phosphor-icons/react';
import { IconArrowRight, IconPlus, IconSettings } from '@tabler/icons-react';
import { ArrowRight, Plus, Settings } from 'lucide-react';
import type { ReactNode } from 'react';

function IconButtons({ library, plus, next, settings }: { library: string; plus: ReactNode; next: ReactNode; settings: ReactNode }) {
  return (
    <Stack.Root direction="row">
      <Button.Root>
        <Button.Icon>{plus}</Button.Icon>
        {library}
      </Button.Root>
      <Button.Root variant="secondary">
        Next
        <Button.Icon>{next}</Button.Icon>
      </Button.Root>
      <Button.Root variant="secondary" aria-label={`${library} settings`}>
        <Button.Icon>{settings}</Button.Icon>
      </Button.Root>
    </Stack.Root>
  );
}

export default function ButtonIconLibraries() {
  return (
    <Stack.Root>
      <IconButtons library="Lucide" plus={<Plus />} next={<ArrowRight />} settings={<Settings />} />
      <IconButtons library="Phosphor" plus={<PhPlus />} next={<PhArrowRight />} settings={<GearSix />} />
      <IconButtons library="Tabler" plus={<IconPlus />} next={<IconArrowRight />} settings={<IconSettings />} />
    </Stack.Root>
  );
}
