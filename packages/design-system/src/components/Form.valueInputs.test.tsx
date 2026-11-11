import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { Profiler, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCandidates, getTabbables } from '../overlay/tabbables.js';
import {
  Calendar,
  ColorPicker,
  ErrorMessage,
  Field,
  Form,
  Label,
  useField,
  type DateRange,
  type FieldControlUserProps,
} from '../index.js';
import { mount, settle, submit } from '../test/form.js';
import { focusTargetFor } from './validity.js';
import { resetWarnOnce } from '../internal/warnOnce.js';

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
        <Field.DateInput value={value} onValueChange={setValue} min={min} max={max} required={required} locale="en-US" />
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

describe('a required Field.DateInput in Form.Root', () => {
  it('blocks a submit, shows the required message, and focuses the text input', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    await mount(
      <Form.Root data-testid="form" onSubmit={onSubmit}>
        <DateField required />
      </Form.Root>,
    );
    await submit(screen.getByTestId('form'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('This field is required')).toBeTruthy();
    const button = screen.getByRole('textbox', { name: 'Start date' });
    expect(document.activeElement).toBe(button);
    expect(button.getAttribute('aria-invalid')).toBe('true');
    expect(button.getAttribute('aria-describedby')).toContain(screen.getByText('This field is required').id);
  });

  it('lists a row in the summary whose link targets the text input and focuses it', async () => {
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
    const button = screen.getByRole('textbox', { name: 'Start date' });
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

  it('names a min that is passed as the input writes a date', async () => {
    await mount(
      <Form.Root data-testid="form" onSubmit={(event) => event.preventDefault()}>
        <DateField initial={day('2026-10-01')} min={day('2026-10-13')} />
      </Form.Root>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByText('Enter 10/13/2026 or later')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Start date' }));
  });

  it('names a max that is passed as the input writes a date', async () => {
    await mount(
      <Form.Root data-testid="form" onSubmit={(event) => event.preventDefault()}>
        <DateField initial={day('2026-11-01')} max={day('2026-10-31')} />
      </Form.Root>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByText('Enter 10/31/2026 or earlier')).toBeTruthy();
  });
});

describe('required on the other typed inputs', () => {
  it('blocks a submit on a time input, and on a date and time input', async () => {
    await mount(
      <Page summary>
        <Field.Group>
          <Label.Root htmlFor="at">At</Label.Root>
          <Field.Root id="at" name="at">
            <Field.TimeInput value={null} onValueChange={() => undefined} required />
          </Field.Root>
        </Field.Group>
        <Field.Group>
          <Label.Root htmlFor="when">When</Label.Root>
          <Field.Root id="when" name="when">
            <Field.DateTimeInput value={null} onValueChange={() => undefined} required />
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

  it('names a time bound as the input writes a time', async () => {
    await mount(
      <Form.Root data-testid="form" onSubmit={(event) => event.preventDefault()}>
        <Field.Group>
          <Label.Root htmlFor="at">At</Label.Root>
          <Field.Root id="at" name="at">
            <Field.TimeInput value={Temporal.PlainTime.from('08:00')} onValueChange={() => undefined} min={Temporal.PlainTime.from('09:30')} locale="en-US" />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </Form.Root>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByText('Enter 9:30 AM or later')).toBeTruthy();
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
    // A text box is not required of its chips: the string says so through aria-describedby.
    expect(input.hasAttribute('aria-required')).toBe(false);
    expect(input.getAttribute('aria-describedby')?.split(' ').map((id) => document.getElementById(id)?.textContent)).toContain('Required');
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
    expect(getTabbables(form).map((el) => el.tagName)).toEqual(['INPUT', 'INPUT']);
    // A press on the shell's padding focuses the field's control.
    const shell = screen.getByRole('textbox', { name: 'Start date' }).parentElement!;
    fireEvent.mouseDown(shell);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Start date' }));
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
    expect(screen.getAllByRole('textbox')).toEqual([screen.getByRole('textbox', { name: 'Start date' })]);
  });

  it('map to the field control for focus', async () => {
    await mount(
      <Form.Root>
        <DateField />
      </Form.Root>,
    );
    expect(focusTargetFor(valueInput())).toBe(screen.getByRole('textbox', { name: 'Start date' }));
  });

  it('are disabled with the field, and the problem of a disabled input stays quiet', async () => {
    await mount(
      <Form.Root data-testid="form" onSubmit={(event) => event.preventDefault()}>
        <Field.Group>
          <Label.Root htmlFor="start">Start date</Label.Root>
          <Field.Root id="start" name="start" disabled>
            <Field.DateInput value={null} onValueChange={() => undefined} required />
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
    const control = field.getControlProps({}, { native: false });
    return (
      <>
        <span role="slider" tabIndex={0} aria-valuenow={value} {...control} />
        <input {...field.getValueInputProps({ type: 'number', value: value ? String(value) : '', required, min: '1', max: '5' }, control)} />
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

describe('a value input speaks for its own control', () => {
  function Rating({ required }: { required?: boolean }) {
    const field = useField();
    const control = field.getControlProps({ 'aria-label': 'Rating' }, { native: false });
    return (
      <>
        <span role="slider" tabIndex={0} aria-valuenow={0} {...control} />
        <input {...field.getValueInputProps({ type: 'number', value: '', required }, control)} />
      </>
    );
  }

  it('focuses a custom control beside a text input, not the control that mounted last, and names it in the summary', async () => {
    await mount(
      <Form.Root data-testid="form" onSubmit={(event) => event.preventDefault()}>
        <Form.Summary />
        <Field.Group>
          <Field.Root name="review" aria-label="Review">
            <Rating required />
            <Field.TextInput aria-label="Note" value="" onValueChange={() => undefined} />
          </Field.Root>
        </Field.Group>
        <button type="submit">Send</button>
      </Form.Root>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByRole('link', { name: 'Rating' })).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: 'Rating' }));
    });
    expect(document.activeElement).toBe(screen.getByRole('slider'));
  });

  it('focuses a ChipInput\'s own text input', async () => {
    await mount(
      <Page>
        <Tags required />
      </Page>,
    );
    expect(focusTargetFor(valueInput())).toBe(screen.getByRole('textbox', { name: 'Tags' }));
  });
});

describe('one decision for disabled, form and name', () => {
  it('does not block a submit when the control it speaks for is disabled', async () => {
    function Gauge({ ariaOnly }: { ariaOnly?: boolean }) {
      const field = useField();
      const control = field.getControlProps(ariaOnly ? { 'aria-disabled': true } : { disabled: true }, { native: false });
      return (
        <>
          <span role="slider" tabIndex={0} {...control} />
          <input {...field.getValueInputProps({ type: 'number', value: '', required: true }, control)} />
        </>
      );
    }
    for (const ariaOnly of [false, true]) {
      const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
      const { unmount } = await mount(
        <Form.Root data-testid="form" onSubmit={onSubmit}>
          <Field.Root name="gauge" aria-label="Gauge">
            <Gauge ariaOnly={ariaOnly} />
          </Field.Root>
        </Form.Root>,
      );
      expect(valueInput().disabled).toBe(true);
      await submit(screen.getByTestId('form'));
      expect(onSubmit).toHaveBeenCalledTimes(1);
      unmount();
    }
  });

  it('belongs to the form a ChipInput names, not its ancestor, so that form is the one it blocks', async () => {
    await mount(
      <>
        <form id="other" data-testid="other" />
        <Form.Root data-testid="form">
          <Field.Root name="tags" aria-label="Tags">
            <Field.ChipInput form="other" required chips={[]} inputValue="" onInputValueChange={() => undefined} onCommit={() => undefined} onChipRemove={() => undefined} />
          </Field.Root>
        </Form.Root>
      </>,
    );
    expect(valueInput().form).toBe(screen.getByTestId('other'));
    expect((screen.getByTestId('other') as HTMLFormElement).checkValidity()).toBe(false);
    expect((screen.getByTestId('form') as HTMLFormElement).checkValidity()).toBe(true);
  });

  it('carries a ChipInput as one when there are chips and none otherwise', async () => {
    const { rerender } = await mount(<Form.Root><Tags initial={['a', 'b']} /></Form.Root>);
    expect(valueInput().value).toBe('1');
    expect(valueInput().autocomplete).toBe('off');
    rerender(<Form.Root><Tags key="empty" /></Form.Root>);
    expect(valueInput().value).toBe('');
  });
});

describe('customValidity on a Field.Root with a typed input', () => {
  it('blocks a submit and shows the message', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    await mount(
      <Form.Root data-testid="form" onSubmit={onSubmit}>
        <Field.Group>
          <Label.Root htmlFor="start">Start date</Label.Root>
          <Field.Root id="start" name="start" customValidity="Pick a weekday">
            <Field.DateInput value={day('2026-10-10')} onValueChange={() => undefined} locale="en-US" />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </Form.Root>,
    );
    // The field's control is the native text input, so the message is on it, not on the value input.
    expect((screen.getByRole('textbox', { name: 'Start date' }) as HTMLInputElement).validationMessage).toBe('Pick a weekday');
    expect(valueInput().validationMessage).toBe('');
    await submit(screen.getByTestId('form'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Pick a weekday')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Start date' }));
  });
});

describe('a bound beyond year 9999', () => {
  it('is named as the input writes it, not as the browser text', async () => {
    await mount(
      <Form.Root data-testid="form" onSubmit={(event) => event.preventDefault()}>
        <DateField initial={day('+020261-10-01')} min={day('+020261-10-07')} />
      </Form.Root>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByText('Enter 10/7/20261 or later')).toBeTruthy();
  });
});

describe('a required Field.DateRangeInput in Form.Root', () => {
  it('blocks a submit with no range and focuses the text input, and sends a range as an ISO 8601 interval', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    function Stay() {
      const [value, setValue] = useState<DateRange | null>(null);
      return (
        <Form.Root data-testid="form" onSubmit={onSubmit}>
          <Field.Group>
            <Label.Root htmlFor="stay">Stay</Label.Root>
            <Field.Root id="stay" name="stay">
              <Field.DateRangeInput value={value} onValueChange={setValue} required locale="en-US" />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
          <button type="button" onClick={() => setValue({ start: day('2026-10-03'), end: day('2026-10-10') })}>
            Pick
          </button>
        </Form.Root>
      );
    }
    await mount(<Stay />);
    expect(valueInput().type).toBe('text');
    await submit(screen.getByTestId('form'));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('This field is required')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Stay' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pick' }));
    await settle();
    expect([...new FormData(screen.getByTestId('form') as HTMLFormElement).entries()]).toEqual([
      ['stay', '2026-10-03/2026-10-10'],
    ]);
    await submit(screen.getByTestId('form'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});

describe('a required typed input', () => {
  it.each([
    ['date', <Field.DateInput key="d" value={null} onValueChange={() => undefined} required />],
    ['time', <Field.TimeInput key="t" value={null} onValueChange={() => undefined} required />],
    ['date and time', <Field.DateTimeInput key="dt" value={null} onValueChange={() => undefined} required />],
    ['range', <Field.DateRangeInput key="r" value={null} onValueChange={() => undefined} required />],
  ])('says its %s text input is required, and leaves the Field.Picker beside it undescribed', async (_, input) => {
    await mount(
      <Field.Root aria-label="When" name="when">
        {input}
        <Field.Picker />
      </Field.Root>,
    );
    expect(screen.getByRole('textbox').getAttribute('aria-required')).toBe('true');
    expect(screen.getByRole('button').hasAttribute('aria-describedby')).toBe(false);
    expect(screen.queryByText('Required')).toBeNull();
  });

  it('is not said to be required when it is not', async () => {
    await mount(<Field.Root aria-label="When" name="when"><Field.DateInput value={null} onValueChange={() => undefined} /></Field.Root>);
    expect(screen.getByRole('textbox').hasAttribute('aria-required')).toBe(false);
  });
});

describe('a person\'s change of a value input', () => {
  function Pick({ errors, children }: { errors?: Record<string, string>; children?: React.ReactNode }) {
    const [value, setValue] = useState<Temporal.PlainDate | null>(day('2026-10-13'));
    return (
      <Form.Root data-testid="form" errors={errors}>
        <Field.Group>
          <Label.Root htmlFor="start">Start date</Label.Root>
          <Field.Root id="start" name="start">
            <Field.DateInput value={value} onValueChange={setValue} locale="en-US" />
            <Field.Picker>
              <Calendar.Root value={value} onValueChange={setValue} locale="en-US">
                <Calendar.Header />
                <Calendar.Grid />
              </Calendar.Root>
            </Field.Picker>
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
        {children}
      </Form.Root>
    );
  }

  it('dismisses a server error on the name it carries when a date is picked', async () => {
    await mount(<Pick errors={{ start: 'Booked out.' }} />);
    expect(screen.getByText('Booked out.')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Choose date' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Wednesday, October 14, 2026' }));
    });
    await settle();
    expect(screen.queryByText('Booked out.')).toBeNull();
  });

  it('dismisses a server error on the name of a ChipInput when a chip is added or removed', async () => {
    function Chips({ errors }: { errors: Record<string, string> }) {
      const [chips, setChips] = useState(['a']);
      return (
        <Form.Root data-testid="form" errors={errors}>
          <Field.Group>
            <Label.Root htmlFor="tags">Tags</Label.Root>
            <Field.Root id="tags" name="tags">
              <Field.ChipInput
                chips={chips}
                inputValue="b"
                onInputValueChange={() => undefined}
                onCommit={(value) => setChips([...chips, value])}
                onChipRemove={(index) => setChips(chips.filter((_, i) => i !== index))}
              />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
        </Form.Root>
      );
    }
    const { rerender } = await mount(<Chips errors={{ tags: 'Too many.' }} />);
    expect(screen.getByText('Too many.')).toBeTruthy();
    await act(async () => {
      fireEvent.keyDown(screen.getByRole('textbox', { name: 'Tags' }), { key: 'Enter' });
    });
    expect(screen.queryByText('Too many.')).toBeNull();
    rerender(<Chips key="again" errors={{ tags: 'Too many.' }} />);
    await settle();
    expect(screen.getByText('Too many.')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Remove a/ }));
    });
    expect(screen.queryByText('Too many.')).toBeNull();
  });

  it('is not what a value the product sets is: the server error stays, and nothing fires on the form', async () => {
    const onChange = vi.fn();
    function Reply() {
      const [errors, setErrors] = useState<Record<string, string> | undefined>();
      const [value, setValue] = useState<Temporal.PlainDate | null>(day('2026-10-13'));
      return (
        <Form.Root data-testid="form" errors={errors} onChange={onChange}>
          <Field.Group>
            <Label.Root htmlFor="start">Start date</Label.Root>
            <Field.Root id="start" name="start">
              <Field.DateInput value={value} onValueChange={setValue} locale="en-US" />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
          <button
            type="button"
            onClick={() => {
              setErrors({ start: 'Fully booked, pick another' });
              setValue(null);
            }}
          >
            Reply
          </button>
        </Form.Root>
      );
    }
    await mount(<Reply />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Reply' }));
    });
    await settle();
    expect(screen.getByText('Fully booked, pick another')).toBeTruthy();
    expect(valueInput().value).toBe('');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('is not what an onSubmit that sets the value is: the reply still gets focus', async () => {
    function Booking() {
      const [errors, setErrors] = useState<Record<string, string> | undefined>();
      const [value, setValue] = useState<Temporal.PlainDate | null>(day('2026-10-13'));
      return (
        <Form.Root
          data-testid="form"
          errors={errors}
          onSubmit={(event) => {
            event.preventDefault();
            setErrors({});
            setValue(day('2026-10-20'));
            setTimeout(() => setErrors({ start: 'Fully booked, pick another' }));
          }}
        >
          <Field.Group>
            <Label.Root htmlFor="start">Start date</Label.Root>
            <Field.Root id="start" name="start">
              <Field.DateInput value={value} onValueChange={setValue} locale="en-US" />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
        </Form.Root>
      );
    }
    await mount(<Booking />);
    await submit(screen.getByTestId('form'));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve));
    });
    expect(screen.getByText('Fully booked, pick another')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Start date' }));
  });
});

