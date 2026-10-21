import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCandidates, getTabbables } from '../overlay/tabbables.js';
import { ErrorMessage, Field, Form, Label, useField } from '../index.js';
import { mount, settle, submit } from '../test/form.js';
import { focusTargetFor } from './validity.js';

afterEach(cleanup);

const day = (text: string) => Temporal.PlainDate.from(text);

function DateField({
  initial = null,
  min,
  max,
  required,
}: {
  initial?: Temporal.PlainDate | null;
  min?: Temporal.PlainDate;
  max?: Temporal.PlainDate;
  required?: boolean;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Field.Group>
      <Label.Root htmlFor="start">Start date</Label.Root>
      <Field.Root id="start" name="start">
        <Field.DatePicker value={value} onValueChange={setValue} min={min} max={max} required={required} locale="en-US" />
      </Field.Root>
      <ErrorMessage.Root />
    </Field.Group>
  );
}

function Page({ summary, children }: { summary?: boolean; children: React.ReactNode }) {
  return (
    <Form.Root data-testid="form" onSubmit={(event) => event.preventDefault()}>
      {summary ? <Form.Summary /> : null}
      {children}
      <button type="submit">Send</button>
    </Form.Root>
  );
}

const valueInput = () => document.querySelector<HTMLInputElement>('[data-todae-value-input]')!;

