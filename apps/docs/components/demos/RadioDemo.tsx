'use client';

import { Description, Field, RadioGroup, Text } from '@tounsoo/todae';
import { useId, useState } from 'react';

export function RadioPlan() {
  const captionId = useId();
  const proHintId = useId();
  const [plan, setPlan] = useState('free');
  return (
    <Field.Group>
      <Text.Root as="span" id={captionId} weight="medium">
        Plan
      </Text.Root>
      <RadioGroup.Root aria-labelledby={captionId} value={plan} onValueChange={setPlan}>
        <RadioGroup.Item value="free">Free</RadioGroup.Item>
        <RadioGroup.Item value="pro" aria-describedby={proHintId}>
          Pro
        </RadioGroup.Item>
        <RadioGroup.Item value="enterprise" disabled>
          Enterprise
        </RadioGroup.Item>
      </RadioGroup.Root>
      <Description.Root id={proHintId}>Pro adds seats and audit logs.</Description.Root>
    </Field.Group>
  );
}
