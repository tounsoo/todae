'use client';

import { Description, Radio, RadioGroup, Text } from '@tounsoo/todae';
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
      <RadioGroup aria-labelledby={captionId} value={plan} onValueChange={setPlan}>
        <Radio value="free">Free</Radio>
        <Radio value="pro" aria-describedby={proHintId}>
          Pro
        </Radio>
        <Radio value="enterprise" disabled>
          Enterprise
        </Radio>
      </RadioGroup>
      <Description id={proHintId}>Pro adds seats and audit logs.</Description>
    </div>
  );
}
