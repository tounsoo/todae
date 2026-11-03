'use client';

import { DataList } from '@tounsoo/todae';

export default function DataListColumns() {
  const plan = [
    ['Plan', 'Team'],
    ['Seats', '12 of 20'],
    ['Storage', '48 GB of 100 GB'],
    ['Billing', 'Monthly'],
    ['Renews', '2027-02-01'],
    ['Support', 'Business hours'],
  ];
  return (
    <DataList.Root orientation="vertical" minItemSize="10rem" aria-label="Plan">
      {plan.map(([term, details]) => (
        <DataList.Item key={term}>
          <DataList.Term>{term}</DataList.Term>
          <DataList.Details>{details}</DataList.Details>
        </DataList.Item>
      ))}
    </DataList.Root>
  );
}
