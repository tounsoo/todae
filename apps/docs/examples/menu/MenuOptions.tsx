'use client';

import { Menu } from '@tounsoo/todae';
import { useState } from 'react';

export default function MenuOptions() {
  const [grid, setGrid] = useState(true);
  const [rulers, setRulers] = useState(false);
  const [sort, setSort] = useState('name');
  return (
    <Menu.Root>
      <Menu.Trigger variant="secondary">View</Menu.Trigger>
      <Menu.Content>
        <Menu.Group aria-label="Show">
          <Menu.CheckboxItem checked={grid} onCheckedChange={setGrid}>
            Grid
          </Menu.CheckboxItem>
          <Menu.CheckboxItem checked={rulers} onCheckedChange={setRulers}>
            Rulers
          </Menu.CheckboxItem>
        </Menu.Group>
        <Menu.Separator />
        <Menu.RadioGroup aria-label="Sort by" value={sort} onValueChange={setSort}>
          <Menu.RadioItem value="name">Name</Menu.RadioItem>
          <Menu.RadioItem value="modified">Date modified</Menu.RadioItem>
          <Menu.RadioItem value="size">Size</Menu.RadioItem>
        </Menu.RadioGroup>
      </Menu.Content>
    </Menu.Root>
  );
}
