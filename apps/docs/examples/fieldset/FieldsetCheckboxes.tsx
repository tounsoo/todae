'use client';

import { Checkbox, Description, ErrorMessage, Fieldset } from '@tounsoo/todae';
import { useId, useState } from 'react';

export default function FieldsetCheckboxes() {
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
