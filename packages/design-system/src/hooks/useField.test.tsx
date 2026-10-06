import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field, Label, useField } from '../index';

afterEach(cleanup);

// A company control that is not a native input.
function Rating({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const field = useField();
  const props = field.getControlProps({ 'aria-describedby': 'own-hint' });
  const { disabled, ...rest } = props;
  return (
    <div
      {...rest}
      role="slider"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled || undefined}
      aria-valuemin={0}
      aria-valuemax={5}
      aria-valuenow={value}
      onKeyDown={(event) => {
        if (!disabled && event.key === 'ArrowRight') onChange(Math.min(5, value + 1));
      }}
    />
  );
}

function Harness({ disabled, invalid }: { disabled?: boolean; invalid?: boolean }) {
  const [value, setValue] = useState(2);
  return (
    <>
      <Label htmlFor="rating">Rating</Label>
      <Field.Root id="rating" name="rating" aria-describedby="root-hint" disabled={disabled} invalid={invalid} data-testid="shell">
        <Rating value={value} onChange={setValue} />
      </Field.Root>
      <span id="root-hint">Hint</span>
      <span id="own-hint">Own</span>
    </>
  );
}

describe('useField', () => {
  it('gives a custom control the Root id, name and description', () => {
    render(<Harness />);
    const slider = screen.getByRole('slider');
    expect(slider.id).toBe('rating');
    expect(slider.getAttribute('name')).toBe('rating');
    expect(slider.getAttribute('aria-describedby')).toBe('root-hint own-hint');
    expect(slider.hasAttribute('aria-invalid')).toBe(false);
    expect(slider.hasAttribute('data-todae-field-control')).toBe(true);
  });

  it('reports disabled and invalid', () => {
    render(<Harness disabled invalid />);
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-disabled')).toBe('true');
    expect(slider.getAttribute('aria-invalid')).toBe('true');
  });

  it('a press on the shell focuses the control', () => {
    render(<Harness />);
    fireEvent.mouseDown(screen.getByTestId('shell'));
    expect(document.activeElement).toBe(screen.getByRole('slider'));
  });

  it('passes the Root name unless the control names itself', () => {
    function Named({ own }: { own?: string }) {
      return (
        <Field.Root aria-label="From root">
          <Probe own={own} />
        </Field.Root>
      );
    }
    function Probe({ own }: { own?: string }) {
      const field = useField();
      return <input {...field.getControlProps({ 'aria-label': own })} />;
    }
    const { rerender } = render(<Named />);
    expect(screen.getByRole('textbox').getAttribute('aria-label')).toBe('From root');
    rerender(<Named own="Own name" />);
    expect(screen.getByRole('textbox').getAttribute('aria-label')).toBe('Own name');
  });

  it('keeps the consumer ref', () => {
    const ref = createRef<HTMLInputElement>();
    function Probe() {
      const field = useField();
      return <input {...field.getControlProps({ ref })} aria-label="x" />;
    }
    render(
      <Field.Root>
        <Probe />
      </Field.Root>,
    );
    expect(ref.current).toBe(screen.getByRole('textbox'));
  });

  it('throws outside Field.Root', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Probe() {
      useField();
      return null;
    }
    expect(() => render(<Probe />)).toThrow('Field parts must be rendered inside Field.Root');
    spy.mockRestore();
  });
});

describe('Field.Select', () => {
  function Size({ onValueChange }: { onValueChange?: (value: string) => void }) {
    const [value, setValue] = useState('m');
    return (
      <>
        <Label htmlFor="size">Size</Label>
        <Field.Root id="size" name="size">
          <Field.Select value={value} onChange={(event) => setValue(event.target.value)} onValueChange={onValueChange}>
            <option value="s">Small</option>
            <option value="m">Medium</option>
            <option value="l" disabled>
              Large
            </option>
          </Field.Select>
        </Field.Root>
      </>
    );
  }

  it('is a labelled native select that changes value', () => {
    const onValueChange = vi.fn();
    render(<Size onValueChange={onValueChange} />);
    const select = screen.getByRole('combobox', { name: 'Size' }) as HTMLSelectElement;
    expect(select.tagName).toBe('SELECT');
    expect(select.value).toBe('m');
    expect(select.name).toBe('size');
    fireEvent.change(select, { target: { value: 's' } });
    expect(select.value).toBe('s');
    expect(onValueChange).toHaveBeenCalledWith('s');
  });

  it('takes disabled and invalid from the Root', () => {
    render(
      <Field.Root aria-label="Size" disabled invalid>
        <Field.Select value="a" onChange={() => undefined}>
          <option value="a">A</option>
        </Field.Select>
      </Field.Root>,
    );
    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select.disabled).toBe(true);
    expect(select.getAttribute('aria-invalid')).toBe('true');
  });
});

describe('useField identity', () => {
  it('keeps getControlProps stable across Root renders with the same props', () => {
    const seen = new Set<unknown>();
    function Probe() {
      const field = useField();
      seen.add(field.getControlProps);
      return <input {...field.getControlProps()} aria-label="x" />;
    }
    function Owner({ tick }: { tick: number }) {
      return (
        <Field.Root data-tick={tick}>
          <Probe />
        </Field.Root>
      );
    }
    const { rerender } = render(<Owner tick={1} />);
    rerender(<Owner tick={2} />);
    expect(seen.size).toBe(1);
  });
});
