import { cleanup, render, screen } from '@testing-library/react';
import { page, server, userEvent } from 'vitest/browser';
import { useState, type CSSProperties, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { Alert } from '../components/Alert.js';
import { ErrorMessage } from '../components/ErrorMessage.js';
import { Field } from '../components/Field.js';
import { Form } from '../components/Form.js';
import { Meter } from '../components/Meter.js';
import { Progress } from '../components/Progress.js';
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

// The fill is a part inside the bar's own shadow tree, which neither getAnimations nor
// getComputedStyle reaches, so its length is read off a screenshot of the bar.
const fillColors = {
  ['--_todae-progress-track' as string]: 'rgb(0, 0, 255)',
  ['--_todae-progress-fill' as string]: 'rgb(255, 0, 0)',
  ['--_todae-meter-fill-optimum' as string]: 'rgb(255, 0, 0)',
  ['--_todae-progress-motion-fill-duration' as string]: '20s',
  ['--_todae-progress-motion-fill-easing' as string]: 'linear',
  ['--_todae-progress-height' as string]: '1rem',
  inlineSize: '20rem',
} satisfies CSSProperties;

/** Whether the bar shows fill, rather than track, three quarters of the way along. */
async function filledAtThreeQuarters(bar: HTMLElement): Promise<boolean> {
  const shot = await page.screenshot({ element: bar, save: false });
  const image = new Image();
  image.src = `data:image/png;base64,${shot}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);
  const [red, , blue] = context.getImageData(Math.floor(image.naturalWidth * 0.75), Math.floor(image.naturalHeight / 2), 1, 1).data;
  expect(Math.abs(red! - blue!), 'the pixel is the fill or the track color').toBeGreaterThan(100);
  return red! > blue!;
}

function Bars({ value }: { value: number }) {
  return (
    <div data-appearance="light" data-density="comfortable" style={fillColors}>
      <Progress.Root aria-label="Upload" max={100} value={value} />
      <Meter.Root aria-label="Storage" min={0} max={100} value={value} />
    </div>
  );
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

// Firefox draws the fill with no part to transition, so it jumps; motion only has to work in
// Chrome (ARCHITECTURE "Motion"), and Safari's engine draws the bar as Chrome does.
describe.skipIf(server.browser === 'firefox')('Progress and Meter fill motion', () => {
  it.each(['no-preference', 'reduce'] as const)('glides the fill to a new value, motion %s', async (value) => {
    await emulateMedia([{ name: 'prefers-reduced-motion', value }]);
    const { rerender } = render(<Bars value={0} />);
    const bars = [screen.getByLabelText('Upload'), screen.getByLabelText('Storage')];
    // A transition starts only from a style the empty fill already had. A frame callback runs
    // before that frame's style pass, so lay the bars out first rather than trust one frame.
    for (const bar of bars) void bar.offsetWidth;
    await frame();
    rerender(<Bars value={100} />);
    await frame();
    await frame();
    for (const bar of bars) {
      // A 20s glide has barely started, so three quarters along still shows track; reduced motion jumps.
      expect(await filledAtThreeQuarters(bar)).toBe(value === 'reduce');
    }
  });
});

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
