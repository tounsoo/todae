'use client';

import { Option, OptionList } from '@tounsoo/todae';
import { useState } from 'react';

export function OptionListSingle() {
  const [value, setValue] = useState<string | null>('pear');
  return (
    <OptionList value={value} onChange={setValue} aria-label="Fruit">
      <Option value="apple">Apple</Option>
      <Option value="pear">Pear</Option>
      <Option value="plum">Plum</Option>
    </OptionList>
  );
}

export function OptionListMultiple() {
  const [value, setValue] = useState<string[]>(['apple']);
  return (
    <OptionList selectionMode="multiple" value={value} onChange={setValue} aria-label="Fruit">
      <Option value="apple">Apple</Option>
      <Option value="pear">Pear</Option>
      <Option value="plum">Plum</Option>
    </OptionList>
  );
}
