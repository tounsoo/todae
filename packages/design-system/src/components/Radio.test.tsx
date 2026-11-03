import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { useState } from 'react';
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest';
import { RadioGroup, type RadioGroupItemProps, type RadioGroupRootProps } from './Radio.js';
import { resetWarnOnce } from '../internal/warnOnce.js';
import * as api from '../index.js';
import { reset } from '../test/form.js';

afterEach(cleanup);

describe('Radio exports', () => {
  it('is a namespace with Root and Item', () => {
    expect(RadioGroup.Item).toBeTypeOf('function');
    expect('Radio' in api).toBe(false);
    expect(api.RadioGroup).toBe(RadioGroup);
    expectTypeOf<RadioGroupItemProps>().toHaveProperty('value');
    expectTypeOf<RadioGroupRootProps>().toHaveProperty('onValueChange');
  });
});

describe('RadioGroup', () => {
  it('selects one value and shares a name', () => {
    render(
      <RadioGroup.Root aria-label="Plan" defaultValue="free">
        <RadioGroup.Item value="free">Free</RadioGroup.Item>
        <RadioGroup.Item value="pro">Pro</RadioGroup.Item>
      </RadioGroup.Root>,
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
        <RadioGroup.Root aria-label="Plan" value={plan} onValueChange={setPlan}>
          <RadioGroup.Item value="free">Free</RadioGroup.Item>
          <RadioGroup.Item value="pro">Pro</RadioGroup.Item>
        </RadioGroup.Root>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('radio', { name: 'Pro' }));
    expect(screen.getByRole('radio', { name: 'Pro' })).toHaveProperty('checked', true);
  });

  it('keeps a controlled empty group empty until the caller updates', () => {
    const onValueChange = vi.fn();
    render(
      <RadioGroup.Root aria-label="Plan" value={null} onValueChange={onValueChange}>
        <RadioGroup.Item value="free">Free</RadioGroup.Item>
      </RadioGroup.Root>,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'Free' }));
    expect(screen.getByRole('radio')).toHaveProperty('checked', false);
    expect(onValueChange).toHaveBeenCalledWith('free');
  });

  it('names RadioGroup.Root when both value and defaultValue are set', () => {
    resetWarnOnce();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(
      <RadioGroup.Root aria-label="Plan" value="free" defaultValue="pro" onValueChange={() => undefined}>
        <RadioGroup.Item value="free">Free</RadioGroup.Item>
      </RadioGroup.Root>,
    );
    expect(error).toHaveBeenCalledWith('RadioGroup.Root cannot take both value and defaultValue');
    error.mockRestore();
  });

  it('reports both value and defaultValue once, not on every render', () => {
    resetWarnOnce();
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const group = (
      <RadioGroup.Root aria-label="Plan" value="free" defaultValue="pro" onValueChange={() => undefined}>
        <RadioGroup.Item value="free">Free</RadioGroup.Item>
      </RadioGroup.Root>
    );
    const { rerender } = render(group);
    rerender(group);
    rerender(group);
    expect(error.mock.calls.filter(([message]) => String(message).includes('cannot take both'))).toHaveLength(1);
    error.mockRestore();
  });

  it('throws when RadioGroup.Item renders outside RadioGroup.Root', () => {
    expect(() => render(<RadioGroup.Item value="free">Free</RadioGroup.Item>)).toThrow(
      'RadioGroup.Item must render inside RadioGroup.Root',
    );
  });

  it('marks every radio invalid from the group', () => {
    render(
      <RadioGroup.Root aria-label="Plan" invalid>
        <RadioGroup.Item value="free">Free</RadioGroup.Item>
      </RadioGroup.Root>,
    );
    expect(screen.getByRole('radio').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('radiogroup').getAttribute('aria-invalid')).toBe('true');
  });

  it('SSR keeps the radiogroup name', () => {
    const html = renderToString(
      <RadioGroup.Root aria-label="Plan" name="plan">
        <RadioGroup.Item value="free">Free</RadioGroup.Item>
      </RadioGroup.Root>,
    );
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="Plan"');
    expect(html).toContain('type="radio"');
    expect(html).toContain('name="plan"');
  });
});

describe('RadioGroup after a form reset', () => {
  const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLInputElement;
  const shownChecked = (name: string) => radio(name).closest('label')!.hasAttribute('data-checked');

  it('goes back to defaultValue, reports it, and reports the next pick', async () => {
    const onValueChange = vi.fn();
    render(
      <form>
        <RadioGroup.Root aria-label="Plan" defaultValue="free" onValueChange={onValueChange}>
          <RadioGroup.Item value="free">Free</RadioGroup.Item>
          <RadioGroup.Item value="pro">Pro</RadioGroup.Item>
        </RadioGroup.Root>
      </form>,
    );
    fireEvent.click(radio('Pro'));
    await reset(radio('Pro').form!);
    expect(radio('Free').checked).toBe(true);
    expect(shownChecked('Free')).toBe(true);
    expect(shownChecked('Pro')).toBe(false);
    fireEvent.click(radio('Pro'));
    expect(onValueChange.mock.calls).toEqual([['pro'], ['free'], ['pro']]);
  });

  it('goes back to no pick, and reports the next pick', async () => {
    const onValueChange = vi.fn();
    render(
      <form>
        <RadioGroup.Root aria-label="Plan" onValueChange={onValueChange}>
          <RadioGroup.Item value="free">Free</RadioGroup.Item>
          <RadioGroup.Item value="pro">Pro</RadioGroup.Item>
        </RadioGroup.Root>
      </form>,
    );
    fireEvent.click(radio('Pro'));
    await reset(radio('Pro').form!);
    expect(radio('Pro').checked).toBe(false);
    expect(shownChecked('Pro')).toBe(false);
    fireEvent.click(radio('Pro'));
    expect(shownChecked('Pro')).toBe(true);
    expect(onValueChange.mock.calls).toEqual([['pro'], ['pro']]);
  });

  it('shows a controlled value again when the owner has no callback', async () => {
    const { rerender } = render(
      <form>
        <RadioGroup.Root aria-label="Plan" value="free">
          <RadioGroup.Item value="free">Free</RadioGroup.Item>
          <RadioGroup.Item value="pro">Pro</RadioGroup.Item>
        </RadioGroup.Root>
      </form>,
    );
    rerender(
      <form>
        <RadioGroup.Root aria-label="Plan" value="pro">
          <RadioGroup.Item value="free">Free</RadioGroup.Item>
          <RadioGroup.Item value="pro">Pro</RadioGroup.Item>
        </RadioGroup.Root>
      </form>,
    );
    await reset(radio('Pro').form!);
    expect(radio('Pro').checked).toBe(true);
    expect(shownChecked('Pro')).toBe(true);
  });
});
