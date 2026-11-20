'use client';

import { OptionList } from '@tounsoo/todae';
import { useState } from 'react';

const ROWS = [
  { value: 'apple', title: 'Apple', detail: 'Crisp and sweet' },
  { value: 'pear', title: 'Pear', detail: 'Soft when ripe' },
  { value: 'plum', title: 'Plum', detail: 'Tart and juicy' },
] as const;

export default function OptionListDetail() {
  const [value, setValue] = useState<string | null>('pear');
  return (
    <OptionList.Root value={value} onValueChange={setValue} aria-label="Fruit">
      {ROWS.map((row) => (
        <OptionList.Option key={row.value} value={row.value}>
          {row.title}
          <OptionList.OptionDetail>{row.detail}</OptionList.OptionDetail>
        </OptionList.Option>
      ))}
    </OptionList.Root>
  );
}
