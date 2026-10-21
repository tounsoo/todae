import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { ErrorMessage } from './ErrorMessage.js';
import { Field } from './Field.js';
import { Fieldset } from './Fieldset.js';
import { Form, type FormErrors } from './Form.js';
import { RadioGroup } from './Radio.js';
import { StringsProvider } from '../providers/StringsProvider.js';
import { EmailField, input, mount, settle, SignUp, submit, type } from '../test/form.js';

afterEach(cleanup);

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
    // The radio group has no id to link to, so the row is a button.
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.getByRole('button', { name: 'Plan' })).toBeTruthy();
  });

  it('moves focus to a control with no id from its button', async () => {
    await mount(
      <SignUp>
        <Form.Summary data-testid="summary" />
        <Field.Group>
          <input aria-label="Plain" required />
          <ErrorMessage.Root />
        </Field.Group>
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    await act(async () => {
      screen.getByRole('button', { name: 'Plain' }).click();
    });
    expect(document.activeElement).toBe(screen.getByLabelText('Plain'));
  });

  it('drops a scope that unmounts after a failed submit', async () => {
    function Removable() {
      const [shown, setShown] = useState(true);
      return (
        <SignUp>
          <Form.Summary data-testid="summary" />
          {shown ? <EmailField /> : null}
          <button type="button" onClick={() => setShown(false)}>
            Remove
          </button>
        </SignUp>
      );
    }
    await mount(<Removable />);
    await submit(screen.getByTestId('form'));
    expect(screen.getByTestId('summary')).toBeTruthy();
    await act(async () => {
      screen.getByRole('button', { name: 'Remove' }).click();
    });
    expect(screen.queryByTestId('summary')).toBeNull();
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

describe('a reply that follows an empty one', () => {
  async function submitted() {
    const ui = (errors: FormErrors) => (
      <SignUp errors={errors}>
        <EmailField />
      </SignUp>
    );
    const view = await mount(ui({}));
    await type(input(), 'ben@example.com');
    await submit(screen.getByTestId('form'));
    return { ...view, ui };
  }

  it('still moves focus when errors are cleared first and then set', async () => {
    const { rerender, ui } = await submitted();
    rerender(ui({}));
    await settle();
    rerender(ui({ email: 'Taken.' }));
    await settle();
    expect(document.activeElement).toBe(input());
  });

  it('still moves focus when inline errors are rebuilt by an unrelated render in between', async () => {
    const { rerender, ui } = await submitted();
    // Something else changed, such as a submitting flag, and `errors={{}}` is a new object.
    rerender(ui({}));
    rerender(ui({}));
    await settle();
    rerender(ui({ email: 'Taken.' }));
    await settle();
    expect(document.activeElement).toBe(input());
  });

  it('moves focus to the summary, listing the reply, when one is showing', async () => {
    const ui = (errors: FormErrors) => (
      <SignUp errors={errors}>
        <Form.Summary data-testid="summary" />
        <EmailField />
      </SignUp>
    );
    const { rerender } = await mount(ui({}));
    await type(input(), 'ben@example.com');
    await submit(screen.getByTestId('form'));
    rerender(ui({}));
    rerender(ui({ email: 'Taken.' }));
    await settle();
    expect(document.activeElement).toBe(screen.getByTestId('summary'));
    expect(screen.getByTestId('summary').textContent).toContain('Taken.');
  });
});

describe('a reply is a change of content', () => {
  function Draft({ errors }: { errors: FormErrors }) {
    return (
      <SignUp errors={errors}>
        <EmailField required={false} />
        <input aria-label="Other" />
      </SignUp>
    );
  }

  async function submitted(errors: FormErrors) {
    const view = await mount(<Draft errors={errors} />);
    await submit(screen.getByTestId('form'));
    screen.getByLabelText('Other').focus();
    return view;
  }

  it('is not the same errors rebuilt by an unrelated render, and is the changed ones', async () => {
    const { rerender } = await submitted({ email: 'Taken.' });
    // Something else changed, such as a submitting flag, and an inline `errors` is a new object.
    rerender(<Draft errors={{ email: 'Taken.' }} />);
    await settle();
    expect(document.activeElement).toBe(screen.getByLabelText('Other'));
    rerender(<Draft errors={{ email: 'Blocked.' }} />);
    await settle();
    expect(document.activeElement).toBe(input());
  });

  it('still counts the same text as a reply when it was cleared in between', async () => {
    const { rerender } = await submitted({ email: 'Taken.' });
    rerender(<Draft errors={{}} />);
    await settle();
    rerender(<Draft errors={{ email: 'Taken.' }} />);
    await settle();
    expect(document.activeElement).toBe(input());
  });
});

describe('without waiting for the scopes to read', () => {
  it('lists the problems and moves focus as soon as a failed submit has rendered', () => {
    render(
      <SignUp>
        <Form.Summary data-testid="summary" />
        <EmailField />
      </SignUp>,
    );
    // No microtask has run since the mount: the scopes have not read their controls yet.
    act(() => {
      fireEvent.submit(screen.getByTestId('form'));
    });
    expect(screen.getByTestId('summary').textContent).toContain('This field is required');
    expect(document.activeElement).toBe(screen.getByTestId('summary'));
  });

  it('moves focus to the first control as soon as a failed submit has rendered, with no summary', () => {
    render(<SignUp />);
    act(() => {
      fireEvent.submit(screen.getByTestId('form'));
    });
    expect(document.activeElement).toBe(input());
  });
});

describe('rows that follow the page', () => {
  function Pair() {
    // Plain inputs: nothing in React changes when they are edited, so only the scope's own reading can tell the summary.
    return (
      <SignUp>
        <Form.Summary data-testid="summary" />
        <Fieldset.Root data-testid="set">
          <Fieldset.Legend>Contact</Fieldset.Legend>
          <input id="a" aria-label="A" required />
          <input id="b" aria-label="B" required />
          <ErrorMessage.Root />
        </Fieldset.Root>
      </SignUp>
    );
  }

  it('links a scope\'s row to the control that fails now, when the first is fixed', async () => {
    await mount(<Pair />);
    await submit(screen.getByTestId('form'));
    expect(screen.getByRole('link', { name: 'Contact' }).getAttribute('href')).toBe('#a');
    await type(screen.getByLabelText('A'), 'x');
    await settle();
    expect(screen.getByRole('link', { name: 'Contact' }).getAttribute('href')).toBe('#b');
  });

  it('does not list a control again once it was fixed and broken after the attempt', async () => {
    function Two() {
      const [a, setA] = useState('');
      return (
        <SignUp>
          <Form.Summary data-testid="summary" />
          <Field.Group>
            <Field.Root id="a" name="a">
              <Field.TextInput aria-label="A" required value={a} onValueChange={setA} />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
          <Field.Group>
            <Field.Root id="b" name="b">
              <Field.TextInput aria-label="B" required value="" onValueChange={() => undefined} />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
        </SignUp>
      );
    }
    await mount(<Two />);
    await submit(screen.getByTestId('form'));
    expect(screen.getAllByRole('link')).toHaveLength(2);
    await type(screen.getByLabelText('A'), 'x');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    await type(screen.getByLabelText('A'), '');
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.getByRole('link').getAttribute('href')).toBe('#b');
    // The next attempt lists both again.
    await submit(screen.getByTestId('form'));
    expect(screen.getAllByRole('link')).toHaveLength(2);
  });
});

describe('a reply lists only server errors', () => {
  function Draft({ errors }: { errors: FormErrors }) {
    return (
      <Form.Root data-testid="form" errors={errors} onSubmit={(event) => event.preventDefault()}>
        <Form.Summary data-testid="summary" />
        <EmailField />
        <Field.Group>
          <Field.Root id="nick" name="nick">
            <Field.TextInput aria-label="Nick" value="" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
        <button type="submit" formNoValidate>
          Save draft
        </button>
      </Form.Root>
    );
  }
  const save = () =>
    act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save draft' }));
    });

  it('leaves out a required field the person has not reached, in the list and in focus', async () => {
    const { rerender } = await mount(<Draft errors={{}} />);
    await save();
    rerender(<Draft errors={{ nick: 'Taken.' }} />);
    await settle();
    const summary = screen.getByTestId('summary');
    expect(document.activeElement).toBe(summary);
    expect(summary.textContent).toContain('Taken.');
    expect(summary.textContent).not.toContain('required');
    expect(screen.queryByText('This field is required')).toBeNull();
  });

  it('focuses the first control with a server error when there is no summary', async () => {
    function NoSummary({ errors }: { errors: FormErrors }) {
      return (
        <Form.Root data-testid="form" errors={errors} onSubmit={(event) => event.preventDefault()}>
          <EmailField />
          <Field.Group>
            <Field.Root id="nick" name="nick">
              <Field.TextInput aria-label="Nick" value="" onValueChange={() => undefined} />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
          <button type="submit" formNoValidate>
            Save draft
          </button>
        </Form.Root>
      );
    }
    const { rerender } = await mount(<NoSummary errors={{}} />);
    await save();
    rerender(<NoSummary errors={{ nick: 'Taken.' }} />);
    await settle();
    expect(document.activeElement).toBe(screen.getByLabelText('Nick'));
  });
});