describe('a required date picker in Form.Root', () => {
  it('blocks a submit, shows the required message, and focuses the picker button', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    await mount(
      <Form.Root data-testid="form" onSubmit={onSubmit}>
        <DateField required />
      </Form.Root>,
    );
    await submit(screen.getByTestId('form'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('This field is required')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Start date' });
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-invalid')).toBe('true');
    expect(button.getAttribute('aria-describedby')).toContain(screen.getByText('This field is required').id);
  });

  it('lists a row in the summary whose link targets the button and focuses it', async () => {
    await mount(
      <Page summary>
        <DateField required />
        <Field.Group>
          <Label.Root htmlFor="note">Note</Label.Root>
          <Field.Root id="note" name="note">
            <Field.TextInput required value="" onValueChange={() => undefined} />
          </Field.Root>
        </Field.Group>
      </Page>,
    );
    await submit(screen.getByTestId('form'));
    const summary = screen.getByRole('group', { name: '2 problems to fix' });
    expect(document.activeElement).toBe(summary);
    const button = screen.getByRole('button', { name: 'Start date' });
    const link = screen.getByRole('link', { name: 'Start date' });
    expect(link.getAttribute('href')).toBe(`#${button.id}`);
    await act(async () => {
      fireEvent.click(link);
    });
    expect(document.activeElement).toBe(button);
  });

  it('is valid once a date is picked, and sends it', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    await mount(
      <Form.Root data-testid="form" onSubmit={onSubmit}>
        <DateField initial={day('2026-10-13')} required />
      </Form.Root>,
    );
    await submit(screen.getByTestId('form'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect([...new FormData(screen.getByTestId('form') as HTMLFormElement).entries()]).toEqual([['start', '2026-10-13']]);
  });

  it('puts min and max on the value input as ISO dates', async () => {
    await mount(
      <Form.Root>
        <DateField min={day('2026-10-01')} max={day('2026-10-31')} />
      </Form.Root>,
    );
    expect(valueInput().type).toBe('date');
    expect([valueInput().min, valueInput().max]).toEqual(['2026-10-01', '2026-10-31']);
  });

  it('names a min that is passed in the date style of the picker', async () => {
    await mount(
      <Form.Root data-testid="form" onSubmit={(event) => event.preventDefault()}>
        <DateField initial={day('2026-10-01')} min={day('2026-10-13')} />
      </Form.Root>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByText('Enter Oct 13, 2026 or more')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Start date' }));
  });

  it('names a max that is passed in the date style of the picker', async () => {
    await mount(
      <Form.Root data-testid="form" onSubmit={(event) => event.preventDefault()}>
        <DateField initial={day('2026-11-01')} max={day('2026-10-31')} />
      </Form.Root>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByText('Enter Oct 31, 2026 or less')).toBeTruthy();
  });
});

describe('required on the other pickers', () => {
  it('blocks a submit on a time picker, and on a date and time picker', async () => {
    await mount(
      <Page summary>
        <Field.Group>
          <Label.Root htmlFor="at">At</Label.Root>
          <Field.Root id="at" name="at">
            <Field.TimePicker value={null} required />
          </Field.Root>
        </Field.Group>
        <Field.Group>
          <Label.Root htmlFor="when">When</Label.Root>
          <Field.Root id="when" name="when">
            <Field.DateTimePicker value={null} required />
          </Field.Root>
        </Field.Group>
      </Page>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByRole('group', { name: '2 problems to fix' })).toBeTruthy();
    expect([...document.querySelectorAll<HTMLInputElement>('[data-todae-value-input]')].map((el) => el.type)).toEqual([
      'time',
      'datetime-local',
    ]);
  });

  it('names a time and a date and time bound in the picker style', async () => {
    await mount(
      <Form.Root data-testid="form" onSubmit={(event) => event.preventDefault()}>
        <Field.Group>
          <Label.Root htmlFor="at">At</Label.Root>
          <Field.Root id="at" name="at">
            <Field.TimePicker value={Temporal.PlainTime.from('08:00')} min={Temporal.PlainTime.from('09:30')} locale="en-US" />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </Form.Root>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByText('Enter 9:30 AM or more')).toBeTruthy();
  });
});

function Tags({ initial = [] as string[], required }: { initial?: string[]; required?: boolean }) {
  const [chips, setChips] = useState(initial);
  const [text, setText] = useState('');
  return (
    <Field.Group>
      <Label.Root htmlFor="tags">Tags</Label.Root>
      <Field.Root id="tags" name="tags">
        <Field.ChipInput
          required={required}
          chips={chips}
          inputValue={text}
          onInputValueChange={setText}
          onCommit={(value) => {
            setChips([...chips, value]);
            setText('');
          }}
          onChipRemove={(index) => setChips(chips.filter((_, i) => i !== index))}
        />
      </Field.Root>
      <ErrorMessage.Root />
    </Field.Group>
  );
}

describe('a required ChipInput in Form.Root', () => {
  it('blocks a submit with no chips and focuses the text input, whatever is typed', async () => {
    await mount(
      <Page>
        <Tags required />
      </Page>,
    );
    const input = screen.getByRole('textbox', { name: 'Tags' }) as HTMLInputElement;
    await act(async () => {
      fireEvent.change(input, { target: { value: 'half-typed' } });
    });
    await submit(screen.getByTestId('form'));
    expect(screen.getByText('This field is required')).toBeTruthy();
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-required')).toBe('true');
  });

  it('is valid with a chip, and invalid again when the last one is removed', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    await mount(
      <Form.Root data-testid="form" onSubmit={onSubmit}>
        <Tags required initial={['news']} />
      </Form.Root>,
    );
    await submit(screen.getByTestId('form'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('This field is required')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Remove news/ }));
    });
    await settle();
    expect(screen.getByText('This field is required')).toBeTruthy();
  });

  it('sends the same as before: the text being typed, under the field name, and never the chips', async () => {
    await mount(
      <Form.Root data-testid="form">
        <Tags initial={['a', 'b']} />
      </Form.Root>,
    );
    expect([...new FormData(screen.getByTestId('form') as HTMLFormElement).entries()]).toEqual([['tags', '']]);
    expect(valueInput().name).toBe('');
  });
});