describe('a focus on a value input', () => {
  it('goes on to the control it speaks for', async () => {
    await mount(
      <Form.Root>
        <DateField />
      </Form.Root>,
    );
    await act(async () => {
      valueInput().focus();
    });
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Start date' }));
  });
});

describe('a year a date input cannot hold', () => {
  it('warns once in development, for a value or a bound', async () => {
    resetWarnOnce();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await mount(
      <Form.Root>
        <DateField initial={day('0000-06-01')} min={day('-000010-01-01')} max={day('+275000-01-01')} />
      </Form.Root>,
    );
    const messages = warn.mock.calls.map((call) => String(call[0])).filter((text) => text.includes('275760'));
    expect(messages).toHaveLength(1);
    warn.mockRestore();
  });
});

describe('a typed input beside another control', () => {
  const note = <Field.TextInput key="note" aria-label="Note" value="x" onValueChange={() => undefined} />;
  const picker = <Field.DateInput key="day" aria-label="Day" value={null} onValueChange={() => undefined} required locale="en-US" />;

  it.each([
    ['the text input first', [note, picker]],
    ['the typed input first', [picker, note]],
  ])('owns its value input with %s: focus and the summary row go to it', async (_, children) => {
    await mount(
      <Form.Root data-testid="form" onSubmit={(event) => event.preventDefault()}>
        <Field.Group>
          <Field.Root name="when" aria-label="When">
            {children}
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </Form.Root>,
    );
    await submit(screen.getByTestId('form'));
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Day' }));
  });

  it.each([
    ['the text input first', [note, picker]],
    ['the typed input first', [picker, note]],
  ])('has a summary row named by it, with %s, that focuses it', async (_, children) => {
    await mount(
      <Form.Root data-testid="form" onSubmit={(event) => event.preventDefault()}>
        <Form.Summary />
        <Field.Group>
          <Field.Root name="when" aria-label="When">
            {children}
          </Field.Root>
        </Field.Group>
      </Form.Root>,
    );
    const input = screen.getByRole('textbox', { name: 'Day' });
    await submit(screen.getByTestId('form'));
    await act(async () => {
      fireEvent.click(within(screen.getByRole('list')).getByRole('link', { name: 'Day' }));
    });
    expect(document.activeElement).toBe(input);
  });

  it('puts the field\'s customValidity on the control the shell focuses, the last to mount, and not on a value input', async () => {
    await mount(
      <Form.Root>
        <Field.Root name="when" aria-label="When" customValidity="Not now">
          {note}
          {picker}
        </Field.Root>
      </Form.Root>,
    );
    expect((screen.getByRole('textbox', { name: 'Day' }) as HTMLInputElement).validationMessage).toBe('Not now');
    expect((screen.getByRole('textbox', { name: 'Note' }) as HTMLInputElement).validationMessage).toBe('');
    expect(valueInput().validationMessage).not.toBe('Not now');
  });
});

