import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Checkbox } from './Checkbox.js';
import { ErrorMessage } from './ErrorMessage.js';
import { Field } from './Field.js';
import { Fieldset } from './Fieldset.js';
import { Form, type FormErrors } from './Form.js';
import { Label } from './Label.js';
import { RadioGroup } from './Radio.js';
import { StringsProvider } from '../providers/StringsProvider.js';
import * as api from '../index.js';

afterEach(cleanup);

/** Renders, then lets the scopes read their controls: they do so in a microtask after each commit. */
async function mount(ui: ReactNode) {
  const result = render(ui);
  await settle();
  return result;
}

async function settle() {
  await act(async () => {});
}

async function type(el: HTMLElement, value: string) {
  await act(async () => {
    fireEvent.change(el, { target: { value } });
  });
}

async function blur(el: HTMLElement) {
  await act(async () => {
    fireEvent.blur(el);
  });
}

async function submit(form: HTMLElement) {
  await act(async () => {
    fireEvent.submit(form);
  });
}

/** Every id an aria-describedby names must exist in the page. */
function expectNoDanglingIds() {
  for (const el of document.querySelectorAll('[aria-describedby]')) {
    for (const id of el.getAttribute('aria-describedby')!.split(/\s+/)) {
      expect(document.getElementById(id), `#${id} named by ${el.tagName}`).not.toBeNull();
    }
  }
}

function EmailField({ required = true, message }: { required?: boolean; message?: ReactNode }) {
  const [email, setEmail] = useState('');
  return (
    <Field.Group data-testid="group">
      <Label.Root htmlFor="email">Work email</Label.Root>
      <Field.Root id="email" name="email">
        <Field.TextInput type="email" required={required} value={email} onValueChange={setEmail} />
      </Field.Root>
      {message ?? <ErrorMessage.Root />}
    </Field.Group>
  );
}

function SignUp({
  errors,
  onSubmit = (event) => event.preventDefault(),
  children,
}: {
  errors?: FormErrors;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  children?: ReactNode;
}) {
  return (
    <Form.Root data-testid="form" errors={errors} onSubmit={onSubmit}>
      {children ?? <EmailField />}
      <button type="submit">Send</button>
    </Form.Root>
  );
}

const input = () => screen.getByLabelText('Work email') as HTMLInputElement;

describe('Form exports', () => {
  it('is a component with a root and a summary', () => {
    expect(api.Form).toBe(Form);
    expect(Object.keys(Form)).toEqual(['Root', 'Summary']);
  });
});

describe('Form.Root', () => {
  it('renders a form that the browser does not validate', () => {
    render(<Form.Root data-testid="form" />);
    expect((screen.getByTestId('form') as HTMLFormElement).noValidate).toBe(true);
  });

  it('forwards its ref and native attributes', () => {
    let node: HTMLFormElement | null = null;
    render(<Form.Root ref={(el) => void (node = el)} id="f" aria-label="Sign up" />);
    expect(node).toBe(document.getElementById('f'));
  });

  it('throws for a summary outside it', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => render(<Form.Summary />)).toThrow('Form.Summary must be rendered inside Form.Root');
    error.mockRestore();
  });
});

