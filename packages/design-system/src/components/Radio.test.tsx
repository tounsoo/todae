import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useState } from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { Radio, RadioGroup, type RadioGroupProps, type RadioProps } from './Radio';
import * as api from '../index';

afterEach(cleanup);

describe('Radio exports', () => {
  it('is a top-level pair', () => {
    expect(api.Radio).toBe(Radio);
    expect(api.RadioGroup).toBe(RadioGroup);
    expectTypeOf<RadioProps>().toHaveProperty('value');
    expectTypeOf<RadioGroupProps>().toHaveProperty('onValueChange');
  });
});

describe('RadioGroup', () => {
  it('accepts exactly one accessible name', () => {
    const labelled: RadioGroupProps = { 'aria-label': 'Plan' };
    const captioned: RadioGroupProps = { 'aria-labelledby': 'plan-caption' };
    expect(labelled['aria-label']).toBe('Plan');
    expect(captioned['aria-labelledby']).toBe('plan-caption');
  });

  it('selects one value and shares a name', () => {
    render(
      <RadioGroup aria-label="Plan" defaultValue="free">
        <Radio value="free">Free</Radio>
        <Radio value="pro">Pro</Radio>
      </RadioGroup>,
    );
    const free = screen.getByRole('radio', { name: 'Free' });
    const pro = screen.getByRole('radio', { name: 'Pro' });
    expect(free).toHaveProperty('checked', true);
    expect(pro).toHaveProperty('checked', false);
    expect(free).toHaveProperty('name', pro.getAttribute('name'));
    fireEvent.click(pro);
    expect(pro).toHaveProperty('checked', true);
    expect(free).toHaveProperty('checked', false);
  });

  it('is controlled from value and fires onValueChange', () => {
    function Harness() {
      const [plan, setPlan] = useState<string | null>('free');
      return (
        <RadioGroup aria-label="Plan" value={plan} onValueChange={setPlan}>
          <Radio value="free">Free</Radio>
          <Radio value="pro">Pro</Radio>
        </RadioGroup>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: 'Pro' }));
    expect(screen.getByRole('radio', { name: 'Pro' })).toHaveProperty('checked', true);
  });

  it('keeps a controlled empty group empty until the caller updates', () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup aria-label="Plan" value={null} onValueChange={onValueChange}>
        <Radio value="free">Free</Radio>
      </RadioGroup>,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Free' }));
    expect(screen.getByRole('radio')).toHaveProperty('checked', false);
    expect(onValueChange).toHaveBeenCalledWith('free');
  });

  it('throws when Radio renders outside RadioGroup', () => {
    expect(() => render(<Radio value="free">Free</Radio>)).toThrow(
      'Radio must render inside RadioGroup',
    );
  });

  it('marks every radio invalid from the group', () => {
    render(
      <RadioGroup aria-label="Plan" invalid>
        <Radio value="free">Free</Radio>
      </RadioGroup>,
    );
    expect(screen.getByRole('radio').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('radiogroup').getAttribute('aria-invalid')).toBe('true');
  });

  it('SSR keeps the radiogroup name', () => {
    const html = renderToString(
      <RadioGroup aria-label="Plan" name="plan">
        <Radio value="free">Free</Radio>
      </RadioGroup>,
    );
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Plan"');
    expect(html).toContain('type="radio"');
    expect(html).toContain('name="plan"');
  });
});
