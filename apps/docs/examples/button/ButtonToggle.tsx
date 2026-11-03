'use client';

import { Button } from '@tounsoo/todae';
import { useState } from 'react';

export default function ButtonToggle() {
  const [muted, setMuted] = useState(false);
  return (
    <Button.Root variant="secondary" pressed={muted} onPressedChange={setMuted}>
      Mute
    </Button.Root>
  );
}