describe('a value input with no control to speak for', () => {
  it('gives focus up rather than keep it', async () => {
    function Bare() {
      const field = useField();
      return <input {...field.getValueInputProps({ type: 'text', value: '' }, field.getControlProps())} />;
    }
    await mount(
      <Field.Root name="bare" aria-label="Bare">
        <Bare />
      </Field.Root>,
    );
    await act(async () => {
      valueInput().focus();
    });
    expect(document.activeElement).not.toBe(valueInput());
  });
});

describe('the control\'s props a value input is given', () => {
  type Own = FieldControlUserProps & { form?: string };
  function Custom({ control }: { control: Own }) {
    const field = useField();
    return <input {...field.getValueInputProps({ type: 'text', value: 'x' }, field.getControlProps(control))} />;
  }
  const mountCustom = (control: Own) =>
    mount(
      <Field.Root name="custom" aria-label="Custom">
        <Custom control={control} />
      </Field.Root>,
    );

  it.each<[string, Own]>([
    ['disabled', { disabled: true }],
    ['aria-disabled', { 'aria-disabled': 'true' }],
  ])('disable it by %s', async (_, control) => {
    await mountCustom(control);
    expect(valueInput().disabled).toBe(true);
  });

  it('joins the form it names, and goes without a name when the control has one', async () => {
    await mountCustom({ form: 'other', name: 'own' });
    expect(valueInput().getAttribute('form')).toBe('other');
    expect(valueInput().hasAttribute('name')).toBe(false);
  });

  it('follows a control whose disabled changes, however its parts render', async () => {
    function Gauge({ off }: { off: boolean }) {
      const field = useField();
      const control = field.getControlProps({ disabled: off }, { native: false });
      return (
        <>
          <span role="slider" {...control} />
          <input {...field.getValueInputProps({ type: 'number', value: '' }, control)} />
        </>
      );
    }
    const tree = (off: boolean) => (
      <Field.Root name="gauge" aria-label="Gauge">
        <Gauge off={off} />
      </Field.Root>
    );
    const { rerender } = await mount(tree(false));
    expect(valueInput().disabled).toBe(false);
    rerender(tree(true));
    expect(valueInput().disabled).toBe(true);
    rerender(tree(false));
    expect(valueInput().disabled).toBe(false);
  });
});