describe('submit gate', () => {
  it('blocks a submit with an invalid control and never calls onSubmit', async () => {
    const onSubmit = vi.fn();
    await mount(<SignUp onSubmit={onSubmit} />);
    await submit(screen.getByTestId('form'));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit for a valid form', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    await mount(<SignUp onSubmit={onSubmit} />);
    await type(input(), 'ben@example.com');
    await submit(screen.getByTestId('form'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('prevents the default action of a blocked submit', async () => {
    await mount(<SignUp />);
    const event = new Event('submit', { bubbles: true, cancelable: true });
    await act(async () => {
      screen.getByTestId('form').dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true);
  });

  it('skips the check for a submitter with formNoValidate', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    await mount(
      <Form.Root data-testid="form" onSubmit={onSubmit}>
        <EmailField />
        <button type="submit" formNoValidate>
          Save draft
        </button>
      </Form.Root>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
    // Nothing was attempted, so nothing shows.
    expect(screen.queryByText('This field is required')).toBeNull();
  });

  it('blocks a submit sent by a submit button too', async () => {
    const onSubmit = vi.fn();
    await mount(<SignUp onSubmit={onSubmit} />);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('This field is required')).toBeTruthy();
  });

  it('checks a form that requestSubmit sends', async () => {
    const onSubmit = vi.fn();
    await mount(<SignUp onSubmit={onSubmit} />);
    await act(async () => {
      (screen.getByTestId('form') as HTMLFormElement).requestSubmit();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe('when a problem shows', () => {
  it('shows nothing before the person has touched the field', async () => {
    await mount(<SignUp />);
    expect(screen.queryByText('This field is required')).toBeNull();
    expect(input().getAttribute('aria-invalid')).toBeNull();
  });

  it('shows nothing after a change until focus leaves', async () => {
    await mount(<SignUp />);
    await type(input(), 'a');
    await type(input(), '');
    expect(screen.queryByText('This field is required')).toBeNull();
    await blur(input());
    expect(screen.getByText('This field is required')).toBeTruthy();
    expect(input().getAttribute('aria-invalid')).toBe('true');
  });

  it('shows nothing when focus leaves a field that was never changed', async () => {
    await mount(<SignUp />);
    await blur(input());
    expect(screen.queryByText('This field is required')).toBeNull();
  });

  it('does not reveal while focus moves inside the scope', async () => {
    await mount(
      <SignUp>
        <Field.Group>
          <Field.Root id="a" name="a">
            <Field.TextInput aria-label="A" required value="" onValueChange={() => undefined} />
          </Field.Root>
          <Field.Root id="b" name="b">
            <Field.TextInput aria-label="B" value="" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </SignUp>,
    );
    const a = screen.getByLabelText('A');
    await type(a, 'x');
    await type(a, '');
    await act(async () => {
      fireEvent.blur(a, { relatedTarget: screen.getByLabelText('B') });
    });
    expect(screen.queryByText('This field is required')).toBeNull();
  });

  it('is live in both directions once shown', async () => {
    await mount(<SignUp />);
    await type(input(), 'a');
    await blur(input());
    expect(screen.getByText('Enter an email address')).toBeTruthy();
    await type(input(), 'ben@example.com');
    expect(screen.queryByText('Enter an email address')).toBeNull();
    expect(input().getAttribute('aria-invalid')).toBeNull();
    await type(input(), 'ben');
    expect(screen.getByText('Enter an email address')).toBeTruthy();
  });

  it('reveals every scope on a submit attempt, valid or not', async () => {
    await mount(
      <SignUp>
        <EmailField />
        <Field.Group>
          <Field.Root id="name" name="name">
            <Field.TextInput aria-label="Name" required value="" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root data-testid="name-error" />
        </Field.Group>
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getAllByText('This field is required')).toHaveLength(2);
  });

  it('keeps showing after a valid attempt if a control is changed to invalid', async () => {
    await mount(<SignUp />);
    await type(input(), 'ben@example.com');
    await submit(screen.getByTestId('form'));
    await type(input(), 'ben');
    expect(screen.getByText('Enter an email address')).toBeTruthy();
  });

  it('hides every problem again on reset', async () => {
    await mount(<SignUp />);
    await submit(screen.getByTestId('form'));
    expect(screen.getByText('This field is required')).toBeTruthy();
    await act(async () => {
      fireEvent.reset(screen.getByTestId('form'));
    });
    expect(screen.queryByText('This field is required')).toBeNull();
    expect(input().getAttribute('aria-invalid')).toBeNull();
    // A touch before the reset doesn't carry over.
    await blur(input());
    expect(screen.queryByText('This field is required')).toBeNull();
  });

  it('reads values the product sets without an event', async () => {
    function Controlled() {
      const [value, setValue] = useState('ben@example.com');
      return (
        <SignUp>
          <Field.Group>
            <Field.Root id="e" name="e">
              <Field.TextInput aria-label="E" type="email" required value={value} onValueChange={setValue} />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
          <button type="button" onClick={() => setValue('')}>
            Clear
          </button>
        </SignUp>
      );
    }
    await mount(<Controlled />);
    await submit(screen.getByTestId('form'));
    expect(screen.queryByText('This field is required')).toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    });
    expect(screen.getByText('This field is required')).toBeTruthy();
  });
});

describe('what a problem says', () => {
  it('words each flag from the strings in effect', async () => {
    await mount(
      <StringsProvider strings={{ valueMissing: 'Requis' }}>
        <SignUp />
      </StringsProvider>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByText('Requis')).toBeTruthy();
  });

  it('lets a function child word the error', async () => {
    await mount(
      <SignUp>
        <EmailField
          message={<ErrorMessage.Root>{(error) => (error.kind === 'valueMissing' ? 'Add your email.' : error.message)}</ErrorMessage.Root>}
        />
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByText('Add your email.')).toBeTruthy();
  });

  it('lets plain children replace the message', async () => {
    await mount(
      <SignUp>
        <EmailField message={<ErrorMessage.Root>Fix this one.</ErrorMessage.Root>} />
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByText('Fix this one.')).toBeTruthy();
  });
});

describe('customValidity', () => {
  function Rule({ message }: { message: string }) {
    const [value, setValue] = useState('taken');
    return (
      <SignUp>
        <Field.Group>
          <Label.Root htmlFor="n">Name</Label.Root>
          <Field.Root id="n" name="n" customValidity={message}>
            <Field.TextInput value={value} onValueChange={setValue} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </SignUp>
    );
  }

  it('blocks the submit and shows the message as written', async () => {
    const onSubmit = vi.fn();
    const { rerender } = await mount(<Rule message="That name is taken." />);
    expect((screen.getByLabelText('Name') as HTMLInputElement).validationMessage).toBe('That name is taken.');
    await submit(screen.getByTestId('form'));
    expect(screen.getByText('That name is taken.')).toBeTruthy();
    rerender(<Rule message="" />);
    await settle();
    expect(screen.queryByText('That name is taken.')).toBeNull();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('works without a Form, natively', () => {
    render(
      <Field.Root id="n" name="n" customValidity="No.">
        <Field.TextInput aria-label="Name" value="x" onValueChange={() => undefined} />
      </Field.Root>,
    );
    const el = screen.getByLabelText('Name') as HTMLInputElement;
    expect(el.checkValidity()).toBe(false);
    expect(el.validationMessage).toBe('No.');
  });

  it('leaves a control alone until a message has been given, and clears it when the prop goes', () => {
    const { rerender } = render(
      <Field.Root id="n" name="n">
        <Field.TextInput aria-label="Name" value="x" onValueChange={() => undefined} />
      </Field.Root>,
    );
    const el = screen.getByLabelText('Name') as HTMLInputElement;
    el.setCustomValidity('Mine');
    rerender(
      <Field.Root id="n" name="n">
        <Field.TextInput aria-label="Name" value="y" onValueChange={() => undefined} />
      </Field.Root>,
    );
    expect(el.validationMessage).toBe('Mine');
    rerender(
      <Field.Root id="n" name="n" customValidity="Theirs">
        <Field.TextInput aria-label="Name" value="y" onValueChange={() => undefined} />
      </Field.Root>,
    );
    expect(el.validationMessage).toBe('Theirs');
    rerender(
      <Field.Root id="n" name="n">
        <Field.TextInput aria-label="Name" value="y" onValueChange={() => undefined} />
      </Field.Root>,
    );
    expect(el.validationMessage).toBe('');
  });

  it('applies to a checkbox, the first radio of a group and the first control of a fieldset', () => {
    render(
      <>
        <Checkbox.Root customValidity="Accept first.">Terms</Checkbox.Root>
        <RadioGroup.Root aria-label="Plan" customValidity="Pick a plan.">
          <RadioGroup.Item value="a">A</RadioGroup.Item>
          <RadioGroup.Item value="b">B</RadioGroup.Item>
        </RadioGroup.Root>
        <Fieldset.Root customValidity="Choose one." data-testid="set">
          <Fieldset.Legend>Pick</Fieldset.Legend>
          <Checkbox.Root>One</Checkbox.Root>
          <Checkbox.Root>Two</Checkbox.Root>
        </Fieldset.Root>
      </>,
    );
    expect((screen.getByLabelText('Terms') as HTMLInputElement).validationMessage).toBe('Accept first.');
    expect((screen.getByLabelText('A') as HTMLInputElement).validationMessage).toBe('Pick a plan.');
    expect((screen.getByLabelText('B') as HTMLInputElement).validationMessage).toBe('');
    expect((screen.getByLabelText('One') as HTMLInputElement).validationMessage).toBe('Choose one.');
    expect((screen.getByLabelText('Two') as HTMLInputElement).validationMessage).toBe('');
  });
});

describe('server errors', () => {
  it('shows at once, in place of a native problem, with no reveal', async () => {
    await mount(<SignUp errors={{ email: 'That address is taken.' }} />);
    expect(screen.getByText('That address is taken.')).toBeTruthy();
    expect(input().getAttribute('aria-invalid')).toBe('true');
  });

  it('wins over a native problem that is showing', async () => {
    await mount(<SignUp errors={{ email: 'Taken.' }} />);
    await submit(screen.getByTestId('form'));
    expect(screen.getByText('Taken.')).toBeTruthy();
    expect(screen.queryByText('This field is required')).toBeNull();
  });

  it('does not block a submit', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    await mount(<SignUp errors={{ email: 'Taken.' }} onSubmit={onSubmit} />);
    await type(input(), 'ben@example.com');
    await submit(screen.getByTestId('form'));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('is hidden by an edit to its control, and stays hidden for the same object', async () => {
    const errors = { email: 'Taken.' };
    const { rerender } = await mount(<SignUp errors={errors} />);
    await type(input(), 'ben@example.com');
    expect(screen.queryByText('Taken.')).toBeNull();
    rerender(<SignUp errors={errors} />);
    await settle();
    expect(screen.queryByText('Taken.')).toBeNull();
  });

  it('is shown again by a new errors object, even with the same text', async () => {
    const { rerender } = await mount(<SignUp errors={{ email: 'Taken.' }} />);
    await type(input(), 'ben@example.com');
    expect(screen.queryByText('Taken.')).toBeNull();
    rerender(<SignUp errors={{ email: 'Taken.' }} />);
    await settle();
    expect(screen.getByText('Taken.')).toBeTruthy();
  });

  it('is shown again by the next submit', async () => {
    await mount(<SignUp errors={{ email: 'Taken.' }} />);
    await type(input(), 'ben@example.com');
    expect(screen.queryByText('Taken.')).toBeNull();
    await submit(screen.getByTestId('form'));
    expect(screen.getByText('Taken.')).toBeTruthy();
  });

  it('is hidden by an edit to another control only for that control', async () => {
    await mount(
      <SignUp errors={{ email: 'Taken.', name: 'Reserved.' }}>
        <EmailField />
        <Field.Group>
          <Field.Root id="name" name="name">
            <Field.TextInput aria-label="Name" value="" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </SignUp>,
    );
    await type(input(), 'ben@example.com');
    expect(screen.queryByText('Taken.')).toBeNull();
    expect(screen.getByText('Reserved.')).toBeTruthy();
  });

  it('ignores an entry no control is named for, and an empty one', async () => {
    await mount(<SignUp errors={{ nobody: 'Hi.', email: '' }} />);
    expect(screen.queryByText('Hi.')).toBeNull();
    expect(input().getAttribute('aria-invalid')).toBeNull();
  });
});

describe('precedence with invalid', () => {
  it('lets a control\'s own invalid={false} win over a scope that shows', async () => {
    await mount(
      <SignUp>
        <Field.Group>
          <Field.Root id="a" name="a" invalid={false}>
            <Field.TextInput aria-label="A" required value="" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByText('This field is required')).toBeTruthy();
    expect(screen.getByLabelText('A').getAttribute('aria-invalid')).toBeNull();
  });

  it('marks a control invalid for a Fieldset invalid, with or without a shown problem', async () => {
    await mount(
      <SignUp>
        <Fieldset.Root invalid>
          <Fieldset.Legend>Pick</Fieldset.Legend>
          <Field.Group>
            <Field.Root id="a" name="a">
              <Field.TextInput aria-label="A" value="" onValueChange={() => undefined} />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
        </Fieldset.Root>
      </SignUp>,
    );
    expect(screen.getByLabelText('A').getAttribute('aria-invalid')).toBe('true');
  });

  it('shows a scope\'s problem even where its Fieldset says invalid={false}', async () => {
    await mount(
      <SignUp>
        <Fieldset.Root invalid={false}>
          <Fieldset.Legend>Pick</Fieldset.Legend>
          <Field.Group>
            <Field.Root id="a" name="a">
              <Field.TextInput aria-label="A" required value="" onValueChange={() => undefined} />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
        </Fieldset.Root>
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByLabelText('A').getAttribute('aria-invalid')).toBe('true');
  });

  it('marks the shell and the checkbox, radios and group of a scope that shows', async () => {
    await mount(
      <SignUp>
        <Fieldset.Root data-testid="set">
          <Fieldset.Legend>Plan</Fieldset.Legend>
          <RadioGroup.Root aria-label="Plan" name="plan">
            <RadioGroup.Item value="a" required>
              Team
            </RadioGroup.Item>
            <RadioGroup.Item value="b">Pro</RadioGroup.Item>
          </RadioGroup.Root>
          <ErrorMessage.Root />
        </Fieldset.Root>
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByTestId('set').hasAttribute('data-invalid')).toBe(true);
    expect(screen.getByRole('radiogroup').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Team').getAttribute('aria-invalid')).toBe('true');
  });
});

describe('aria-describedby', () => {
  it('lists the error id on the control only while the error shows', async () => {
    await mount(<SignUp />);
    expect(input().getAttribute('aria-describedby')).toBeNull();
    await submit(screen.getByTestId('form'));
    const id = screen.getByText('This field is required').id;
    expect(id).not.toBe('');
    expect(input().getAttribute('aria-describedby')).toContain(id);
    expectNoDanglingIds();
    await type(input(), 'ben@example.com');
    expect(input().getAttribute('aria-describedby')).toBeNull();
    expectNoDanglingIds();
  });

  it('keeps the field\'s other descriptions in front of the error', async () => {
    await mount(
      <SignUp>
        <Field.Group>
          <Field.Root id="a" name="a" aria-describedby="hint">
            <Field.TextInput aria-label="A" required value="" onValueChange={() => undefined} />
          </Field.Root>
          <span id="hint">A hint</span>
          <ErrorMessage.Root />
        </Field.Group>
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    const id = screen.getByText('This field is required').id;
    expect(screen.getByLabelText('A').getAttribute('aria-describedby')).toBe(`hint ${id}`);
    expectNoDanglingIds();
  });

  it('names no id when the scope has no ErrorMessage to hold it', async () => {
    await mount(
      <SignUp>
        <Field.Group>
          <Field.Root id="a" name="a">
            <Field.TextInput aria-label="A" required value="" onValueChange={() => undefined} />
          </Field.Root>
        </Field.Group>
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByLabelText('A').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('A').getAttribute('aria-describedby')).toBeNull();
  });

  it('names no id once the ErrorMessage unmounts', async () => {
    function Toggle() {
      const [on, setOn] = useState(true);
      return (
        <SignUp>
          <Field.Group>
            <Field.Root id="a" name="a">
              <Field.TextInput aria-label="A" required value="" onValueChange={() => undefined} />
            </Field.Root>
            {on ? <ErrorMessage.Root /> : null}
          </Field.Group>
          <button type="button" onClick={() => setOn(false)}>
            Remove
          </button>
        </SignUp>
      );
    }
    await mount(<Toggle />);
    await submit(screen.getByTestId('form'));
    expect(screen.getByLabelText('A').getAttribute('aria-describedby')).not.toBeNull();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    });
    expect(screen.getByLabelText('A').getAttribute('aria-describedby')).toBeNull();
    expectNoDanglingIds();
  });

  it('describes a fieldset, a group and a checkbox of a scope, not each radio', async () => {
    await mount(
      <SignUp>
        <Fieldset.Root data-testid="set">
          <Fieldset.Legend>Plan</Fieldset.Legend>
          <RadioGroup.Root aria-label="Plan" name="plan">
            <RadioGroup.Item value="a" required>
              Team
            </RadioGroup.Item>
          </RadioGroup.Root>
          <Checkbox.Root name="terms" required>
            Terms
          </Checkbox.Root>
          <ErrorMessage.Root />
        </Fieldset.Root>
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    const id = screen.getByTestId('set').querySelector('[data-todae-error]')!.id;
    expect(screen.getByTestId('set').getAttribute('aria-describedby')).toBe(id);
    expect(screen.getByRole('radiogroup').getAttribute('aria-describedby')).toBe(id);
    expect(screen.getByLabelText('Team').getAttribute('aria-describedby')).toBeNull();
    expect(screen.getByLabelText('Terms').getAttribute('aria-describedby')).toBe(id);
    expectNoDanglingIds();
  });

  it('keeps an explicit id exactly as it is', async () => {
    await mount(
      <SignUp>
        <Field.Group>
          <Field.Root id="a" name="a" aria-describedby="mine">
            <Field.TextInput aria-label="A" required value="" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root id="mine">Mine always</ErrorMessage.Root>
        </Field.Group>
      </SignUp>,
    );
    expect(screen.getByText('Mine always').id).toBe('mine');
    expect(screen.getByLabelText('A').getAttribute('aria-describedby')).toBe('mine');
    await submit(screen.getByTestId('form'));
    expect(screen.getByLabelText('A').getAttribute('aria-describedby')).toBe('mine');
    expectNoDanglingIds();
  });
});

describe('nested scopes', () => {
  function Address({ state }: { state?: string }) {
    return (
      <SignUp>
        <Fieldset.Root data-testid="outer">
          <Fieldset.Legend>Address</Fieldset.Legend>
          <Field.Group data-testid="inner">
            <Field.Root id="street" name="street">
              <Field.TextInput aria-label="Street" required value="" onValueChange={() => undefined} />
            </Field.Root>
            <ErrorMessage.Root data-testid="inner-error" />
          </Field.Group>
          <Field.Root id="zip" name="zip">
            <Field.TextInput aria-label="Zip" value={state ?? ''} onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root data-testid="outer-error" />
        </Fieldset.Root>
      </SignUp>
    );
  }

  it('answers for a control in the innermost scope only', async () => {
    await mount(<Address />);
    await submit(screen.getByTestId('form'));
    expect(screen.getByTestId('inner-error').textContent).toBe('This field is required');
    expect(screen.queryByTestId('outer-error')).toBeNull();
  });

  it('shows the outer scope\'s own problems in the outer message', async () => {
    function Both() {
      return (
        <SignUp>
          <Fieldset.Root data-testid="outer">
            <Fieldset.Legend>Address</Fieldset.Legend>
            <Field.Group>
              <Field.Root id="street" name="street">
                <Field.TextInput aria-label="Street" required value="" onValueChange={() => undefined} />
              </Field.Root>
              <ErrorMessage.Root data-testid="inner-error" />
            </Field.Group>
            <Field.Root id="zip" name="zip">
              <Field.TextInput aria-label="Zip" required value="" onValueChange={() => undefined} />
            </Field.Root>
            <ErrorMessage.Root data-testid="outer-error" />
          </Fieldset.Root>
        </SignUp>
      );
    }
    await mount(<Both />);
    await submit(screen.getByTestId('form'));
    expect(screen.getByTestId('inner-error').textContent).toBe('This field is required');
    expect(screen.getByTestId('outer-error').textContent).toBe('This field is required');
    expect(screen.getByTestId('inner-error').id).not.toBe(screen.getByTestId('outer-error').id);
    // Each control lists its nearest scope's message.
    expect(screen.getByLabelText('Street').getAttribute('aria-describedby')).toBe(screen.getByTestId('inner-error').id);
    expect(screen.getByLabelText('Zip').getAttribute('aria-describedby')).toBe(screen.getByTestId('outer-error').id);
    expectNoDanglingIds();
  });
});

describe('outside a Form.Root', () => {
  it('leaves Field.Group and Fieldset.Root as plain containers', () => {
    render(
      <Fieldset.Root data-testid="set">
        <Fieldset.Legend>Pick</Fieldset.Legend>
        <Field.Group data-testid="group">
          <Field.Root id="a" name="a">
            <Field.TextInput aria-label="A" required value="" onValueChange={() => undefined} />
          </Field.Root>
        </Field.Group>
      </Fieldset.Root>,
    );
    expect(screen.getByTestId('group').hasAttribute('data-todae-validation-scope')).toBe(false);
    expect(screen.getByTestId('set').hasAttribute('data-todae-validation-scope')).toBe(false);
  });

  it('keeps the handlers a caller gave Field.Group and Fieldset.Root', () => {
    const onBlur = vi.fn();
    render(
      <Field.Group data-testid="group" onBlur={onBlur}>
        <Field.Root id="a" name="a">
          <Field.TextInput aria-label="A" value="" onValueChange={() => undefined} />
        </Field.Root>
      </Field.Group>,
    );
    fireEvent.blur(screen.getByLabelText('A'));
    expect(onBlur).toHaveBeenCalled();
  });

  it('logs when an ErrorMessage has no id and no scope', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    render(<ErrorMessage.Root>Oops</ErrorMessage.Root>);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('without an id'));
    error.mockRestore();
  });

  it('keeps an ErrorMessage with an id as it was', () => {
    render(<ErrorMessage.Root id="e">Oops</ErrorMessage.Root>);
    expect(screen.getByText('Oops').id).toBe('e');
  });
});

describe('Form.Summary', () => {
  function Summarized({ errors }: { errors?: FormErrors }) {
    return (
      <SignUp errors={errors}>
        <Form.Summary data-testid="summary" />
        <EmailField />
      </SignUp>
    );
  }

  it('renders nothing before a failed submit', async () => {
    await mount(<Summarized />);
    expect(screen.queryByTestId('summary')).toBeNull();
  });

  it('lists each failing control with its label and message, named by a title', async () => {
    await mount(<Summarized />);
    await submit(screen.getByTestId('form'));
    const summary = screen.getByTestId('summary');
    expect(screen.getByRole('group', { name: '1 problem to fix' })).toBe(summary);
    const link = summary.querySelector('a')!;
    expect(link.textContent).toBe('Work email');
    expect(link.getAttribute('href')).toBe('#email');
    expect(summary.textContent).toContain('This field is required');
  });

  it('takes focus on a failed submit', async () => {
    await mount(<Summarized />);
    await submit(screen.getByTestId('form'));
    expect(document.activeElement).toBe(screen.getByTestId('summary'));
  });

  it('moves focus to the control from a link without navigating', async () => {
    await mount(<Summarized />);
    await submit(screen.getByTestId('form'));
    const link = screen.getByRole('link', { name: 'Work email' });
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    await act(async () => {
      link.dispatchEvent(click);
    });
    expect(click.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(input());
  });

  it('drops a control once it is fixed and renders nothing when none is left', async () => {
    await mount(<Summarized />);
    await submit(screen.getByTestId('form'));
    await type(input(), 'ben@example.com');
    expect(screen.queryByTestId('summary')).toBeNull();
  });

  it('does not list a control that fails only after the last attempt', async () => {
    await mount(
      <SignUp>
        <Form.Summary data-testid="summary" />
        <EmailField />
        <Field.Group>
          <Field.Root id="age" name="age">
            <Field.TextInput aria-label="Age" type="number" min="18" value="20" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });

  it('hides again on reset', async () => {
    await mount(<Summarized />);
    await submit(screen.getByTestId('form'));
    await act(async () => {
      fireEvent.reset(screen.getByTestId('form'));
    });
    expect(screen.queryByTestId('summary')).toBeNull();
  });

  it('takes a title and a function child', async () => {
    await mount(
      <SignUp>
        <Form.Summary data-testid="summary" title="Fix these">
          {(fields) => <ol>{fields.map((field) => <li key={field.label}>{field.label}: {field.error.kind}</li>)}</ol>}
        </Form.Summary>
        <EmailField />
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByTestId('summary').textContent).toContain('Fix these');
    expect(screen.getByText('Work email: valueMissing')).toBeTruthy();
  });

  it('names a fieldset\'s problem by its legend', async () => {
    await mount(
      <SignUp>
        <Form.Summary data-testid="summary" />
        <Fieldset.Root>
          <Fieldset.Legend>Plan</Fieldset.Legend>
          <RadioGroup.Root aria-label="Plan" name="plan">
            <RadioGroup.Item value="a" required>
              Team
            </RadioGroup.Item>
          </RadioGroup.Root>
          <ErrorMessage.Root />
        </Fieldset.Root>
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByRole('link').textContent).toBe('Plan');
  });

  it('is titled by the formErrors string', async () => {
    await mount(
      <StringsProvider strings={{ formErrors: (n) => `${n} à corriger` }}>
        <Summarized />
      </StringsProvider>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByRole('group', { name: '1 à corriger' })).toBeTruthy();
  });
});

describe('focus after a submit', () => {
  it('goes to the first invalid control, in document order, without a summary', async () => {
    await mount(
      <SignUp>
        <Field.Group>
          <Field.Root id="a" name="a">
            <Field.TextInput aria-label="A" value="ok" onValueChange={() => undefined} />
          </Field.Root>
        </Field.Group>
        <Field.Group>
          <Field.Root id="b" name="b">
            <Field.TextInput aria-label="B" required value="" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
        <Field.Group>
          <Field.Root id="c" name="c">
            <Field.TextInput aria-label="C" required value="" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    expect(document.activeElement).toBe(screen.getByLabelText('B'));
  });

  it('goes to a control outside every scope when it is the first problem and there is no summary', async () => {
    await mount(
      <SignUp>
        <input aria-label="Plain" required />
        <EmailField />
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    expect(document.activeElement).toBe(screen.getByLabelText('Plain'));
  });

  it('falls back to the control when the summary has nothing to list', async () => {
    await mount(
      <SignUp>
        <Form.Summary data-testid="summary" />
        <input aria-label="Plain" required />
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.queryByTestId('summary')).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText('Plain'));
  });

  it('moves focus to the first server error when errors arrive after a valid submit', async () => {
    const { rerender } = await mount(
      <SignUp>
        <EmailField />
      </SignUp>,
    );
    await type(input(), 'ben@example.com');
    await submit(screen.getByTestId('form'));
    rerender(
      <SignUp errors={{ email: 'Taken.' }}>
        <EmailField />
      </SignUp>,
    );
    await settle();
    expect(document.activeElement).toBe(input());
  });

  it('leaves focus alone when errors arrive after the person edited', async () => {
    const { rerender } = await mount(<SignUp />);
    await type(input(), 'ben@example.com');
    await submit(screen.getByTestId('form'));
    await type(input(), 'ben@example.org');
    (document.activeElement as HTMLElement | null)?.blur();
    rerender(<SignUp errors={{ email: 'Taken.' }} />);
    await settle();
    expect(document.activeElement).not.toBe(input());
  });
});
