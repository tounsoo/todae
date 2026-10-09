'use client';

import { Pagination, paginationRange } from '@omsoo/todae';
import { useState } from 'react';

export function PaginationButtons() {
  const [page, setPage] = useState(10);
  const count = 20;
  // aria-disabled, not disabled, so a step keeps focus when it reaches an end.
  const step = (to: number, label: string) => (
    <Pagination.Item>
      <button
        type="button"
        aria-disabled={to < 1 || to > count ? true : undefined}
        onClick={() => to >= 1 && to <= count && setPage(to)}
      >
        {label}
      </button>
    </Pagination.Item>
  );
  return (
    <Pagination.Root aria-label="Invoice pages">
      {step(page - 1, 'Previous')}
      {paginationRange({ page, count }).map((item) =>
        typeof item === 'number' ? (
          <Pagination.Item key={item}>
            <button type="button" aria-current={item === page ? 'page' : undefined} onClick={() => setPage(item)}>
              {item}
            </button>
          </Pagination.Item>
        ) : (
          <Pagination.Ellipsis key={item} />
        ),
      )}
      {step(page + 1, 'Next')}
    </Pagination.Root>
  );
}