describe('customValidity on a field with two typed inputs', () => {
  it.each([
    ['date first', [<Field.DateInput key="d" aria-label="Day" value={null} onValueChange={() => undefined} />, <Field.TimeInput key="t" aria-label="Time" value={null} onValueChange={() => undefined} />], 'Time'],
    ['time first', [<Field.TimeInput key="t" aria-label="Time" value={null} onValueChange={() => undefined} />, <Field.DateInput key="d" aria-label="Day" value={null} onValueChange={() => undefined} />], 'Day'],
  ])('goes on the text input of the one that mounted last, %s, and on no value input', async (_, children, last) => {
    await mount(
      <Form.Root>
        <Field.Root name="when" aria-label="When" customValidity="Not now">
          {children}
        </Field.Root>
      </Form.Root>,
    );
    expect((screen.getByRole('textbox', { name: last }) as HTMLInputElement).validationMessage).toBe('Not now');
    const inputs = [...document.querySelectorAll<HTMLInputElement>('[data-todae-value-input]')];
    expect(inputs.map((el) => el.validationMessage)).toEqual(['', '']);
  });
});

describe('what a control re-renders for', () => {
  it('is only the field\'s name being taken, not another control mounting', async () => {
    let renders = 0;
    function Counted() {
      const field = useField();
      renders += 1;
      const control = field.getControlProps({ name: 'counted' });
      return <input {...control} defaultValue="" aria-label="Counted" />;
    }
    const tree = (withOther: boolean) => (
      <Field.Root name="f" aria-label="F">
        <Counted />
        {withOther ? <Field.TextInput name="other" aria-label="Other" value="" onValueChange={() => undefined} /> : null}
      </Field.Root>
    );
    const { rerender } = await mount(tree(false));
    // Neither its own mount nor a control that does not take the field's name flips what it reads.
    expect(renders).toBe(1);
    rerender(tree(true));
    await settle();
    expect(renders).toBe(2);
  });
});