describe('a server error on a disabled control', () => {
  function Locked({ errors }: { errors: FormErrors }) {
    return (
      <Form.Root data-testid="form" errors={errors} onSubmit={(event) => event.preventDefault()}>
        <Form.Summary data-testid="summary" />
        <Field.Group>
          <Field.Root id="plan" name="plan" disabled>
            <Field.TextInput aria-label="Plan" value="pro" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
        <Field.Group>
          <Field.Root id="nick" name="nick">
            <Field.TextInput aria-label="Nick" value="" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
        <button type="submit">Send</button>
      </Form.Root>
    );
  }

  it('shows inline and in the summary, with a row that offers nothing to press', async () => {
    const { rerender } = await mount(<Locked errors={{}} />);
    await submit(screen.getByTestId('form'));
    rerender(<Locked errors={{ plan: 'Plan is locked.' }} />);
    await settle();
    const summary = screen.getByTestId('summary');
    expect(summary.textContent).toContain('Plan is locked.');
    expect(screen.getAllByText('Plan is locked.').length).toBeGreaterThan(1);
    expect(within(summary).queryByRole('link')).toBeNull();
    expect(within(summary).queryByRole('button')).toBeNull();
    expect(within(summary).getByText('Plan')).toBeTruthy();
  });

  it('is skipped by the focus of a reply with no summary', async () => {
    function Bare({ errors }: { errors: FormErrors }) {
      return (
        <Form.Root data-testid="form" errors={errors} onSubmit={(event) => event.preventDefault()}>
          <Field.Group>
            <Field.Root id="plan" name="plan" disabled>
              <Field.TextInput aria-label="Plan" value="pro" onValueChange={() => undefined} />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
          <Field.Group>
            <Field.Root id="nick" name="nick">
              <Field.TextInput aria-label="Nick" value="" onValueChange={() => undefined} />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
          <button type="submit">Send</button>
        </Form.Root>
      );
    }
    const { rerender } = await mount(<Bare errors={{}} />);
    await submit(screen.getByTestId('form'));
    rerender(<Bare errors={{ plan: 'Locked.', nick: 'Taken.' }} />);
    await settle();
    expect(document.activeElement).toBe(screen.getByLabelText('Nick'));
  });
});

