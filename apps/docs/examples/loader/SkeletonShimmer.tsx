'use client';

import { Skeleton } from '@tounsoo/todae/skeleton';
import { Stack } from '@tounsoo/todae/stack';
import { VisuallyHidden } from '@tounsoo/todae/visually-hidden';

export default function SkeletonShimmer() {
  return (
    <div>
      <VisuallyHidden.Root>Loading article</VisuallyHidden.Root>
      <Stack.Root aria-hidden="true">
        <Skeleton.Root variant="shimmer" style={{ inlineSize: '60%' }} />
        <Skeleton.Root variant="shimmer" />
        <Skeleton.Root variant="shimmer" style={{ inlineSize: '80%' }} />
      </Stack.Root>
    </div>
  );
}
