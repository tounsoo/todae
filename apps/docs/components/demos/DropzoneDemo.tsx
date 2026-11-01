'use client';

import { Stack, Text, useDropzone } from '@tounsoo/todae';
import { useState } from 'react';

export function ImageDrop() {
  const [names, setNames] = useState<string[]>([]);
  const zone = useDropzone({
    accept: 'image/*',
    multiple: true,
    onFiles: (accepted) => setNames(accepted.map((file) => file.name)),
  });
  return (
    <Stack.Root gap="condensed" align="start">
      <label
        {...zone.getRootProps()}
        style={{
          display: 'grid',
          justifyItems: 'center',
          gap: 'var(--todae-space-3)',
          padding: 'var(--todae-space-6)',
          border: `2px ${zone.dragging ? 'solid' : 'dashed'} var(--todae-color-border-default)`,
          borderRadius: 'var(--todae-radius-md)',
          background: zone.dragging ? 'var(--todae-color-bg-subtle)' : undefined,
        }}
      >
        <Text.Root as="span">Drop images here, or choose them</Text.Root>
        <input {...zone.getInputProps()} name="images" />
      </label>
      <Text.Root>{names.length > 0 ? names.join(', ') : 'No images yet'}</Text.Root>
    </Stack.Root>
  );
}
