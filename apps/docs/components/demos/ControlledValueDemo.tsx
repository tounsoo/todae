'use client';

import { Button, RadioGroup, Stack, Text, useControlledValue } from '@tounsoo/todae';
import { useState } from 'react';

function Filter({
  label,
  value,
  defaultValue = 'all',
  onValueChange,
}: {
  label: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (next: string) => void;
}) {
  const [current, change] = useControlledValue(value, defaultValue, onValueChange);
  return (
    <Stack.Root gap="condensed" align="start">
      <RadioGroup.Root aria-label={label} value={current} onValueChange={change}>
        <RadioGroup.Item value="all">All</RadioGroup.Item>
        <RadioGroup.Item value="open">Open</RadioGroup.Item>
      </RadioGroup.Root>
      <Button.Root onClick={() => change('open')}>Set open</Button.Root>
    </Stack.Root>
  );
}

export function StatusFilter() {
  const [freeChanges, setFreeChanges] = useState(0);
  const [held, setHeld] = useState('all');
  const [heldChanges, setHeldChanges] = useState(0);
  return (
    <Stack.Root gap="normal" align="start">
      <Text.Root>Uncontrolled. Changes {freeChanges}.</Text.Root>
      <Filter label="Uncontrolled status" onValueChange={() => setFreeChanges((count) => count + 1)} />
      <Text.Root>Controlled. Parent holds {held}. Changes {heldChanges}.</Text.Root>
      <Filter
        label="Controlled status"
        value={held}
        onValueChange={(next) => {
          setHeld(next);
          setHeldChanges((count) => count + 1);
        }}
      />
      <Button.Root variant="secondary" onClick={() => setHeld('all')}>
        Reset parent
      </Button.Root>
    </Stack.Root>
  );
}
