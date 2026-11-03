'use client';

import { DataList } from '@tounsoo/todae';

export default function DataListVertical() {
  return (
    <DataList.Root orientation="vertical" aria-label="Profile" style={{ maxInlineSize: '24rem' }}>
      <DataList.Item>
        <DataList.Term>Name</DataList.Term>
        <DataList.Details>Mina Park</DataList.Details>
      </DataList.Item>
      <DataList.Item>
        <DataList.Term>Email</DataList.Term>
        <DataList.Details>mina@example.com</DataList.Details>
      </DataList.Item>
      <DataList.Item>
        <DataList.Term>Teams</DataList.Term>
        <DataList.Details>Design systems, Docs</DataList.Details>
      </DataList.Item>
    </DataList.Root>
  );
}
