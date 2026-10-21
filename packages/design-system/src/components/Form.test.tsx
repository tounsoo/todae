import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorMessage } from './ErrorMessage.js';
import { Field } from './Field.js';
import { Fieldset } from './Fieldset.js';
import { Form } from './Form.js';
import { StringsProvider } from '../providers/StringsProvider.js';
import * as api from '../index.js';
import { blur, EmailField, input, mount, settle, SignUp, submit, type } from '../test/form.js';

afterEach(cleanup);

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

describe('a portaled form inside a Form.Root', () => {
  it('does not reach the root\'s onSubmit, and is not checked by it', async () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onInner = vi.fn((event: React.FormEvent) => event.preventDefault());
    await mount(
      <SignUp onSubmit={onSubmit}>
        <EmailField />
        {createPortal(
          <form data-testid="inner" onSubmit={onInner}>
            <input aria-label="Inner" />
          </form>,
          document.body,
        )}
      </SignUp>,
    );
    await submit(screen.getByTestId('inner'));
    expect(onInner).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
    // The outer form was not attempted, so it shows nothing.
    expect(screen.queryByText('This field is required')).toBeNull();
  });
});

describe('a portaled element inside a Form.Root', () => {
  it('resets only its own form, not the root', async () => {
    const onReset = vi.fn();
    await mount(
      <Form.Root data-testid="form" errors={{ email: 'Taken.' }} onReset={onReset}>
        <EmailField />
        {createPortal(
          <form data-testid="inner">
            <input aria-label="Inner" />
          </form>,
          document.body,
        )}
      </Form.Root>,
    );
    await act(async () => {
      fireEvent.reset(screen.getByTestId('inner'));
    });
    // Like onSubmit, the consumer's handler hears only its own form's reset.
    expect(onReset).not.toHaveBeenCalled();
    expect(screen.getByText('Taken.')).toBeTruthy();
  });

  it('tells its own onReset about its own form\'s reset', async () => {
    const onReset = vi.fn();
    await mount(
      <Form.Root data-testid="form" onReset={onReset}>
        <EmailField />
      </Form.Root>,
    );
    await act(async () => {
      fireEvent.reset(screen.getByTestId('form'));
    });
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('changes nothing in the root or its scope when a portaled input is edited', async () => {
    await mount(
      <SignUp errors={{ email: 'Taken.' }}>
        <Field.Group>
          <Field.Root id="email" name="email">
            <Field.TextInput aria-label="Work email" value="" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root />
          {createPortal(<input aria-label="Elsewhere" name="email" />, document.body)}
        </Field.Group>
      </SignUp>,
    );
    await type(screen.getByLabelText('Elsewhere'), 'ben');
    expect(screen.getByText('Taken.')).toBeTruthy();
  });
});

describe('a change in a nested scope', () => {
  it('does not touch the outer scope, so leaving it reveals only the inner one\'s own problems', async () => {
    await mount(
      <SignUp>
        <Fieldset.Root>
          <Fieldset.Legend>Address</Fieldset.Legend>
          <Field.Group>
            <Field.Root id="street" name="street">
              <Field.TextInput aria-label="Street" value="" onValueChange={() => undefined} />
            </Field.Root>
          </Field.Group>
          <Field.Root id="zip" name="zip">
            <Field.TextInput aria-label="Zip" required value="" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root data-testid="outer-error" />
        </Fieldset.Root>
      </SignUp>,
    );
    await type(screen.getByLabelText('Street'), 'Main');
    await blur(screen.getByLabelText('Street'));
    expect(screen.queryByTestId('outer-error')).toBeNull();
  });
});

describe('a send without the check', () => {
  function Draft({ errors, required }: { errors: Record<string, string>; required?: boolean }) {
    return (
      <Form.Root data-testid="form" errors={errors} onSubmit={(event) => event.preventDefault()}>
        <EmailField required={required} />
        <Field.Group>
          <Field.Root id="nick" name="nick">
            <Field.TextInput aria-label="Nick" value="" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root />
        </Field.Group>
        <input aria-label="Other" />
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

  it('shows a dismissed server error again, and reveals nothing the person has not reached', async () => {
    await mount(<Draft errors={{ nick: 'Taken.' }} />);
    await type(screen.getByLabelText('Nick'), 'ben');
    expect(screen.queryByText('Taken.')).toBeNull();
    await save();
    expect(screen.getByText('Taken.')).toBeTruthy();
    expect(screen.queryByText('This field is required')).toBeNull();
  });

  it('waits for a reply, which takes focus only when its content differs', async () => {
    const { rerender } = await mount(<Draft required={false} errors={{ nick: 'Taken.' }} />);
    await save();
    screen.getByLabelText('Other').focus();
    rerender(<Draft required={false} errors={{ nick: 'Taken.' }} />);
    await settle();
    expect(document.activeElement).toBe(screen.getByLabelText('Other'));
    rerender(<Draft required={false} errors={{ nick: 'Blocked.' }} />);
    await settle();
    expect(document.activeElement).toBe(screen.getByLabelText('Nick'));
  });

  it('leaves the summary\'s list as it was', async () => {
    await mount(
      <Form.Root data-testid="form" onSubmit={(event) => event.preventDefault()}>
        <Form.Summary data-testid="summary" />
        <EmailField />
        <button type="submit">Send</button>
        <button type="submit" formNoValidate>
          Save draft
        </button>
      </Form.Root>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    });
    expect(screen.getByTestId('summary')).toBeTruthy();
    await save();
    expect(screen.getByTestId('summary')).toBeTruthy();
  });
});

describe('a server error on a control that does not validate', () => {
  it('shows for a disabled control and a read-only one, with no warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await mount(
      <SignUp errors={{ handle: 'Taken.', pin: 'Reserved.' }}>
        <Field.Group>
          <Field.Root id="handle" name="handle" disabled>
            <Field.TextInput aria-label="Handle" value="ben" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root data-testid="handle-error" />
        </Field.Group>
        <Field.Group>
          <Field.Root id="pin" name="pin">
            <Field.TextInput aria-label="Pin" readOnly value="1234" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root data-testid="pin-error" />
        </Field.Group>
      </SignUp>,
    );
    expect(screen.getByTestId('handle-error').textContent).toBe('Taken.');
    expect(screen.getByTestId('pin-error').textContent).toBe('Reserved.');
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('a native reset', () => {
  it('is read again once the browser has applied it', async () => {
    await mount(
      <SignUp>
        <Field.Group>
          <input aria-label="Plain" required />
          <ErrorMessage.Root data-testid="message" />
        </Field.Group>
      </SignUp>,
    );
    const plain = screen.getByLabelText('Plain') as HTMLInputElement;
    await act(async () => {
      fireEvent.change(plain, { target: { value: 'abc' } });
    });
    // The browser clears the value after the event's handlers return and before any timer, once the scopes have read the old one.
    setTimeout(() => {
      plain.value = '';
    });
    await act(async () => {
      fireEvent.reset(screen.getByTestId('form'));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    // Synchronously: no microtask runs between the submit and the check.
    act(() => {
      fireEvent.submit(screen.getByTestId('form'));
    });
    expect(screen.getByTestId('message').textContent).toBe('This field is required');
  });
});

describe('an ErrorMessage whose wrapper passes an undefined id', () => {
  it('takes the scope\'s error, as with no id', async () => {
    const id = undefined as string | undefined;
    await mount(
      <SignUp>
        <Field.Group>
          <input aria-label="Plain" required />
          <ErrorMessage.Root id={id}>Say something.</ErrorMessage.Root>
        </Field.Group>
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByText('Say something.')).toBeTruthy();
  });
});

describe('a blur that leaves nothing behind', () => {
  it('does not reveal a problem when the window loses focus and the field stays active', async () => {
    await mount(<SignUp />);
    await type(input(), 'a');
    await type(input(), '');
    await act(async () => input().focus());
    // A switch to another window blurs with no relatedTarget and keeps the active element.
    await blur(input());
    expect(document.activeElement).toBe(input());
    expect(screen.queryByText('This field is required')).toBeNull();
  });

  it('reveals once focus has really gone', async () => {
    await mount(<SignUp />);
    await type(input(), 'a');
    await type(input(), '');
    await act(async () => input().focus());
    await act(async () => input().blur());
    await act(async () => new Promise((resolve) => setTimeout(resolve)));
    expect(screen.getByText('This field is required')).toBeTruthy();
  });
});