describe('the disabled state of a summary row', () => {
  function Plan({ disabled, native = false, errors }: { disabled?: boolean; native?: boolean; errors: FormErrors }) {
    const group = (
      <Field.Group>
        <Field.Root id="plan" name="plan" disabled={native ? undefined : disabled}>
          <Field.TextInput aria-label="Plan" value="pro" onValueChange={() => undefined} />
        </Field.Root>
        <ErrorMessage.Root />
      </Field.Group>
    );
    return (
      <Form.Root data-testid="form" errors={errors} onSubmit={(event) => event.preventDefault()}>
        <Form.Summary data-testid="summary" />
        {native ? <fieldset disabled={disabled}>{group}</fieldset> : group}
        <Field.Group>
          <Field.Root id="nick" name="nick">
            <Field.TextInput aria-label="Nick" value="" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
        <button type="submit">Send</button>
      </Form.Root>
    );
  }

  it('is plain text for a control that a disabled fieldset disables', async () => {
    const { rerender } = await mount(<Plan native disabled errors={{}} />);
    await submit(screen.getByTestId('form'));
    rerender(<Plan native disabled errors={{ plan: 'Locked.', nick: 'Taken.' }} />);
    await settle();
    const summary = screen.getByTestId('summary');
    expect(summary.textContent).toContain('Locked.');
    expect(within(summary).queryByRole('link', { name: 'Plan' })).toBeNull();
    expect(within(summary).getByText('Plan')).toBeTruthy();
  });

  it('is skipped by focus when a disabled fieldset disables the control', async () => {
    function Bare({ errors }: { errors: FormErrors }) {
      return (
        <Form.Root data-testid="form" errors={errors} onSubmit={(event) => event.preventDefault()}>
          <fieldset disabled>
            <Field.Group>
              <Field.Root id="plan" name="plan">
                <Field.TextInput aria-label="Plan" value="pro" onValueChange={() => undefined} />
              </Field.Root>
              <ErrorMessage.Root />
            </Field.Group>
          </fieldset>
          <Field.Group>
            <Field.Root id="nick" name="nick">
              <Field.TextInput aria-label="Nick" value="" onValueChange={() => undefined} />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
          <button type="submit">Send</button>
        </Form.Root>
      );
    }
    const { rerender } = await mount(<Bare errors={{}} />);
    await submit(screen.getByTestId('form'));
    rerender(<Bare errors={{ plan: 'Locked.', nick: 'Taken.' }} />);
    await settle();
    expect(document.activeElement).toBe(screen.getByLabelText('Nick'));
  });

  it('follows a control that is disabled after its row showed', async () => {
    const { rerender } = await mount(<Plan errors={{}} />);
    await submit(screen.getByTestId('form'));
    rerender(<Plan errors={{ plan: 'Locked.' }} />);
    await settle();
    const summary = screen.getByTestId('summary');
    expect(within(summary).getByRole('link', { name: 'Plan' })).toBeTruthy();
    rerender(<Plan disabled errors={{ plan: 'Locked.' }} />);
    await settle();
    expect(within(summary).queryByRole('link', { name: 'Plan' })).toBeNull();
    expect(within(summary).getByText('Plan')).toBeTruthy();
    rerender(<Plan errors={{ plan: 'Locked.' }} />);
    await settle();
    expect(within(summary).getByRole('link', { name: 'Plan' })).toBeTruthy();
  });
});

