import { act, cleanup, fireEvent, screen } from '@testing-library/react';
import { useContext, useEffect, useState, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ErrorMessage } from './ErrorMessage.js';
import { Field } from './Field.js';
import { Form } from './Form.js';
import { FormContext } from './Form.context.js';
import { EmailField, input, mount, settle, SignUp, submit, type } from '../test/form.js';

afterEach(cleanup);

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

  it('stays hidden for inline errors rebuilt on every render, key after key', async () => {
    function Inline() {
      const [email, setEmail] = useState('');
      return (
        <Form.Root data-testid="form" errors={{ email: 'Taken.' }}>
          <Field.Group>
            <Field.Root id="email" name="email">
              <Field.TextInput aria-label="Work email" value={email} onValueChange={setEmail} />
            </Field.Root>
            <ErrorMessage.Root />
          </Field.Group>
        </Form.Root>
      );
    }
    await mount(<Inline />);
    expect(screen.getByText('Taken.')).toBeTruthy();
    await type(input(), 'b');
    await type(input(), 'be');
    await type(input(), 'ben');
    expect(screen.queryByText('Taken.')).toBeNull();
  });

  it('stays hidden for a new errors object with the same text', async () => {
    const { rerender } = await mount(<SignUp errors={{ email: 'Taken.' }} />);
    await type(input(), 'ben@example.com');
    rerender(<SignUp errors={{ email: 'Taken.' }} />);
    await settle();
    expect(screen.queryByText('Taken.')).toBeNull();
  });

  it('is shown again when its text changes', async () => {
    const { rerender } = await mount(<SignUp errors={{ email: 'Taken.' }} />);
    await type(input(), 'ben@example.com');
    rerender(<SignUp errors={{ email: 'Blocked.' }} />);
    await settle();
    expect(screen.getByText('Blocked.')).toBeTruthy();
  });

  it('is shown again by the same text after a second failed submit', async () => {
    await mount(
      <SignUp errors={{ email: 'Taken.' }}>
        <EmailField required={false} />
        <input aria-label="Other" required />
      </SignUp>,
    );
    await type(input(), 'ben@example.com');
    expect(screen.queryByText('Taken.')).toBeNull();
    await submit(screen.getByTestId('form'));
    expect(screen.getByText('Taken.')).toBeTruthy();
  });

  it('is hidden by a reset, until a different text arrives', async () => {
    const { rerender } = await mount(
      <SignUp errors={{ email: 'Taken.' }}>
        <EmailField />
      </SignUp>,
    );
    expect(screen.getByText('Taken.')).toBeTruthy();
    await act(async () => {
      fireEvent.reset(screen.getByTestId('form'));
    });
    expect(screen.queryByText('Taken.')).toBeNull();
    rerender(
      <SignUp errors={{ email: 'Taken.' }}>
        <EmailField />
      </SignUp>,
    );
    await settle();
    expect(screen.queryByText('Taken.')).toBeNull();
    rerender(
      <SignUp errors={{ email: 'Blocked.' }}>
        <EmailField />
      </SignUp>,
    );
    await settle();
    expect(screen.getByText('Blocked.')).toBeTruthy();
  });

  it('changes nothing for an edit to a control with no server error', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    let renders = 0;
    function Probe() {
      useContext(FormContext);
      renders += 1;
      return null;
    }
    await mount(
      <SignUp errors={{ other: 'Nope.' }}>
        <Probe />
        <EmailField />
      </SignUp>,
    );
    const before = renders;
    await type(input(), 'a');
    await type(input(), 'ab');
    expect(renders).toBe(before);
    warn.mockRestore();
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
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await mount(<SignUp errors={{ nobody: 'Hi.', email: '' }} />);
    expect(screen.queryByText('Hi.')).toBeNull();
    expect(input().getAttribute('aria-invalid')).toBeNull();
  });
});

describe('which server error a scope shows', () => {
  it('shows a later control\'s server error before an earlier control\'s native problem', async () => {
    await mount(
      <SignUp errors={{ handle: 'Taken.' }}>
        <Field.Group>
          <Field.Root id="name" name="name">
            <Field.TextInput aria-label="Name" required value="" onValueChange={() => undefined} />
          </Field.Root>
          <Field.Root id="handle" name="handle">
            <Field.TextInput aria-label="Handle" value="ben" onValueChange={() => undefined} />
          </Field.Root>
          <ErrorMessage.Root data-testid="message" />
        </Field.Group>
      </SignUp>,
    );
    await submit(screen.getByTestId('form'));
    expect(screen.getByTestId('message').textContent).toBe('Taken.');
  });
});

