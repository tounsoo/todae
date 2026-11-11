'use client';

import { Code, Field, Label, paginationRange, Stack } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function PaginationRangeItems({ locale }: { locale: string }) {
  const pageId = useId();
  const countId = useId();
  const [count, setCount] = useState<number | null>(20);
  const [page, setPage] = useState<number | null>(10);
  const total = count ?? 1;
  const current = Math.min(page ?? 1, total);
  return (
    <Stack.Root gap="condensed">
      <Stack.Root direction="row" style={{ flexWrap: 'wrap' }}>
        <Field.Group>
          <Label.Root htmlFor={pageId}>Page</Label.Root>
          <Field.Root id={pageId}>
            <Field.NumberInput value={page} onValueChange={setPage} min={1} max={total} step={1} locale={locale} />
          </Field.Root>
        </Field.Group>
        <Field.Group>
          <Label.Root htmlFor={countId}>Pages</Label.Root>
          <Field.Root id={countId}>
            <Field.NumberInput value={count} onValueChange={setCount} min={1} max={500} step={1} locale={locale} />
          </Field.Root>
        </Field.Group>
      </Stack.Root>
      <Code.Root>{JSON.stringify(paginationRange({ page: current, count: total }))}</Code.Root>
    </Stack.Root>
  );
}
