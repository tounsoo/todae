'use client';

import { Skeleton } from '@tounsoo/todae/skeleton';
import { Stack } from '@tounsoo/todae/stack';
import { VisuallyHidden } from '@tounsoo/todae/visually-hidden';

export default function SkeletonProfile() {
  return (
    <div>
      <VisuallyHidden.Root>Loading profile</VisuallyHidden.Root>
      <Stack.Root direction="row" aria-hidden="true">
        <Skeleton.Root style={{ inlineSize: '2.5rem', blockSize: '2.5rem', borderRadius: '50%' }} />
        <Stack.Root style={{ flex: 1 }}>
          <Skeleton.Root style={{ inlineSize: '40%' }} />
          <Skeleton.Root style={{ inlineSize: '70%' }} />
        </Stack.Root>
      </Stack.Root>
    </div>
  );
}
