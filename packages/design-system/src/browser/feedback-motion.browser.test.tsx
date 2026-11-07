import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Alert } from '../components/Alert.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { Field } from '../components/Field.js';
import { Form } from '../components/Form.js';
import { emulateMedia } from '../test/media.js';

afterEach(async () => {
  cleanup();
  await emulateMedia([]);
});

const slow = {
  ['--_todae-alert-motion-duration-enter' as string]: '1s',
  ['--_todae-alert-motion-easing-enter' as string]: 'linear',
  ['--_todae-field-error-motion-duration-enter' as string]: '1s',
  ['--_todae-field-error-motion-easing-enter' as string]: 'linear',
} satisfies CSSProperties;

function Themed({ children }: { children: ReactNode }) {
  return (
    <div data-appearance="light" data-density="comfortable" style={slow}>
      {children}
    </div>
  );
}

const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));

function runningOpacity(el: Element): boolean {
  return el
    .getAnimations()
    .some((a) => a instanceof CSSTransition && a.playState === 'running' && a.transitionProperty === 'opacity');
}

async function settle(el: Element) {
  await Promise.all(el.getAnimations().map((a) => a.finished));
}

function SaveAlert() {
  const [saved, setSaved] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setSaved(true)}>
        Save
      </button>
      {saved && (
        <Alert.Root tone="critical">
          <Alert.Description>Saving failed.</Alert.Description>
        </Alert.Root>
      )}
    </>
  );
}

function EmailForm() {
  const [email, setEmail] = useState('');
  return (
    <Form.Root aria-label="Sign up" onSubmit={(event) => event.preventDefault()}>
      <Field.Group>
        <Field.Root id="email" name="email">
          <Field.TextInput aria-label="Work email" required value={email} onValueChange={setEmail} />
        </Field.Root>
        <ErrorMessage.Root />
      </Field.Group>
      <button type="submit">Sign up</button>
    </Form.Root>
  );
}

describe('Alert and ErrorMessage motion', () => {
  it.each(['no-preference', 'reduce'] as const)(
    'fades an alert in, with its text and role there from the first frame, motion %s',
    async (value) => {
      await emulateMedia([{ name: 'prefers-reduced-motion', value }]);
      render(
        <Themed>
          <SaveAlert />
        </Themed>,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Save' }));
      // In the tree and announced at once: the fade changes only how it looks.
      const alert = screen.getByRole('alert');
      expect(alert.textContent).toBe('Saving failed.');
      await frame();
      expect(runningOpacity(alert)).toBe(true);
      expect(Number(getComputedStyle(alert).opacity)).toBeLessThan(1);
      await settle(alert);
      expect(getComputedStyle(alert).opacity).toBe('1');
    },
  );

  it.each(['no-preference', 'reduce'] as const)(
    'fades a validation error in while the control already points at it, motion %s',
    async (value) => {
      await emulateMedia([{ name: 'prefers-reduced-motion', value }]);
      render(
        <Themed>
          <EmailForm />
        </Themed>,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Sign up' }));
      const input = screen.getByRole('textbox', { name: 'Work email' });
      const error = await screen.findByText((_, el) => el?.hasAttribute('data-todae-error') ?? false);
      expect(input.getAttribute('aria-invalid')).toBe('true');
      expect(input.getAttribute('aria-describedby')?.split(' ')).toContain(error.id);
      await frame();
      expect(runningOpacity(error)).toBe(true);
      await settle(error);
      expect(getComputedStyle(error).opacity).toBe('1');
    },
  );

  it('keeps an alert still when only its text changes', async () => {
    function Status() {
      const [count, setCount] = useState(1);
      return (
        <>
          <button type="button" onClick={() => setCount((n) => n + 1)}>
            Add
          </button>
          <Alert.Root tone="info">
            <Alert.Description>{count} saved</Alert.Description>
          </Alert.Root>
        </>
      );
    }
    render(
      <Themed>
        <Status />
      </Themed>,
    );
    const status = screen.getByRole('status');
    await settle(status);
    await userEvent.click(screen.getByRole('button', { name: 'Add' }));
    await frame();
    expect(status.textContent).toBe('2 saved');
    expect(runningOpacity(status)).toBe(false);
    expect(getComputedStyle(status).opacity).toBe('1');
  });
});