describe('an error nothing can show', () => {
  function warnings() {
    return vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  }
  /** Sends a valid form, then answers with `errors`. */
  async function reply(children: ReactNode, errors: Record<string, string>) {
    const ui = (e: Record<string, string>) => (
      <SignUp errors={e}>
        <EmailField />
        {children}
      </SignUp>
    );
    const view = await mount(ui({}));
    await type(input(), 'ben@example.com');
    await submit(screen.getByTestId('form'));
    view.rerender(ui(errors));
    await settle();
    return { ...view, ui };
  }

  it('warns in development, when the reply comes, for a name no control has', async () => {
    const warn = warnings();
    await reply(null, { ghost: 'Nobody home.' });
    await act(async () => new Promise((resolve) => setTimeout(resolve)));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('ghost');
    warn.mockRestore();
  });

  it('does not warn for a control that mounts in a scope just after the reply, ', async () => {
    const warn = warnings();
    function Late({ errors }: { errors: Record<string, string> }) {
      const [on, setOn] = useState(false);
      useEffect(() => {
        if (errors.late) setOn(true);
      }, [errors]);
      return (
        <SignUp errors={errors}>
          <EmailField />
          {on ? (
            <Field.Group>
              <Field.Root id="late" name="late">
                <Field.TextInput aria-label="Late" value="" onValueChange={() => undefined} />
              </Field.Root>
              <ErrorMessage.Root />
            </Field.Group>
          ) : null}
        </SignUp>
      );
    }
    const view = await mount(<Late errors={{}} />);
    await type(input(), 'ben@example.com');
    await submit(screen.getByTestId('form'));
    view.rerender(<Late errors={{ late: 'No.' }} />);
    await act(async () => new Promise((resolve) => setTimeout(resolve, 20)));
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns for a control that no scope owns, once however often it renders', async () => {
    const warn = warnings();
    const { rerender, ui } = await reply(<input name="plain" aria-label="Plain" />, { plain: 'No.' });
    rerender(ui({ plain: 'No.' }));
    await settle();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('plain');
    warn.mockRestore();
  });

  it('warns again for the same name in another form', async () => {
    const warn = warnings();
    await reply(<input name="plain2" aria-label="Plain" />, { plain2: 'No.' });
    cleanup();
    await reply(<input name="plain2" aria-label="Plain" />, { plain2: 'No.' });
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('does not warn for errors that no send is waiting for', async () => {
    const warn = warnings();
    const { rerender } = await mount(<SignUp errors={{ ghost: 'Nobody home.' }} />);
    rerender(<SignUp errors={{ ghost: 'Still nobody.' }} />);
    await settle();
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not warn for a control in a scope, or for an empty entry', async () => {
    const warn = warnings();
    await reply(null, { email: 'Taken.', ghost: '' });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('a dismissal lasts while the entry does', () => {
  it('is forgotten when errors drops the name, so the same text shows again', async () => {
    const { rerender } = await mount(<SignUp errors={{ email: 'Taken.' }} />);
    await type(input(), 'ben@example.com');
    expect(screen.queryByText('Taken.')).toBeNull();
    // An availability check: clear while it runs, set when it answers.
    rerender(<SignUp errors={{}} />);
    await settle();
    rerender(<SignUp errors={{ email: 'Taken.' }} />);
    await settle();
    expect(screen.getByText('Taken.')).toBeTruthy();
  });

  it('is kept for the same content in a new object', async () => {
    const { rerender } = await mount(<SignUp errors={{ email: 'Taken.' }} />);
    await type(input(), 'ben@example.com');
    rerender(<SignUp errors={{ email: 'Taken.' }} />);
    await settle();
    expect(screen.queryByText('Taken.')).toBeNull();
  });
});

describe('a reply while waiting', () => {
  function Sending({ errors }: { errors: Record<string, string> }) {
    return (
      <SignUp errors={errors}>
        <EmailField />
        <input aria-label="Other" />
      </SignUp>
    );
  }

  it('is an identical retry when the product cleared errors on send', async () => {
    const { rerender } = await mount(<Sending errors={{ email: 'Taken.' }} />);
    await type(input(), 'ben@example.com');
    await submit(screen.getByTestId('form'));
    // onSubmit clears errors and the request goes out.
    rerender(<Sending errors={{}} />);
    await settle();
    screen.getByLabelText('Other').focus();
    rerender(<Sending errors={{ email: 'Taken.' }} />);
    await settle();
    expect(screen.getByText('Taken.')).toBeTruthy();
    expect(document.activeElement).toBe(input());
  });

  it('is not an inline rebuild of the same content', async () => {
    const { rerender } = await mount(<Sending errors={{ email: 'Taken.' }} />);
    await type(input(), 'ben@example.com');
    await submit(screen.getByTestId('form'));
    screen.getByLabelText('Other').focus();
    rerender(<Sending errors={{ email: 'Taken.' }} />);
    await settle();
    expect(document.activeElement).toBe(screen.getByLabelText('Other'));
  });
});
