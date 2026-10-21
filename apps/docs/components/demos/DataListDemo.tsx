'use client';

import { DataList } from '@tounsoo/todae';

export function DataListOrder() {
  return (
    <DataList.Root aria-label="Order summary" style={{ maxInlineSize: '32rem' }}>
      <DataList.Item>
        <DataList.Term>Order</DataList.Term>
        <DataList.Details>#10482</DataList.Details>
      </DataList.Item>
      <DataList.Item>
        <DataList.Term>Status</DataList.Term>
        <DataList.Details>Shipped on 2027-01-04</DataList.Details>
      </DataList.Item>
      <DataList.Item>
        <DataList.Term>Ship to</DataList.Term>
        <DataList.Details>
          <address style={{ fontStyle: 'normal' }}>
            Mina Park
            <br />
            12 Harbor Street
            <br />
            Busan
          </address>
        </DataList.Details>
      </DataList.Item>
      <DataList.Item>
        <DataList.Term>Total</DataList.Term>
        <DataList.Details>$42.00</DataList.Details>
      </DataList.Item>
    </DataList.Root>
  );
}

export function DataListVertical() {
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
