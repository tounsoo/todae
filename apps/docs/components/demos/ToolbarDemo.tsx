'use client';

import { Button, Menu, ToggleGroup, Toolbar } from '@tounsoo/todae';

export function ToolbarEditor() {
  return (
    <Toolbar.Root aria-label="Formatting">
      <ToggleGroup.Root aria-label="Text style" selectionMode="multiple">
        <ToggleGroup.Item value="bold">Bold</ToggleGroup.Item>
        <ToggleGroup.Item value="italic">Italic</ToggleGroup.Item>
      </ToggleGroup.Root>
      <Toolbar.Separator />
      <ToggleGroup.Root aria-label="Alignment" defaultValue="left">
        <ToggleGroup.Item value="left">Left</ToggleGroup.Item>
        <ToggleGroup.Item value="center">Center</ToggleGroup.Item>
        <ToggleGroup.Item value="right">Right</ToggleGroup.Item>
      </ToggleGroup.Root>
      <Toolbar.Separator />
      <Toolbar.Group aria-label="History">
        <Button.Root variant="ghost">Undo</Button.Root>
        <Button.Root variant="ghost">Redo</Button.Root>
      </Toolbar.Group>
      <Menu.Root>
        <Menu.Trigger variant="ghost">Insert</Menu.Trigger>
        <Menu.Content>
          <Menu.Item>Image</Menu.Item>
          <Menu.Item>Table</Menu.Item>
        </Menu.Content>
      </Menu.Root>
    </Toolbar.Root>
  );
}