describe('focus on a control no scope shows', () => {
  it('goes to the scoped field, not an earlier unscoped one with a server error', async () => {
    function Mixed({ errors }: { errors: FormErrors }) {
      return (
        <SignUp errors={errors}>
          <input name="loose" aria-label="Loose" />
          <EmailField />
        </SignUp>
      );
    }
    const { rerender } = await mount(<Mixed errors={{}} />);
    await type(input(), 'ben@example.com');
    await submit(screen.getByTestId('form'));
    rerender(<Mixed errors={{ loose: 'No.', email: 'Taken.' }} />);
    await settle();
    expect(document.activeElement).toBe(input());
  });
});

describe('a refresh that changes nothing', () => {
  it('keeps the rows when no listed one differs, so the summary does not render again', async () => {
    let renders = 0;
    await mount(
      <SignUp>
        <Form.Summary>
          {(fields) => {
            renders += 1;
            return fields.map((field) => <span key={field.label}>{field.label}</span>);
          }}
        </Form.Summary>
        <EmailField />
        <Fieldset.Root>
          <input aria-label="Site" type="url" />
          <ErrorMessage.Root />
        </Fieldset.Root>
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    const before = renders;
    // The scope of Site reads again and finds a problem that was not listed.
    await type(screen.getByLabelText('Site'), 'nope');
    await settle();
    expect(renders).toBe(before);
  });
});

describe('what a refresh keeps after a reply', () => {
  it('drops the row of a server error the person clears, instead of turning it into "required"', async () => {
    function Sending({ errors }: { errors: FormErrors }) {
      return (
        <SignUp errors={errors}>
          <Form.Summary data-testid="summary" />
          <EmailField />
        </SignUp>
      );
    }
    const { rerender } = await mount(<Sending errors={{}} />);
    await type(input(), 'ben@example.com');
    await submit(screen.getByTestId('form'));
    rerender(<Sending errors={{ email: 'Taken.' }} />);
    await settle();
    expect(screen.getByTestId('summary').textContent).toContain('Taken.');
    await type(input(), '');
    await settle();
    expect(screen.queryByTestId('summary')).toBeNull();
  });
});
