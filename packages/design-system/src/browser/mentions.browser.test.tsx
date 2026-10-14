import { act, cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState, type FormEvent } from 'react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Composer, Field, OptionList, Popover, useMentions, type MentionToken, type MentionTrigger } from '../index';

afterEach(cleanup);

const people = [
  { value: 'ada', label: 'Ada Lovelace' },
  { value: 'alan', label: 'Alan Turing' },
  { value: 'grace', label: 'Grace Hopper' },
];
const commands = [
  { value: 'summarize', label: 'summarize' },
  { value: 'translate', label: 'translate' },
];
const TRIGGERS: MentionTrigger[] = [
  { char: '@', options: people, label: 'People' },
  { char: '/', position: 'start', options: commands, label: 'Commands' },
];

function Chat({
  onSend = () => {},
  onTokens = () => {},
  dir,
}: {
  onSend?: (text: string, tokens: readonly MentionToken[]) => void;
  onTokens?: (tokens: MentionToken[]) => void;
  dir?: 'rtl';
}) {
  const [value, setValue] = useState('');
  const mentions = useMentions({ triggers: TRIGGERS, value, onValueChange: setValue, onTokensChange: onTokens });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSend(value, mentions.tokens);
    setValue('');
  };
  return (
    <main data-appearance="light" data-density="comfortable" style={{ inlineSize: '24rem' }} dir={dir}>
      <Composer.Root onSubmit={submit}>
        <Field.Root aria-label="Message">
          <Field.Textarea {...mentions.getTextareaProps()} autoGrow maxRows={4} />
          <Field.Row>
            <Composer.Submit disabled={value.trim() === ''} />
          </Field.Row>
        </Field.Root>
      </Composer.Root>
      <Popover.Root {...mentions.getPopoverProps()}>
        <OptionList.Root {...mentions.getListboxProps()}>
          {mentions.items.map((item) => (
            <OptionList.Option key={item.id} {...mentions.getOptionProps(item)} />
          ))}
        </OptionList.Root>
      </Popover.Root>
    </main>
  );
}

const field = () => screen.getByRole('textbox', { name: 'Message' }) as HTMLTextAreaElement;

