'use client';

import { Button } from '@tounsoo/todae';

export default function ButtonOverflow() {
  return (
    <div style={{ width: 96 }}>
      <Button.Root>Very long archive label</Button.Root>
    </div>
  );
}
