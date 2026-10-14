import { act, cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState, type FormEvent } from 'react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, Composer, Field } from '../index';

afterEach(cleanup);

function Chat({ onSend = () => {} }: { onSend?: (text: string, submitter: HTMLElement | null) => void }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSend(value, (event.nativeEvent as SubmitEvent).submitter);
    setValue('');
    setBusy(true);
  };
  return (
    <main data-appearance="light" data-density="comfortable" style={{ inlineSize: '30rem' }}>
      <Composer.Root busy={busy} onSubmit={submit} data-testid="root">
        <Field.Root aria-label="Message" data-testid="field">
          <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} autoGrow maxRows={6} />
          <Field.Row data-testid="row">
            <Button.Root variant="ghost" aria-label="Attach file" data-testid="attach">
              <Button.Icon>
                <svg viewBox="0 0 16 16" aria-hidden />
              </Button.Icon>
            </Button.Root>
            <Composer.Submit disabled={value.trim() === ''} onStop={() => setBusy(false)} data-testid="submit" />
          </Field.Row>
        </Field.Root>
      </Composer.Root>
    </main>
  );
}

describe('Composer in a browser', () => {
  it('sends on Enter and adds a line on Shift+Enter', async () => {
    const onSend = vi.fn();
    render(<Chat onSend={onSend} />);
    const field = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
    await userEvent.click(field);
    await userEvent.keyboard('Hello{Shift>}{Enter}{/Shift}there');
    expect(field.value).toBe('Hello\nthere');
    await userEvent.keyboard('{Enter}');
    expect(onSend).toHaveBeenCalledWith('Hello\nthere', screen.getByTestId('submit'));
    expect(field.value).toBe('');
    expect(document.activeElement).toBe(field);
  });

  it('puts the send button at the end of the row', () => {
    render(<Chat />);
    const row = screen.getByTestId('row').getBoundingClientRect();
    const attach = screen.getByTestId('attach').getBoundingClientRect();
    const submit = screen.getByTestId('submit').getBoundingClientRect();
    const padding = parseFloat(getComputedStyle(screen.getByTestId('row')).paddingInlineEnd);
    expect(attach.left).toBeLessThan(row.left + row.width / 2);
    expect(Math.abs(row.right - padding - submit.right)).toBeLessThan(1);
  });

  it('moves focus to the text field when Stop turns back into a disabled Send', async () => {
    render(<Chat />);
    const field = screen.getByRole('textbox', { name: 'Message' });
    await userEvent.click(field);
    await userEvent.keyboard('Hi{Enter}');
    const stop = screen.getByRole('button', { name: 'Stop' });
    stop.focus();
    await userEvent.keyboard('{Enter}');
    const send = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
    expect(send).toBe(stop);
    expect(send.disabled).toBe(true);
    expect(document.activeElement).toBe(field);
  });

  it('keeps focus on the button as Send turns into Stop', async () => {
    render(<Chat />);
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.keyboard('Hi');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await act(async () => {});
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Stop' }));
  });

  it('stops without sending what was typed while the reply ran, by click or by key', async () => {
    const onSend = vi.fn();
    render(<Chat onSend={onSend} />);
    const field = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
    await userEvent.click(field);
    await userEvent.keyboard('Hi{Enter}next draft');
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy();
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(field.value).toBe('next draft');
    for (const key of ['{Enter}', ' ']) {
      await userEvent.click(field);
      await userEvent.keyboard('{Enter}draft');
      const sends = onSend.mock.calls.length;
      screen.getByRole('button', { name: 'Stop' }).focus();
      await userEvent.keyboard(key);
      expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy();
      expect(onSend).toHaveBeenCalledTimes(sends);
    }
    expect(onSend).toHaveBeenCalledTimes(3);
  });

  it('sends nothing on Enter, and moves focus to the text field, when a fieldset disables the send button', async () => {
    const onSend = vi.fn();
    function Fenced() {
      const [off, setOff] = useState(false);
      return (
        <Composer.Root onSubmit={(event) => (event.preventDefault(), onSend())}>
          <textarea aria-label="Message" />
          <fieldset disabled={off}>
            <legend>Actions</legend>
            <Composer.Submit onFocus={() => setOff(true)} />
          </fieldset>
        </Composer.Root>
      );
    }
    render(<Fenced />);
    screen.getByRole('button', { name: 'Send' }).focus();
    await act(async () => {});
    const field = screen.getByRole('textbox');
    expect(document.activeElement).toBe(field);
    await userEvent.keyboard('{Enter}');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('passes axe', async () => {
    render(<Chat />);
    const results = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
