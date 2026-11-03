'use client';

import { Steps } from '@tounsoo/todae';

export default function StepsProgressExample() {
  return (
    <Steps.Root variant="progress" aria-label="Sign-up steps">
      <Steps.Item status="done">Account</Steps.Item>
      <Steps.Item status="current">Workspace</Steps.Item>
      <Steps.Item>Review</Steps.Item>
    </Steps.Root>
  );
}
