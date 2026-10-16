'use client';

import { Button, useRovingFocus } from '@tounsoo/todae';

// Actions, not toggles: a toggle would also need aria-pressed.
const TOOLS = ['Cut', 'Copy', 'Paste', 'Delete'];

export function RovingToolbar() {
  const roving = useRovingFocus({ orientation: 'horizontal', defaultActiveValue: 'Cut' });
  return (
    <div role="toolbar" aria-label="Clipboard" className="demo-toolbar" {...roving.getContainerProps()}>
      {TOOLS.map((tool) => (
        <Button.Root key={tool} variant="ghost" {...roving.getItemProps(tool, { disabled: tool === 'Paste' })} disabled={tool === 'Paste'}>
          {tool}
        </Button.Root>
      ))}
    </div>
  );
}
