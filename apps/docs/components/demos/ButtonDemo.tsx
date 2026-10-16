'use client';

import { Button, Stack } from '@tounsoo/todae';
import { AlignCenter, AlignLeft, AlignRight, ArrowRight, Plus } from 'lucide-react';
import { ICON_LIBRARIES } from '../iconLibraries';

export function ButtonVariants() {
  return (
    <>
      <Button.Root>Save</Button.Root>
      <Button.Root variant="secondary">Cancel</Button.Root>
      <Button.Root variant="ghost">Ghost</Button.Root>
      <Button.Root disabled>Disabled</Button.Root>
    </>
  );
}

export function ButtonOverflow() {
  return (
    <div style={{ width: 96 }}>
      <Button.Root>Very long archive label</Button.Root>
    </div>
  );
}

export function ButtonIcons() {
  return (
    <>
      <Button.Root>
        <Button.Icon>
          <Plus />
        </Button.Icon>
        Save
      </Button.Root>
      <Button.Root variant="secondary">
        Next
        <Button.Icon>
          <ArrowRight />
        </Button.Icon>
      </Button.Root>
      <Button.Root aria-label="Add">
        <Button.Icon>
          <Plus />
        </Button.Icon>
      </Button.Root>
    </>
  );
}

export function ButtonGroupAlign() {
  return (
    <Button.Group aria-label="Align">
      <Button.Root variant="secondary" aria-label="Left">
        <Button.Icon>
          <AlignLeft />
        </Button.Icon>
      </Button.Root>
      <Button.Root variant="secondary" aria-label="Center">
        <Button.Icon>
          <AlignCenter />
        </Button.Icon>
      </Button.Root>
      <Button.Root variant="secondary" aria-label="Right">
        <Button.Icon>
          <AlignRight />
        </Button.Icon>
      </Button.Root>
    </Button.Group>
  );
}

/** The same buttons with icons from three libraries. Each icon takes button.icon.size. */
export function ButtonIconLibraries() {
  return (
    <Stack.Root>
      {ICON_LIBRARIES.map((library) => (
        <Stack.Root key={library.id} direction="row">
          <Button.Root>
            <Button.Icon>{library.icons.plus}</Button.Icon>
            {library.name}
          </Button.Root>
          <Button.Root variant="secondary">
            Next
            <Button.Icon>{library.icons.arrowRight}</Button.Icon>
          </Button.Root>
          <Button.Root variant="secondary" aria-label={`${library.name} settings`}>
            <Button.Icon>{library.icons.settings}</Button.Icon>
          </Button.Root>
        </Stack.Root>
      ))}
    </Stack.Root>
  );
}
