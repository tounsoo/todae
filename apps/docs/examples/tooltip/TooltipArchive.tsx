'use client';

import { Button } from '@tounsoo/todae';
import { Archive } from 'lucide-react';

export default function TooltipArchive() {
  return (
    <Button.Root aria-label="Archive">
      <Button.Icon>
        <Archive />
      </Button.Icon>
    </Button.Root>
  );
}
