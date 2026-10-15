'use client';

import { Checkbox, Description, ErrorMessage, Fieldset, Stack, Switch } from '@tounsoo/todae';
import { useId, useState } from 'react';

export function FieldsetCheckboxes() {
  const [topics, setTopics] = useState<string[]>([]);
  const hintId = useId();
  const errorId = useId();
  const invalid = topics.length === 0;
  const toggle = (topic: string) => (checked: boolean) =>
    setTopics((prev) => (checked ? [...prev, topic] : prev.filter((t) => t !== topic)));
  return (
    <Fieldset.Root invalid={invalid} aria-describedby={invalid ? `${hintId} ${errorId}` : hintId}>
      <Fieldset.Legend>Email topics</Fieldset.Legend>
      <Description.Root id={hintId}>We send at most one email a week.</Description.Root>
      <Checkbox.Root checked={topics.includes('product')} onCheckedChange={toggle('product')}>
        Product news
      </Checkbox.Root>
      <Checkbox.Root checked={topics.includes('security')} onCheckedChange={toggle('security')}>
        Security notices
      </Checkbox.Root>
      <Checkbox.Root checked={topics.includes('events')} onCheckedChange={toggle('events')}>
        Events
      </Checkbox.Root>
      {invalid ? <ErrorMessage.Root id={errorId}>Pick at least one topic.</ErrorMessage.Root> : null}
    </Fieldset.Root>
  );
}

export function FieldsetDisabled() {
  const [paused, setPaused] = useState(true);
  return (
    <Stack.Root>
      <Switch.Root checked={paused} onCheckedChange={setPaused}>
        Pause notifications
      </Switch.Root>
      <Fieldset.Root disabled={paused}>
        <Fieldset.Legend>Channels</Fieldset.Legend>
        <Stack.Root direction="row">
          <Checkbox.Root defaultChecked>Email</Checkbox.Root>
          <Checkbox.Root>Push</Checkbox.Root>
          <Checkbox.Root>SMS</Checkbox.Root>
        </Stack.Root>
      </Fieldset.Root>
    </Stack.Root>
  );
}
