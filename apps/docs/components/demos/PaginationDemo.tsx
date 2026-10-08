'use client';

import { Pagination, paginationRange } from '@tounsoo/todae';
import { useState } from 'react';

export function PaginationButtons() {
  const [page, setPage] = useState(10);
  const count = 20;
  return (
    <Pagination.Root aria-label="Invoice pages">
      <Pagination.Item>
        <button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>
          Previous
        </button>
      </Pagination.Item>
      {paginationRange({ page, count }).map((item) =>
        typeof item === 'number' ? (
          <Pagination.Item key={item} current={item === page}>
            {item === page ? (
              item
            ) : (
              <button type="button" onClick={() => setPage(item)}>
                {item}
              </button>
            )}
          </Pagination.Item>
        ) : (
          <Pagination.Ellipsis key={item} />
        ),
      )}
      <Pagination.Item>
        <button type="button" disabled={page === count} onClick={() => setPage(page + 1)}>
          Next
        </button>
      </Pagination.Item>
    </Pagination.Root>
  );
}
