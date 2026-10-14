import { render } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { Field } from '../components/Field';

function Time({ step, initial }: { step?: number; initial: string }) {
  const [time, setTime] = useState<Temporal.PlainTime | null>(Temporal.PlainTime.from(initial));
  return (
    <>
      <Field.Root aria-label="Time">
        <Field.TimeInput step={step} value={time} onValueChange={setTime} />
      </Field.Root>
      <output>{time?.toString() ?? 'none'}</output>
    </>
  );
}

describe('Field.TimeInput in a browser', () => {
  it('keeps typing intact in a time input that shows seconds', async () => {
    const { container } = render(<Time step={1} initial="01:30" />);
    const input = container.querySelector('input')!;
    await userEvent.click(input);
    input.focus();
    // The first segment is the hour: two digits move on to the minutes.
    await userEvent.keyboard('14');
    expect(container.querySelector('output')!.textContent).toBe('14:30:00');
    await userEvent.keyboard('45');
    expect(container.querySelector('output')!.textContent).toBe('14:45:00');
  });
});
