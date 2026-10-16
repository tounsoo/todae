import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState, type FormEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StringsProvider } from '../providers/StringsProvider.js';
import { Button } from './Button.js';
import { Composer } from './Composer.js';
import { Field } from './Field.js';

afterEach(cleanup);

function Prompt({
  busy = false,
  disabled,
  onSend,
  onStop,
}: {
  busy?: boolean;
  disabled?: boolean;
  onSend: (submitter: HTMLElement | null) => void;
  onStop?: () => void;
}) {
  const [value, setValue] = useState('');
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSend((event.nativeEvent as SubmitEvent).submitter);
  };
  return (
    <Composer.Root busy={busy} onSubmit={submit}>
      <Field.Root aria-label="Message">
        <Field.Textarea value={value} onChange={(event) => setValue(event.target.value)} />
        <Field.Row>
          <Composer.Submit disabled={disabled} onStop={onStop} />
        </Field.Row>
      </Field.Root>
    </Composer.Root>
  );
}

describe('Composer', () => {
  it('sends on Enter through the send button, and leaves Shift+Enter and other modifiers to the textarea', () => {
    const onSend = vi.fn();
    render(<Prompt onSend={onSend} />);
    const field = screen.getByRole('textbox', { name: 'Message' });
    const send = screen.getByRole('button', { name: 'Send' });
    for (const mod of ['shiftKey', 'altKey', 'ctrlKey', 'metaKey']) {
      expect(fireEvent.keyDown(field, { key: 'Enter', [mod]: true })).toBe(true);
    }
    expect(onSend).not.toHaveBeenCalled();
    expect(fireEvent.keyDown(field, { key: 'Enter' })).toBe(false);
    expect(onSend).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledWith(send);
  });

  it('commits an IME composition on Enter without sending', () => {
    const onSend = vi.fn();
    render(<Prompt onSend={onSend} />);
    const field = screen.getByRole('textbox');
    expect(fireEvent.keyDown(field, { key: 'Enter', isComposing: true })).toBe(true);
    expect(fireEvent.keyDown(field, { key: 'Enter', keyCode: 229 })).toBe(true);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('sends nothing on Enter while the send button is disabled or the composer is busy', () => {
    const onSend = vi.fn();
    const { rerender } = render(<Prompt onSend={onSend} disabled />);
    expect(fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })).toBe(false);
    rerender(<Prompt onSend={onSend} busy onStop={() => {}} />);
    expect(fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' })).toBe(false);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('leaves Enter alone when a handler prevents it, or in a read-only textarea', () => {
    const onSend = vi.fn();
    render(
      <Composer.Root onSubmit={(event) => (event.preventDefault(), onSend())}>
        <textarea aria-label="Own" onKeyDown={(event) => event.preventDefault()} />
        <textarea aria-label="Read only" readOnly />
        <input aria-label="Line" />
      </Composer.Root>,
    );
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Own' }), { key: 'Enter' });
    expect(fireEvent.keyDown(screen.getByRole('textbox', { name: 'Read only' }), { key: 'Enter' })).toBe(true);
    expect(fireEvent.keyDown(screen.getByRole('textbox', { name: 'Line' }), { key: 'Enter' })).toBe(true);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('runs the product onKeyDown first, and skips sending when it prevents the key', () => {
    const onSend = vi.fn();
    render(
      <Composer.Root onKeyDown={(event) => event.preventDefault()} onSubmit={(event) => (event.preventDefault(), onSend())}>
        <textarea aria-label="Message" />
      </Composer.Root>,
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('turns into a Stop button while busy, which calls onStop and ignores disabled', () => {
    const onSend = vi.fn();
    const onStop = vi.fn();
    const { rerender } = render(<Prompt onSend={onSend} busy disabled onStop={onStop} />);
    const stop = screen.getByRole('button', { name: 'Stop' });
    expect(stop.getAttribute('type')).toBe('button');
    expect((stop as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(stop);
    expect(onStop).toHaveBeenCalledTimes(1);
    expect(onSend).not.toHaveBeenCalled();
    rerender(<Prompt onSend={onSend} busy />);
    expect((screen.getByRole('button', { name: 'Stop' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<Prompt onSend={onSend} />);
    expect(screen.getByRole('button', { name: 'Send' }).getAttribute('type')).toBe('submit');
    expect(document.querySelector('form')!.hasAttribute('data-busy')).toBe(false);
  });

  it('takes its names from StringsProvider, and its own aria-label or text first', () => {
    render(
      <StringsProvider strings={{ send: 'Envoyer', stop: 'Arrêter' }}>
        <Composer.Root aria-label="Prompt">
          <Composer.Submit />
          <Composer.Submit aria-label="Ask" />
          <Composer.Submit>Go</Composer.Submit>
        </Composer.Root>
        <Composer.Root aria-label="Busy" busy>
          <Composer.Submit onStop={() => {}} />
        </Composer.Root>
      </StringsProvider>,
    );
    expect(screen.getByRole('button', { name: 'Envoyer' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ask' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Go' }).hasAttribute('aria-label')).toBe(false);
    expect(screen.getByRole('button', { name: 'Arrêter' })).toBeTruthy();
    expect(screen.getByRole('form', { name: 'Busy' }).hasAttribute('data-busy')).toBe(true);
  });

  it('sends nothing while busy, from requestSubmit or a submit event', () => {
    const onSend = vi.fn();
    render(
      <Composer.Root busy aria-label="Prompt" onSubmit={onSend}>
        <Composer.Submit onStop={() => {}} />
      </Composer.Root>,
    );
    const form = screen.getByRole('form') as HTMLFormElement;
    form.requestSubmit();
    fireEvent.submit(form);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('takes an image input as the default button, in tree order', () => {
    const onSend = vi.fn();
    render(
      <Composer.Root onSubmit={(event) => (event.preventDefault(), onSend((event.nativeEvent as SubmitEvent).submitter))}>
        <textarea aria-label="Message" />
        <input type="image" alt="Send as image" disabled />
        <Composer.Submit />
      </Composer.Root>,
    );
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter' });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('names itself from the strings for an empty aria-label, empty children or icon-only content', () => {
    render(
      <Composer.Root>
        <Composer.Submit aria-label="" data-testid="empty-label" />
        <Composer.Submit data-testid="false-child">{false}</Composer.Submit>
        <Composer.Submit data-testid="icon-only">
          <Button.Icon>
            <svg viewBox="0 0 16 16" aria-hidden />
          </Button.Icon>
        </Composer.Submit>
      </Composer.Root>,
    );
    for (const id of ['empty-label', 'false-child', 'icon-only']) {
      expect(screen.getByTestId(id).getAttribute('aria-label')).toBe('Send');
    }
    expect(screen.getByTestId('false-child').querySelector('svg')).toBeTruthy();
  });

  it('throws for Composer.Submit outside Composer.Root', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Composer.Submit />)).toThrow('Composer.Submit must be rendered inside Composer.Root');
    error.mockRestore();
  });
});
