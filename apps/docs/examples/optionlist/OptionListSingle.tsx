'use client';

import { OptionList } from '@tounsoo/todae';
import { useState } from 'react';

export default function OptionListSingle() {
  const [value, setValue] = useState<string | null>('pear');
  return (
    <OptionList.Root value={value} onValueChange={setValue} aria-label="Fruit">
      <OptionList.Option value="apple">Apple</OptionList.Option>
      <OptionList.Option value="pear">Pear</OptionList.Option>
      <OptionList.Option value="plum">Plum</OptionList.Option>
    </OptionList.Root>
  );
}
