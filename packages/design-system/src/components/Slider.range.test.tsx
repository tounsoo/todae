import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetWarnOnce } from '../internal/warnOnce.js';
import { mount, reset, settle } from '../test/form.js';
import { ErrorMessage } from './ErrorMessage.js';
import { Field } from './Field.js';
import { Fieldset } from './Fieldset.js';
import { Form } from './Form.js';
import { Slider, type SliderRangeValue } from './Slider.client.js';

afterEach(cleanup);

function Pair({
  initial = [20, 80] as SliderRangeValue,
  onValueChange,
}: {
  initial?: SliderRangeValue;
  onValueChange?: (value: SliderRangeValue) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Slider.Root
      mode="range"
      startLabel="Minimum"
      endLabel="Maximum"
      value={value}
      onValueChange={(next) => {
        onValueChange?.(next);
        setValue(next);
      }}
    />
  );
}

describe('Slider.Root range', () => {
  it('keeps a single root as one range input', () => {
    const { rerender } = render(<Slider.Root aria-label="Volume" />);
    const only = screen.getByRole('slider', { name: 'Volume' });
    expect(only.tagName).toBe('INPUT');
    expect(only).toHaveProperty('type', 'range');
    expect(screen.queryByRole('group')).toBeNull();
    expect(only.hasAttribute('mode')).toBe(false);

    rerender(<Slider.Root mode="single" aria-label="Volume" />);
    expect(screen.getAllByRole('slider')).toHaveLength(1);
    expect(screen.getByRole('slider')).toHaveProperty('type', 'range');
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('renders two thumbs, reports a pair, and stops a thumb on the other one', () => {
    const seen: SliderRangeValue[] = [];
    render(<Pair onValueChange={(next) => seen.push(next)} />);
    const start = screen.getByRole('slider', { name: 'Minimum' });
    const end = screen.getByRole('slider', { name: 'Maximum' });
    expect(start).toHaveProperty('min', '0');
    expect(start).toHaveProperty('max', '80');
    expect(start).toHaveProperty('value', '20');
    expect(end).toHaveProperty('min', '20');
    expect(end).toHaveProperty('max', '100');
    expect(end).toHaveProperty('value', '80');
    expect(start.hasAttribute('name')).toBe(false);
    expect(end.hasAttribute('name')).toBe(false);
    expect(document.querySelector('input[type="hidden"]')).toBeNull();

    fireEvent.change(end, { target: { value: '90' } });
    expect(seen).toEqual([[20, 90]]);
    expect(end).toHaveProperty('value', '90');
    expect(start).toHaveProperty('value', '20');

    fireEvent.change(start, { target: { value: '95' } });
    expect(seen.at(-1)).toEqual([90, 90]);
    expect(start).toHaveProperty('value', '90');
    expect(end).toHaveProperty('value', '90');
  });

  it('names the two fields and shows a crossed value repaired, without reporting it', () => {
    const onValueChange = vi.fn();
    render(
      <Slider.Root
        mode="range"
        startLabel="Minimum"
        endLabel="Maximum"
        name={['low', 'high']}
        value={[80, 20]}
        onValueChange={onValueChange}
      />,
    );
    const start = screen.getByRole('slider', { name: 'Minimum' });
    const end = screen.getByRole('slider', { name: 'Maximum' });
    expect(start).toHaveProperty('name', 'low');
    expect(end).toHaveProperty('name', 'high');
    expect(start).toHaveProperty('value', '80');
    expect(end).toHaveProperty('value', '80');
    expect(start).toHaveProperty('max', '80');
    expect(end).toHaveProperty('min', '80');
    expect(onValueChange).not.toHaveBeenCalled();
    expect(document.querySelector('input[type="hidden"]')).toBeNull();
  });

  it('submits the start and the end under the two names', () => {
    render(
      <form>
        <Slider.Root mode="range" startLabel="Minimum" endLabel="Maximum" name={['low', 'high']} defaultValue={[20, 80]} />
      </form>,
    );
    const form = document.querySelector('form');
    if (!(form instanceof HTMLFormElement)) throw new Error('missing form');
    const data = new FormData(form);
    expect(data.get('low')).toBe('20');
    expect(data.get('high')).toBe('80');
  });

  it('restores an uncontrolled range when its form resets, and leaves a controlled one', async () => {
    const { rerender } = render(
      <form>
        <Slider.Root mode="range" startLabel="Minimum" endLabel="Maximum" defaultValue={[20, 80]} />
      </form>,
    );
    fireEvent.change(screen.getByRole('slider', { name: 'Maximum' }), { target: { value: '90' } });
    expect(screen.getByRole('slider', { name: 'Maximum' })).toHaveProperty('value', '90');
    const form = document.querySelector('form');
    if (!(form instanceof HTMLFormElement)) throw new Error('missing form');
    await reset(form);
    expect(screen.getByRole('slider', { name: 'Minimum' })).toHaveProperty('value', '20');
    expect(screen.getByRole('slider', { name: 'Maximum' })).toHaveProperty('value', '80');

    function Held() {
      const [value, setValue] = useState<SliderRangeValue>([20, 80]);
      return (
        <form>
          <Slider.Root mode="range" startLabel="Minimum" endLabel="Maximum" value={value} onValueChange={setValue} />
        </form>
      );
    }
    rerender(<Held />);
    fireEvent.change(screen.getByRole('slider', { name: 'Maximum' }), { target: { value: '90' } });
    expect(screen.getByRole('slider', { name: 'Maximum' })).toHaveProperty('value', '90');
    const held = document.querySelector('form');
    if (!(held instanceof HTMLFormElement)) throw new Error('missing form');
    await reset(held);
    expect(screen.getByRole('slider', { name: 'Maximum' })).toHaveProperty('value', '90');
  });

  it('warns when the default range is crossed and says each thumb in its own words', () => {
    resetWarnOnce();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    render(
      <Slider.Root
        mode="range"
        startLabel="Minimum"
        endLabel="Maximum"
        defaultValue={[80, 20]}
        startValueText="Low"
        endValueText="High"
      />,
    );
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('start is greater'));
    const start = screen.getByRole('slider', { name: 'Minimum' });
    const end = screen.getByRole('slider', { name: 'Maximum' });
    expect(end).toHaveProperty('value', '80');
    expect(start.getAttribute('aria-valuetext')).toBe('Low');
    expect(end.getAttribute('aria-valuetext')).toBe('High');
    expect(screen.getByRole('group').getAttribute('aria-valuetext')).toBeNull();
    warn.mockRestore();
  });

  it('counts a press on the track as an edit of the form', async () => {
    function Price() {
      const [value, setValue] = useState<SliderRangeValue>([20, 80]);
      return (
        <Form.Root errors={{ low: 'Too low.' }}>
          <Field.Group>
            <Slider.Root mode="range" startLabel="Minimum" endLabel="Maximum" name={['low', 'high']} value={value} onValueChange={setValue} />
            <ErrorMessage.Root />
          </Field.Group>
        </Form.Root>
      );
    }
    await mount(<Price />);
    expect(screen.getByText('Too low.')).toBeTruthy();
    const track = screen.getByRole('group');
    vi.spyOn(track, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 100, 16));
    fireEvent.pointerDown(track, { button: 0, clientX: 90, pointerId: 1 });
    await settle();
    expect(screen.getByRole('slider', { name: 'Maximum' })).toHaveProperty('value', '90');
    expect(screen.queryByText('Too low.')).toBeNull();
  });

  it('takes a disabled invalid fieldset on both thumbs', () => {
    render(
      <Fieldset.Root disabled invalid>
        <Fieldset.Legend>Price</Fieldset.Legend>
        <Slider.Root mode="range" startLabel="Minimum" endLabel="Maximum" aria-describedby="hint" />
      </Fieldset.Root>,
    );
    for (const thumb of [screen.getByRole('slider', { name: 'Minimum' }), screen.getByRole('slider', { name: 'Maximum' })]) {
      expect(thumb).toHaveProperty('disabled', true);
      expect(thumb.getAttribute('aria-invalid')).toBe('true');
      expect(thumb.getAttribute('aria-describedby')).toBe('hint');
    }
  });
});
