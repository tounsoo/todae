'use client';

import { Button, useRovingFocus } from '@omsoo.design/todae';

const TOOLS = ['Bold', 'Italic', 'Underline', 'Strike'];

export function RovingToolbar() {
  const roving = useRovingFocus({ orientation: 'horizontal', defaultActiveValue: 'Bold' });
  return (
    <div role="toolbar" aria-label="Text style" className="demo-toolbar" {...roving.getContainerProps()}>
      {TOOLS.map((tool) => (
        <Button.Root key={tool} variant="ghost" {...roving.getItemProps(tool, { disabled: tool === 'Strike' })} disabled={tool === 'Strike'}>
          {tool}
        </Button.Root>
      ))}
    </div>
  );
}