describe('value inputs', () => {
  it('are not tab stops, not candidates, and not what a press on the shell focuses', async () => {
    await mount(
      <Form.Root data-testid="form">
        <DateField />
        <Tags />
      </Form.Root>,
    );
    const form = screen.getByTestId('form');
    expect(form.querySelectorAll('[data-todae-value-input]')).toHaveLength(2);
    for (const el of [...getTabbables(form), ...getCandidates(form)]) expect(el.hasAttribute('data-todae-value-input')).toBe(false);
    expect(getTabbables(form).map((el) => el.tagName)).toEqual(['BUTTON', 'INPUT']);
    // A press on the shell's padding focuses the field's control.
    const shell = screen.getByRole('button', { name: 'Start date' }).parentElement!;
    fireEvent.mouseDown(shell);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Start date' }));
  });

  it('are hidden from assistive technology, and validate like any native input', async () => {
    await mount(
      <Form.Root>
        <DateField />
      </Form.Root>,
    );
    const el = valueInput();
    expect(el.getAttribute('aria-hidden')).toBe('true');
    expect(el.tabIndex).toBe(-1);
    expect(el.readOnly).toBe(false);
    expect(el.willValidate).toBe(true);
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('map to the field control for focus', async () => {
    await mount(
      <Form.Root>
        <DateField />
      </Form.Root>,
    );
    expect(focusTargetFor(valueInput())).toBe(screen.getByRole('button', { name: 'Start date' }));
  });

  it('are disabled with the field, and the problem of a disabled picker stays quiet', async () => {
    await mount(
      <Form.Root data-testid="form" onSubmit={(event) => event.preventDefault()}>
        <Field.Group>
          <Label.Root htmlFor="start">Start date</Label.Root>
          <Field.Root id="start" name="start" disabled>
            <Field.DatePicker value={null} required />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </Form.Root>,
    );
    expect(valueInput().disabled).toBe(true);
    await submit(screen.getByTestId('form'));
    expect(screen.queryByText('This field is required')).toBeNull();
  });
});

describe('useField().getValueInputProps', () => {
  function Stars({ value, required }: { value: number; required?: boolean }) {
    const field = useField();
    return (
      <>
        <span role="slider" tabIndex={0} aria-valuenow={value} {...field.getControlProps({}, { native: false })} />
        <input {...field.getValueInputProps({ type: 'number', value: value ? String(value) : '', required, min: '1', max: '5' })} />
      </>
    );
  }

  it('carries a custom control, validates it, and sends it under the field name', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const { rerender } = await mount(
      <Form.Root data-testid="form" onSubmit={onSubmit}>
        <Field.Group>
          <Label.Root htmlFor="rating">Rating</Label.Root>
          <Field.Root id="rating" name="rating" aria-label="Rating">
            <Stars value={0} required />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </Form.Root>,
    );
    await submit(screen.getByTestId('form'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('This field is required')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('slider'));
    rerender(
      <Form.Root data-testid="form" onSubmit={onSubmit}>
        <Field.Group>
          <Label.Root htmlFor="rating">Rating</Label.Root>
          <Field.Root id="rating" name="rating" aria-label="Rating">
            <Stars value={3} required />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </Form.Root>,
    );
    await settle();
    await submit(screen.getByTestId('form'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect([...new FormData(screen.getByTestId('form') as HTMLFormElement).entries()]).toEqual([['rating', '3']]);
  });

  it('goes without a name when a control already took the field name, and takes it back when that control goes', async () => {
    const tree = (withInput: boolean) => (
      <form data-testid="form">
        <Field.Root name="rating" aria-label="Rating">
          <Stars value={3} />
          {withInput ? <Field.TextInput value="x" onChange={() => undefined} /> : null}
        </Field.Root>
      </form>
    );
    const { rerender } = render(tree(true));
    expect([...new FormData(screen.getByTestId('form') as HTMLFormElement).entries()]).toEqual([['rating', 'x']]);
    rerender(tree(false));
    expect([...new FormData(screen.getByTestId('form') as HTMLFormElement).entries()]).toEqual([['rating', '3']]);
  });
});