describe('a pick beside a named control', () => {
  function Beside({ picker, errors = { when: 'Booked out.' } }: { picker: React.ReactNode; errors?: Record<string, string> }) {
    const [text, setText] = useState('');
    return (
      <Form.Root data-testid="form" errors={errors}>
        <Field.Group>
          <Field.Root name="when" aria-label="When">
            <Field.TextInput value={text} onValueChange={setText} />
            {picker}
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </Form.Root>
    );
  }

  it('dismisses the field\'s server error when a date is picked', async () => {
    await mount(
      <Beside
        picker={
          <Field.Picker>
            <Calendar.Root value={day('2026-10-13')} onValueChange={() => undefined} locale="en-US">
              <Calendar.Header />
              <Calendar.Grid />
            </Calendar.Root>
          </Field.Picker>
        }
      />,
    );
    expect(screen.getByText('Booked out.')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Open picker' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Wednesday, October 14, 2026' }));
    });
    await settle();
    expect(screen.queryByText('Booked out.')).toBeNull();
  });

  it('dismisses the field\'s server error when a color is picked', async () => {
    await mount(
      <Beside
        picker={
          <Field.Picker swatch="#ff0000">
            <ColorPicker.Root value="#ff0000" onValueChange={() => undefined}>
              <ColorPicker.Hue />
            </ColorPicker.Root>
          </Field.Picker>
        }
      />,
    );
    expect(screen.getByText('Booked out.')).toBeTruthy();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Color picker' }));
    });
    await act(async () => {
      fireEvent.change(screen.getByRole('slider', { name: 'Hue' }), { target: { value: '120' } });
    });
    await settle();
    expect(screen.queryByText('Booked out.')).toBeNull();
  });
});

