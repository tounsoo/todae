import { act, cleanup, render, screen } from '@testing-library/react';
import { Suspense, use, useState, type ReactNode } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field, useField } from '../index.js';

afterEach(cleanup);

const noop = () => undefined;

function entries(ui: ReactNode) {
  render(<form data-testid="form">{ui}</form>);
  return [...new FormData(screen.getByTestId('form') as HTMLFormElement).entries()];
}

// What each control sends is the same as when it carried its value in a hidden input.
describe('what a form submits', () => {
  it.each([
    ['a date', <Field.DateInput value={Temporal.PlainDate.from('2026-10-13')} onValueChange={noop} />, '2026-10-13'],
    ['no date', <Field.DateInput value={null} onValueChange={noop} />, ''],
    ['a date past year 9999', <Field.DateInput value={Temporal.PlainDate.from('+020261-10-07')} onValueChange={noop} />, '20261-10-07'],
    ['a time', <Field.TimeInput value={Temporal.PlainTime.from('09:30')} onValueChange={noop} />, '09:30'],
    ['a time with seconds', <Field.TimeInput value={Temporal.PlainTime.from('09:30:15')} onValueChange={noop} />, '09:30:15'],
    ['no time', <Field.TimeInput value={null} onValueChange={noop} />, ''],
    ['a date and time', <Field.DateTimeInput value={Temporal.PlainDateTime.from('2026-10-13T09:30')} onValueChange={noop} />, '2026-10-13T09:30'],
    ['no date and time', <Field.DateTimeInput value={null} onValueChange={noop} />, ''],
    [
      'a range',
      <Field.DateRangeInput value={{ start: Temporal.PlainDate.from('2026-10-03'), end: Temporal.PlainDate.from('2026-10-10') }} onValueChange={noop} />,
      '2026-10-03/2026-10-10',
    ],
    ['no range', <Field.DateRangeInput value={null} onValueChange={noop} />, ''],
  ])('%s', (_, picker, sent) => {
    expect(entries(<Field.Root aria-label="Value" name="v">{picker}</Field.Root>)).toEqual([['v', sent]]);
  });

  it('sends nothing for a typed input with no name, or in a disabled field', () => {
    const day = Temporal.PlainDate.from('2026-10-13');
    expect(entries(<Field.Root aria-label="Value"><Field.DateInput value={day} onValueChange={noop} /></Field.Root>)).toEqual([]);
    cleanup();
    expect(
      entries(
        <Field.Root aria-label="Value" name="v" disabled>
          <Field.DateInput value={day} onValueChange={noop} />
        </Field.Root>,
      ),
    ).toEqual([]);
  });

  it('sends nothing for a Field.Picker, alone or beside a typed input, which sends for both', () => {
    expect(entries(<Field.Root aria-label="Value" name="v"><Field.Picker /></Field.Root>)).toEqual([]);
    cleanup();
    expect(
      entries(
        <Field.Root aria-label="Value" name="v">
          <Field.DateInput value={Temporal.PlainDate.from('2026-10-13')} onValueChange={noop} />
          <Field.Picker />
        </Field.Root>,
      ),
    ).toEqual([['v', '2026-10-13']]);
  });

  it('sends a ChipInput as the text being typed, not its chips', () => {
    expect(
      entries(
        <Field.Root aria-label="Tags" name="tags">
          <Field.ChipInput chips={['a', 'b']} inputValue="dr" onInputValueChange={noop} onCommit={noop} onChipRemove={noop} />
        </Field.Root>,
      ),
    ).toEqual([['tags', 'dr']]);
  });
});

// The server cannot know which control took the field's name, so the control itself says.
describe('on the server', () => {
  function Stars() {
    const field = useField();
    const control = field.getControlProps({ 'aria-label': 'Stars' });
    return (
      <>
        <input {...control} defaultValue="typed" />
        <input {...field.getValueInputProps({ type: 'text', value: '3' }, control)} />
      </>
    );
  }

  it('names the field once when a control that sends is beside its value input', () => {
    const html = renderToString(
      <Field.Root name="stars" aria-label="Stars">
        <Stars />
      </Field.Root>,
    );
    expect(html.match(/name="stars"/g)).toHaveLength(1);
  });

  it('names a ChipInput\'s text and no more, whatever its value input holds', () => {
    const html = renderToString(
      <Field.Root name="tags" aria-label="Tags">
        <Field.ChipInput chips={['a']} inputValue="" onInputValueChange={noop} onCommit={noop} onChipRemove={noop} />
      </Field.Root>,
    );
    expect(html.match(/name="tags"/g)).toHaveLength(1);
  });
});

describe('the field registry across hydration and remounts', () => {
  it('hydrates a picker that suspends beside a text input as the server rendered it', async () => {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
      resolve = done;
    });
    // Suspends on the client only, so the text input registers before the picker hydrates.
    function Gate({ children }: { children: ReactNode }) {
      use(promise);
      return children;
    }
    const tree = (gate: boolean) => (
      <Field.Root name="when">
        <Field.TextInput value="x" onChange={noop} />
        <Suspense fallback={null}>
          {gate ? (
            <Gate>
              <Field.Picker swatch="#3366ff" />
            </Gate>
          ) : (
            <Field.Picker swatch="#3366ff" />
          )}
        </Suspense>
      </Field.Root>
    );
    const host = document.createElement('div');
    document.body.appendChild(host);
    host.innerHTML = renderToString(tree(false));
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const recoverable = vi.fn();
    await act(async () => {
      hydrateRoot(host, tree(true), { onRecoverableError: recoverable });
    });
    await act(async () => resolve());
    expect(error).not.toHaveBeenCalled();
    expect(recoverable).not.toHaveBeenCalled();
    error.mockRestore();
    // Only the text input sends the field's name, and only it has the field's id.
    expect([...host.querySelectorAll('[name]')].map((node) => node.getAttribute('name'))).toEqual(['when']);
    expect(host.querySelector('button')?.hasAttribute('id')).toBe(false);
    host.remove();
  });

  it("keeps the Root's customValidity on the mounted value input when its ref is wrapped by hand", () => {
    // A product's control that wraps the value input's ref, so React calls it with null instead of its cleanup.
    function Slider() {
      const field = useField();
      const control = field.getControlProps({}, { native: false });
      const { ref, ...input } = field.getValueInputProps({ type: 'number', value: '3' }, control);
      return (
        <>
          <div role="slider" aria-valuenow={3} tabIndex={0} {...control} />
          <input
            {...input}
            ref={(node) => {
              ref(node);
            }}
          />
        </>
      );
    }
    function Harness() {
      const [key, setKey] = useState(0);
      return (
        <>
          <button type="button" onClick={() => setKey((n) => n + 1)}>
            Remount
          </button>
          <Field.Root name="level" customValidity="Bad">
            <Slider key={key} />
          </Field.Root>
        </>
      );
    }
    const view = render(<Harness />);
    for (let i = 0; i < 2; i += 1) {
      act(() => screen.getByText('Remount').click());
      const input = view.container.querySelector<HTMLInputElement>('[data-todae-value-input]')!;
      expect(input.validationMessage).toBe('Bad');
    }
  });
});
