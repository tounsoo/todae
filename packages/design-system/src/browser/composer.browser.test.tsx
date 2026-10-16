import { act, cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Button, Composer, Field } from '../index.js';

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

  it('sends nothing past a disabled send button inside a shadow root, and names the button as submitter', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' });
    const onSend = vi.fn();
    const root = createRoot(shadow);
    const mount = (disabled: boolean) =>
      root.render(
        <Composer.Root onSubmit={(event) => (event.preventDefault(), onSend(event.nativeEvent.submitter))}>
          <textarea aria-label="Message" />
          <Composer.Submit disabled={disabled} />
        </Composer.Root>,
      );
    try {
      await act(async () => mount(true));
      const field = shadow.querySelector('textarea')!;
      field.focus();
      await userEvent.keyboard('{Enter}');
      expect(onSend).not.toHaveBeenCalled();
      await act(async () => mount(false));
      await userEvent.keyboard('{Enter}');
      expect(onSend).toHaveBeenCalledWith(shadow.querySelector('button'));
    } finally {
      await act(async () => root.unmount());
      host.remove();
    }
  });

  it('sends nothing on Enter in a text input while busy', async () => {
    const onSend = vi.fn();
    render(
      <Composer.Root busy onSubmit={(event) => (event.preventDefault(), onSend())}>
        <input aria-label="Line" />
        <Composer.Submit onStop={() => {}} />
      </Composer.Root>,
    );
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.keyboard('{Enter}');
    expect(onSend).not.toHaveBeenCalled();
  });

  it('acts once for a double click or a held Enter, in either mode', async () => {
    const onSend = vi.fn();
    render(<Chat onSend={onSend} />);
    const field = screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;
    await userEvent.click(field);
    await userEvent.keyboard('Hi{Enter}next draft');
    await userEvent.dblClick(screen.getByRole('button', { name: 'Stop' }));
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy();
    await userEvent.dblClick(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    await userEvent.click(field);
    await userEvent.keyboard('again');
    screen.getByRole('button', { name: 'Send' }).focus();
    await userEvent.keyboard('{Enter>4/}');
    expect(onSend).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', { name: 'Stop' })).toBeTruthy();
  });

  it('leaves focus alone on a focusout of a button that was already disabled', async () => {
    render(
      <Composer.Root>
        <textarea aria-label="Message" />
        <Composer.Submit disabled />
      </Composer.Root>,
    );
    const send = screen.getByRole('button', { name: 'Send' });
    await act(async () => {
      send.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(document.activeElement).toBe(document.body);
  });

  it('sends once for a held Enter in the textarea, even before busy is set', async () => {
    const onSend = vi.fn();
    render(
      <Composer.Root onSubmit={(event) => (event.preventDefault(), onSend())}>
        <textarea aria-label="Message" />
        <Composer.Submit />
      </Composer.Root>,
    );
    await userEvent.click(screen.getByRole('textbox'));
    await userEvent.keyboard('{Enter>5/}');
    expect(onSend).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('');
  });

  it("leaves the submit of a form portaled inside it to that form, busy or not", async () => {
    const outer = vi.fn();
    const inner = vi.fn();
    function Portaled({ busy }: { busy: boolean }) {
      return (
        <Composer.Root busy={busy} onSubmit={(event) => (event.preventDefault(), outer())}>
          <textarea aria-label="Message" />
          {createPortal(
            <form aria-label="Link" onSubmit={() => inner()}>
              <button type="submit">Add link</button>
            </form>,
            document.body,
          )}
        </Composer.Root>
      );
    }
    const { rerender } = render(<Portaled busy={false} />);
    const form = () => screen.getByRole('form', { name: 'Link' }) as HTMLFormElement;
    const cancelled: boolean[] = [];
    const listener = (event: Event) => {
      cancelled.push(event.defaultPrevented);
      event.preventDefault();
    };
    window.addEventListener('submit', listener);
    try {
      form().requestSubmit();
      rerender(<Portaled busy />);
      form().requestSubmit();
    } finally {
      window.removeEventListener('submit', listener);
    }
    expect(inner).toHaveBeenCalledTimes(2);
    expect(outer).not.toHaveBeenCalled();
    expect(cancelled).toEqual([false, false]);
  });

  it('passes axe', async () => {
    render(<Chat />);
    const results = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