describe('what a control pays on mount', () => {
  it('is one commit for a named control, with no second one for the name it took', async () => {
    let commits = 0;
    await mount(
      <Profiler id="field" onRender={() => (commits += 1)}>
        <Field.Root name="f" aria-label="F">
          <Field.TextInput value="" onValueChange={() => undefined} />
        </Field.Root>
      </Profiler>,
    );
    expect(commits).toBe(1);
  });
});

describe('the control a value input is given', () => {
  it('has to come from getControlProps', () => {
    function Custom() {
      const field = useField();
      // @ts-expect-error a value input follows the props getControlProps returned, which {} is not
      return <input {...field.getValueInputProps({ type: 'text', value: '' }, {})} />;
    }
    expect(Custom).toBeTypeOf('function');
  });
});

describe('a value input\'s ref', () => {
  it('stays the same across renders while its bounds do', async () => {
    const seen: unknown[] = [];
    function Probe({ n }: { n: number }) {
      const field = useField();
      const control = field.getControlProps({}, { native: false });
      const props = field.getValueInputProps({ type: 'text', value: String(n) }, control);
      seen.push(props.ref);
      return <input {...props} />;
    }
    const tree = (n: number) => (
      <Field.Root name="p" aria-label="P">
        <Probe n={n} />
      </Field.Root>
    );
    const { rerender } = await mount(tree(1));
    rerender(tree(2));
    expect(seen.length).toBeGreaterThan(1);
    expect(new Set(seen).size).toBe(1);
  });
});
