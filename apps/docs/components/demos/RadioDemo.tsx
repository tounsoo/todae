'use client';

import { Description, RadioGroup, Text } from '@tounsoo/todae';
import { useId, useState } from 'react';

export function RadioPlan() {
  const captionId = useId();
  const proHintId = useId();
  const [plan, setPlan] = useState('free');
  return (
    <div className="labelled-field">
      <Text as="span" id={captionId} size="s" weight="medium">
        Plan
      </Text>
      <RadioGroup.Root aria-labelledby={captionId} value={plan} onValueChange={setPlan}>
        <RadioGroup.Item value="free">Free</RadioGroup.Item>
        <RadioGroup.Item value="pro" aria-describedby={proHintId}>
          Pro
        </RadioGroup.Item>
        <RadioGroup.Item value="enterprise" disabled>
          Enterprise
        </RadioGroup.Item>
      </RadioGroup.Root>
      <Description id={proHintId}>Pro adds seats and audit logs.</Description>
    </div>
  );
}
