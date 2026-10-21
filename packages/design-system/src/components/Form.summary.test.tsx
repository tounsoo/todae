import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
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
