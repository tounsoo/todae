'use client';

import { Button, Stack, Steps, type StepsStatus } from '@omsoo.design/todae';
import { useEffect, useState } from 'react';

const PLAN = ['Read the failing test', 'Find where the date is parsed', 'Write the fix', 'Run the test suite'];

/** Where each step is when `done` steps have finished, and whether the last run failed. */
function statusOf(index: number, done: number, failed: boolean): StepsStatus {
  if (index < done) return 'done';
  if (index === done) return failed ? 'error' : 'current';
  return 'pending';
}

export function StepsExample() {
  const [done, setDone] = useState(1);
  const [failed, setFailed] = useState(false);
  const running = !failed && done < PLAN.length;

  // Stands in for the agent, which reports each step as it finishes.
  useEffect(() => {
    if (!running) return;
    const timer = setTimeout(() => setDone((count) => count + 1), 1500);
    return () => clearTimeout(timer);
  }, [running, done]);

  return (
    <Stack.Root gap="normal">
      <Steps.Root aria-label="Plan">
        {PLAN.map((step, index) => (
          <Steps.Item key={step} status={statusOf(index, done, failed)}>
            {step}
          </Steps.Item>
        ))}
      </Steps.Root>
      <Stack.Root direction="row" gap="condensed" wrap>
        <Button.Root
          variant="secondary"
          onClick={() => {
            setDone(0);
            setFailed(false);
          }}
        >
          Run again
        </Button.Root>
        {/* Not disabled: disabling the focused button would drop focus to the page. */}
        <Button.Root variant="secondary" onClick={() => running && setFailed(true)}>
          Fail this step
        </Button.Root>
      </Stack.Root>
    </Stack.Root>
  );
}
