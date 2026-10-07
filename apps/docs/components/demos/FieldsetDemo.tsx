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
      <Description id={hintId}>We send at most one email a week.</Description>
      <Checkbox checked={topics.includes('product')} onCheckedChange={toggle('product')}>
        Product news
      </Checkbox>
      <Checkbox checked={topics.includes('security')} onCheckedChange={toggle('security')}>
        Security notices
      </Checkbox>
      <Checkbox checked={topics.includes('events')} onCheckedChange={toggle('events')}>
        Events
      </Checkbox>
      {invalid ? <ErrorMessage id={errorId}>Pick at least one topic.</ErrorMessage> : null}
    </Fieldset.Root>
  );
}

export function FieldsetDisabled() {
  const [paused, setPaused] = useState(true);
  return (
    <Stack>
      <Switch checked={paused} onCheckedChange={setPaused}>
        Pause notifications
      </Switch>
      <Fieldset.Root disabled={paused}>
        <Fieldset.Legend>Channels</Fieldset.Legend>
        <Stack direction="row">
          <Checkbox defaultChecked>Email</Checkbox>
          <Checkbox>Push</Checkbox>
          <Checkbox>SMS</Checkbox>
        </Stack>
      </Fieldset.Root>
    </Stack>
  );
}