describe('useMentions in a browser', () => {
  it('opens a list after @, picks with Enter without sending, and sends the token with the text', async () => {
    const onSend = vi.fn();
    render(<Chat onSend={onSend} />);
    await userEvent.click(field());
    await userEvent.keyboard('Hi @a');
    const list = screen.getByRole('listbox', { name: 'People' });
    expect(field().getAttribute('aria-controls')).toBe(list.id);
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['Ada Lovelace', 'Alan Turing', 'Grace Hopper']);
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(onSend).not.toHaveBeenCalled();
    expect(field().value).toBe('Hi @Alan Turing ');
    expect(field().selectionStart).toBe(16);
    expect(screen.queryByRole('listbox')).toBeNull();
    await userEvent.keyboard('there{Enter}');
    expect(onSend).toHaveBeenCalledWith('Hi @Alan Turing there', [
      { start: 3, end: 15, char: '@', value: 'alan', text: '@Alan Turing' },
    ]);
  });

  it('puts the list under the word being typed', async () => {
    render(<Chat />);
    await userEvent.click(field());
    await userEvent.keyboard('Some words then @a');
    const popover = screen.getByRole('listbox').closest('[popover]')!.getBoundingClientRect();
    const box = field().getBoundingClientRect();
    expect(popover.top).toBeGreaterThan(box.top);
    expect(popover.left).toBeGreaterThan(box.left + 40);
  });

  it('draws a token behind its own text, wrapped and scrolled like the textarea', async () => {
    render(<Chat />);
    await userEvent.click(field());
    await userEvent.keyboard('A long line of words that wraps, @gr{Enter}and more{Shift>}{Enter}{Enter}{Enter}{Enter}{Enter}{/Shift}end');
    const token = document.querySelector('[data-kind="@"]')!;
    expect(token.textContent).toBe('@Grace Hopper');
    const el = field();
    const layer = token.parentElement!;
    const layerRect = layer.getBoundingClientRect();
    const boxRect = el.getBoundingClientRect();
    expect(Math.abs(layerRect.top - boxRect.top)).toBeLessThan(1);
    expect(Math.abs(layerRect.left - boxRect.left)).toBeLessThan(1);
    expect(Math.abs(layerRect.width - boxRect.width)).toBeLessThan(1);
    expect(Math.abs(layerRect.height - boxRect.height)).toBeLessThan(1);
    // The same lines: the text wraps at the same places and fills the same height.
    expect(el.scrollHeight).toBeGreaterThan(el.clientHeight);
    expect(layer.scrollHeight).toBe(el.scrollHeight);
    await act(async () => {
      el.scrollTop = 0;
      el.dispatchEvent(new Event('scroll'));
    });
    expect(layer.scrollTop).toBe(0);
    await act(async () => {
      el.scrollTop = el.scrollHeight;
      el.dispatchEvent(new Event('scroll'));
    });
    expect(layer.scrollTop).toBe(el.scrollTop);
  });

  it('undoes a pick back to the typed word, and redo brings the token back', async () => {
    const onTokens = vi.fn();
    render(<Chat onTokens={onTokens} />);
    await userEvent.click(field());
    await userEvent.keyboard('@ad{Enter}');
    expect(field().value).toBe('@Ada Lovelace ');
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(field().value).toBe('@ad');
    expect(onTokens).toHaveBeenLastCalledWith([]);
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(field().value).toBe('@Ada Lovelace ');
    expect(onTokens).toHaveBeenLastCalledWith([{ start: 0, end: 13, char: '@', value: 'ada', text: '@Ada Lovelace' }]);
  });

  it('removes a whole token with one Backspace at its end', async () => {
    render(<Chat />);
    await userEvent.click(field());
    await userEvent.keyboard('Hi @ad{Enter}{Backspace}{Backspace}');
    expect(field().value).toBe('Hi ');
    expect(document.querySelector('[data-kind="@"]')).toBeNull();
  });

  it('opens slash commands only at the start', async () => {
    render(<Chat />);
    await userEvent.click(field());
    await userEvent.keyboard('see /tr');
    expect(screen.queryByRole('listbox')).toBeNull();
    await userEvent.clear(field());
    await userEvent.keyboard('/tr');
    expect(screen.getByRole('listbox', { name: 'Commands' })).toBeTruthy();
    await userEvent.keyboard('{Tab}');
    expect(field().value).toBe('/translate ');
  });

  it('closes on Escape for that word, and on a click that moves the caret away', async () => {
    render(<Chat />);
    await userEvent.click(field());
    await userEvent.keyboard('@a');
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    await userEvent.keyboard('d');
    expect(screen.queryByRole('listbox')).toBeNull();
    await userEvent.keyboard(' @g');
    expect(screen.getByRole('listbox')).toBeTruthy();
    // selectionchange, which React reads for onSelect, fires after the caret moves.
    await act(async () => {
      field().setSelectionRange(0, 0);
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('picks with a click and keeps focus in the textarea', async () => {
    render(<Chat />);
    await userEvent.click(field());
    await userEvent.keyboard('@gr');
    await userEvent.click(screen.getByRole('option', { name: 'Grace Hopper' }));
    expect(field().value).toBe('@Grace Hopper ');
    expect(document.activeElement).toBe(field());
  });

  it('keeps the list closed while an IME composes', async () => {
    render(<Chat />);
    await userEvent.click(field());
    await userEvent.keyboard('@a');
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, isComposing: true });
    field().dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(field().value).toBe('@a');
  });

  it('passes axe while open', async () => {
    render(<Chat />);
    await userEvent.click(field());
    await userEvent.keyboard('@a');
    const results = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
