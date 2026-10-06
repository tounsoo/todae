import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { createRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field, Label, useField } from '../index';

afterEach(cleanup);

// A company control that is not a native input.
function Rating({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const field = useField();
  const props = field.getControlProps({ 'aria-describedby': 'own-hint' }, { native: false });
  const { disabled } = field;
  return (
    <div
      {...props}
      role="slider"
      tabIndex={disabled ? -1 : 0}
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
    // A div submits nothing, so a non-native control gets no name.
    expect(slider.hasAttribute('name')).toBe(false);
    expect(slider.getAttribute('aria-describedby')).toBe('root-hint own-hint');
    expect(slider.hasAttribute('aria-invalid')).toBe(false);
    expect(slider.hasAttribute('data-todae-field-control')).toBe(true);
  });

  it('reports disabled and invalid', () => {
    render(<Harness disabled invalid />);
    const slider = screen.getByRole('slider');
    expect(slider.getAttribute('aria-disabled')).toBe('true');
    expect(slider.hasAttribute('disabled')).toBe(false);
    expect(slider.getAttribute('aria-invalid')).toBe('true');
  });

  it("adds a control's own disabled and aria-invalid to the Root's", () => {
    function Own({ busy, error }: { busy?: boolean; error?: 'true' | 'spelling' }) {
      const field = useField();
      return <input {...field.getControlProps({ disabled: busy, 'aria-invalid': error })} />;
    }
    const { rerender } = render(
      <Field.Root aria-label="Own">
        <Own busy error="spelling" />
      </Field.Root>,
    );
    const input = () => screen.getByRole('textbox') as HTMLInputElement;
    expect(input().disabled).toBe(true);
    expect(input().getAttribute('aria-invalid')).toBe('spelling');
    rerender(
      <Field.Root aria-label="Own" invalid>
        <Own error="spelling" />
      </Field.Root>,
    );
    expect(input().disabled).toBe(false);
    expect(input().getAttribute('aria-invalid')).toBe('true');
  });

  it('a control that unmounts leaves a sibling control focusable from the shell', () => {
    function Custom({ label }: { label: string }) {
      const field = useField();
      return <span {...field.getControlProps({}, { native: false })} role="slider" aria-label={label} tabIndex={0} />;
    }
    function Both({ second }: { second: boolean }) {
      return (
        <Field.Root aria-label="Both" data-testid="shell">
          {second ? <Custom label="second" /> : null}
          <Custom label="first" />
        </Field.Root>
      );
    }
    // The first control mounts last, so the Root's ref points at it.
    const { rerender } = render(<Both second={false} />);
    rerender(<Both second />);
    rerender(<Both second={false} />);
    fireEvent.mouseDown(screen.getByTestId('shell'));
    expect(document.activeElement).toBe(screen.getByRole('slider', { name: 'first' }));
  });

  it('a text input that re-renders does not take the shell press from a later control', () => {
    function Custom() {
      const field = useField();
      return <span {...field.getControlProps({}, { native: false })} role="slider" aria-label="custom" tabIndex={0} />;
    }
    function Both({ text }: { text: string }) {
      return (
        <Field.Root aria-label="Both" data-testid="shell">
          <Field.TextInput value={text} onChange={() => {}} />
          <Custom />
        </Field.Root>
      );
    }
    const { rerender } = render(<Both text="a" />);
    rerender(<Both text="b" />);
    fireEvent.mouseDown(screen.getByTestId('shell'));
    expect(document.activeElement).toBe(screen.getByRole('slider'));
  });

  it('a press inside a custom control keeps its default, for caret and selection', () => {
    function Editable() {
      const field = useField();
      return <div {...field.getControlProps({}, { native: false })} contentEditable suppressContentEditableWarning role="textbox" aria-label="note">text</div>;
    }
    render(
      <Field.Root aria-label="Note">
        <Editable />
      </Field.Root>,
    );
    expect(fireEvent.mouseDown(screen.getByRole('textbox'))).toBe(true);
  });

  it('ChipInput refocuses its own input after a chip is removed, beside another control', () => {
    function Custom() {
      const field = useField();
      return <span {...field.getControlProps({}, { native: false })} role="slider" aria-label="custom" tabIndex={0} />;
    }
    render(
      <Field.Root aria-label="Tags">
        <Field.ChipInput
          chips={['one']}
          inputValue=""
          onInputValueChange={() => {}}
          onCommit={() => {}}
          onChipRemove={() => {}}
          chipDismissLabel={(v) => `Remove ${v}`}
        />
        <Custom />
      </Field.Root>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove one' }));
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });

  it('Field.Select works with onValueChange alone', () => {
    const onValueChange = vi.fn();
    render(
      <Field.Root aria-label="Size">
        <Field.Select value="s" onValueChange={onValueChange}>
          <option value="s">Small</option>
          <option value="m">Medium</option>
        </Field.Select>
      </Field.Root>,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'm' } });
    expect(onValueChange).toHaveBeenCalledWith('m');
  });

  it('a press on non-editable content still focuses the control', () => {
    render(
      <Field.Root aria-label="Amount">
        <Field.Affix>
          <span contentEditable={false} data-testid="unit">
            kg
          </span>
        </Field.Affix>
        <Field.TextInput value="" onChange={() => {}} />
      </Field.Root>,
    );
    fireEvent.mouseDown(screen.getByTestId('unit'));
    expect(document.activeElement).toBe(screen.getByRole('textbox'));
  });

  it('a shell press never falls back to an input inside an Affix', () => {
    function Custom() {
      const field = useField();
      return <span {...field.getControlProps({}, { native: false })} role="slider" aria-label="custom" tabIndex={0} />;
    }
    function Shell({ custom }: { custom: boolean }) {
      return (
        <Field.Root aria-label="Shell" data-testid="shell">
          <Field.Affix>
            <input aria-label="unit" />
          </Field.Affix>
          <Field.TextInput value="" onChange={() => {}} aria-label="main" />
          {custom ? <Custom /> : null}
        </Field.Root>
      );
    }
    const { rerender } = render(<Shell custom />);
    rerender(<Shell custom={false} />);
    fireEvent.mouseDown(screen.getByTestId('shell'));
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'main' }));
  });

  it("does not reattach a control's ref on every render", () => {
    const attach = vi.fn();
    const { rerender } = render(
      <Field.Root aria-label="Size" data-tick={1}>
        <Field.Select value="s" onChange={() => {}} ref={attach}>
          <option value="s">Small</option>
        </Field.Select>
      </Field.Root>,
    );
    rerender(
      <Field.Root aria-label="Size" data-tick={2}>
        <Field.Select value="s" onChange={() => {}} ref={attach}>
          <option value="s">Small</option>
        </Field.Select>
      </Field.Root>,
    );
    expect(attach).toHaveBeenCalledTimes(1);
  });

  it('gives a native control name and disabled, and no aria-disabled', () => {
    function Native() {
      const field = useField();
      return <input {...field.getControlProps()} />;
    }
    render(
      <Field.Root aria-label="Native" name="n" disabled>
        <Native />
      </Field.Root>,
    );
    const input = screen.getByRole('textbox');
    expect(input.getAttribute('name')).toBe('n');
    expect((input as HTMLInputElement).disabled).toBe(true);
    expect(input.hasAttribute('aria-disabled')).toBe(false);
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
