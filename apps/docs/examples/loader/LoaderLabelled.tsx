'use client';

import { Loader } from '@tounsoo/todae/loader';
import { Stack } from '@tounsoo/todae/stack';

export default function LoaderLabelled() {
  return (
    <Stack.Root direction="row">
      <label>
        <Loader.Root /> Loading invoices
      </label>
      <Loader.Root aria-label="Saving" />
    </Stack.Root>
  );
}
