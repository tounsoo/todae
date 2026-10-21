import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Checkbox } from './Checkbox.js';
import { ErrorMessage } from './ErrorMessage.js';
import { Field } from './Field.js';
import { Fieldset } from './Fieldset.js';
import { Label } from './Label.js';
import { RadioGroup } from './Radio.js';
import { expectNoDanglingIds, input, mount, settle, SignUp, submit, type } from '../test/form.js';

afterEach(cleanup);

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

  it('describes the fieldset of a fieldset scope once, and the controls of a group scope each', async () => {
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
    // The fieldset's own description reaches its controls' names, so they are marked invalid but not described again.
    expect(screen.getByRole('radiogroup').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('radiogroup').getAttribute('aria-describedby')).toBeNull();
    expect(screen.getByLabelText('Team').getAttribute('aria-describedby')).toBeNull();
    expect(screen.getByLabelText('Terms').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Terms').getAttribute('aria-describedby')).toBeNull();
    expectNoDanglingIds();
  });

  it('describes the radio group and the checkbox of a group scope, not each radio', async () => {
    await mount(
      <SignUp>
        <Field.Group data-testid="set">
          <RadioGroup.Root aria-label="Plan" name="plan">
            <RadioGroup.Item value="a" required>
              Team
            </RadioGroup.Item>
          </RadioGroup.Root>
          <Checkbox.Root name="terms" required>
            Terms
          </Checkbox.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    const id = screen.getByTestId('set').querySelector('[data-todae-error]')!.id;
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
    // A group's controls list its message; the fieldset lists its own, so its controls do not.
    expect(screen.getByLabelText('Street').getAttribute('aria-describedby')).toBe(screen.getByTestId('inner-error').id);
    expect(screen.getByTestId('outer').getAttribute('aria-describedby')).toBe(screen.getByTestId('outer-error').id);
    expect(screen.getByLabelText('Zip').getAttribute('aria-describedby')).toBeNull();
    expect(screen.getByLabelText('Zip').getAttribute('aria-invalid')).toBe('true');
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

describe('where customValidity lands', () => {
  it('goes to the first radio that takes part in validation', async () => {
    await mount(
      <SignUp>
        <RadioGroup.Root aria-label="Plan" name="plan" customValidity="Pick a plan.">
          <RadioGroup.Item value="a" disabled>
            Free
          </RadioGroup.Item>
          <RadioGroup.Item value="b">Team</RadioGroup.Item>
        </RadioGroup.Root>
      </SignUp>,
    );
    expect((screen.getByLabelText('Free') as HTMLInputElement).validationMessage).toBe('');
    expect((screen.getByLabelText('Team') as HTMLInputElement).validationMessage).toBe('Pick a plan.');
    await submit(screen.getByTestId('form'));
    expect(document.activeElement).toBe(screen.getByLabelText('Team'));
  });

  it('goes to the fieldset\'s own first control, not one in a nested group', async () => {
    await mount(
      <SignUp>
        <Fieldset.Root customValidity="Check the address.">
          <Fieldset.Legend>Address</Fieldset.Legend>
          <Field.Group>
            <Field.Root id="street" name="street">
              <Field.TextInput aria-label="Street" value="" onValueChange={() => undefined} />
            </Field.Root>
          </Field.Group>
          <Field.Root id="zip" name="zip">
            <Field.TextInput aria-label="Zip" value="" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root />
        </Fieldset.Root>
      </SignUp>,
    );
    expect((screen.getByLabelText('Street') as HTMLInputElement).validationMessage).toBe('');
    expect((screen.getByLabelText('Zip') as HTMLInputElement).validationMessage).toBe('Check the address.');
  });

  describe('when all its controls sit in nested groups', () => {
    function Nested({ message, onSubmit }: { message?: string; onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void }) {
      return (
        <SignUp onSubmit={onSubmit}>
          <Fieldset.Root customValidity={message}>
            <Fieldset.Legend>Address</Fieldset.Legend>
            <Field.Group>
              <Field.Root id="street" name="street">
                <Field.TextInput aria-label="Street" value="" onValueChange={() => undefined} />
              </Field.Root>
              <ErrorMessage.Root data-testid="first" />
            </Field.Group>
            <Field.Group>
              <Field.Root id="zip" name="zip">
                <Field.TextInput aria-label="Zip" value="" onValueChange={() => undefined} />
              </Field.Root>
              <ErrorMessage.Root data-testid="second" />
            </Field.Group>
          </Fieldset.Root>
        </SignUp>
      );
    }

    it('blocks the submit and shows the message in the first group', async () => {
      const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
      await mount(<Nested message="Check the address." onSubmit={onSubmit} />);
      await submit(screen.getByTestId('form'));
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByTestId('first').textContent).toBe('Check the address.');
      expect(screen.queryByTestId('second')).toBeNull();
    });

    it('lands there outside a Form too', () => {
      render(
        <Fieldset.Root customValidity="Check the address.">
          <Field.Group>
            <Field.Root id="street" name="street">
              <Field.TextInput aria-label="Street" value="" onValueChange={() => undefined} />
            </Field.Root>
          </Field.Group>
          <Field.Group>
            <Field.Root id="zip" name="zip">
              <Field.TextInput aria-label="Zip" value="" onValueChange={() => undefined} />
            </Field.Root>
          </Field.Group>
        </Fieldset.Root>,
      );
      expect((screen.getByLabelText('Street') as HTMLInputElement).validationMessage).toBe('Check the address.');
      expect((screen.getByLabelText('Zip') as HTMLInputElement).validationMessage).toBe('');
    });

    it('lets go when the message goes', async () => {
      const { rerender } = await mount(<Nested message="Check the address." />);
      expect((screen.getByLabelText('Street') as HTMLInputElement).validationMessage).toBe('Check the address.');
      rerender(<Nested />);
      await settle();
      expect((screen.getByLabelText('Street') as HTMLInputElement).validationMessage).toBe('');
    });
  });

  describe('with no control to go on', () => {
    it('warns once in development', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      const { rerender } = render(<Fieldset.Root customValidity="Nope." />);
      rerender(<Fieldset.Root customValidity="Nope." />);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(String(warn.mock.calls[0]?.[0])).toContain('customValidity');
      warn.mockRestore();
    });

    it('does not warn for a message that finds a control, or for none', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      render(
        <>
          <Fieldset.Root customValidity="Nope.">
            <input aria-label="A" />
          </Fieldset.Root>
          <Fieldset.Root />
        </>,
      );
      expect(warn).not.toHaveBeenCalled();
      warn.mockRestore();
    });
  });

  it('skips a disabled first control in a fieldset outside a Form too', () => {
    render(
      <Fieldset.Root customValidity="Nope.">
        <Field.Root id="a" name="a" disabled>
          <Field.TextInput aria-label="A" value="" onValueChange={() => undefined} />
        </Field.Root>
        <Field.Root id="b" name="b">
          <Field.TextInput aria-label="B" value="" onValueChange={() => undefined} />
        </Field.Root>
      </Fieldset.Root>,
    );
    expect((screen.getByLabelText('A') as HTMLInputElement).validationMessage).toBe('');
    expect((screen.getByLabelText('B') as HTMLInputElement).validationMessage).toBe('Nope.');
  });
});

describe('invalid={false} on a control in a scope that shows', () => {
  it('leaves the error out of its aria-describedby too', async () => {
    await mount(
      <SignUp>
        <Field.Group data-testid="group">
          <Field.Root id="email" name="email" invalid={false}>
            <Field.TextInput aria-label="Work email" required value="" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByText('This field is required')).toBeTruthy();
    expect(input().getAttribute('aria-invalid')).toBeNull();
    expect(input().getAttribute('aria-describedby')).toBeNull();
  });
});
