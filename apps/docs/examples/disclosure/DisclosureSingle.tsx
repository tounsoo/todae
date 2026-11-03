'use client';

import { Disclosure } from '@tounsoo/todae/disclosure';
import { Text } from '@tounsoo/todae/text';

export default function DisclosureSingle() {
  return (
    <Disclosure.Root>
      <Disclosure.Summary>Shipping details</Disclosure.Summary>
      <Text.Root>Orders ship within two business days.</Text.Root>
    </Disclosure.Root>
  );
}
