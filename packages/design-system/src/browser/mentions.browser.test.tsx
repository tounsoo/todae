import { act, cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@vitest/browser/context';
import { useState, type FormEvent } from 'react';
import axe from 'axe-core';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field, OptionList, Popover, useMentions, type MentionDraft, type MentionToken, type MentionTrigger } from '../index.js';

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
const EMPTY: MentionDraft = { text: '', tokens: [] };
const TRIGGERS: MentionTrigger[] = [
  { char: '@', options: people, label: 'People' },
  { char: '/', position: 'start', options: commands, label: 'Commands' },
];

function Chat({
  onSend = () => {},
  onChange = () => {},
  dir,
}: {
  onSend?: (text: string, tokens: readonly MentionToken[]) => void;
  onChange?: (draft: MentionDraft) => void;
  dir?: 'rtl';
}) {
  const [draft, setDraft] = useState<MentionDraft>(EMPTY);
  const mentions = useMentions({
    triggers: TRIGGERS,
    value: draft,
    onValueChange: (next) => {
      onChange(next);
      setDraft(next);
    },
  });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSend(draft.text, draft.tokens);
    setDraft(EMPTY);
  };
  return (
    <main data-appearance="light" data-density="comfortable" style={{ inlineSize: '24rem' }} dir={dir}>
      <form
        onSubmit={submit}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' || event.shiftKey || event.defaultPrevented) return;
          if (!(event.target instanceof HTMLTextAreaElement)) return;
          event.preventDefault();
          event.currentTarget.requestSubmit();
        }}
      >
        <Field.Root aria-label="Message">
          <Field.Textarea {...mentions.getTextareaProps()} autoGrow maxRows={4} />
        </Field.Root>
        <button type="submit" disabled={draft.text.trim() === ''}>
          Send
        </button>
      </form>
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
    const onChange = vi.fn();
    render(<Chat onChange={onChange} />);
    await userEvent.click(field());
    await userEvent.keyboard('@ad{Enter}');
    expect(field().value).toBe('@Ada Lovelace ');
    await userEvent.keyboard('{Control>}z{/Control}');
    expect(field().value).toBe('@ad');
    expect(onChange).toHaveBeenLastCalledWith({ text: '@ad', tokens: [] });
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(field().value).toBe('@Ada Lovelace ');
    expect(onChange).toHaveBeenLastCalledWith({
      text: '@Ada Lovelace ',
      tokens: [{ start: 0, end: 13, char: '@', value: 'ada', text: '@Ada Lovelace' }],
    });
  });

  it('turns a token back into plain text when Backspace or Delete removes one of its characters', async () => {
    const onChange = vi.fn();
    render(<Chat onChange={onChange} />);
    await userEvent.click(field());
    await userEvent.keyboard('Hi @ad{Enter}{Backspace}{Backspace}');
    expect(field().value).toBe('Hi @Ada Lovelac');
    expect(onChange).toHaveBeenLastCalledWith({ text: 'Hi @Ada Lovelac', tokens: [] });
    expect(document.querySelector('[data-kind="@"]')).toBeNull();
    await userEvent.clear(field());
    await userEvent.keyboard('Hi @ad{Enter}');
    await act(async () => field().setSelectionRange(3, 3));
    await userEvent.keyboard('{Delete}');
    expect(field().value).toBe('Hi Ada Lovelace ');
    expect(onChange).toHaveBeenLastCalledWith({ text: 'Hi Ada Lovelace ', tokens: [] });
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

  it('puts the caret after a pick when the product commits the draft later', async () => {
    function Late() {
      const [draft, setDraft] = useState<MentionDraft>({ text: 'hi @al there', tokens: [] });
      const mentions = useMentions({ triggers: TRIGGERS, value: draft, onValueChange: (next) => setTimeout(() => setDraft(next), 10) });
      return (
        <main data-appearance="light" data-density="comfortable" style={{ inlineSize: '24rem' }}>
          <Field.Root aria-label="Message">
            <Field.Textarea {...mentions.getTextareaProps()} />
          </Field.Root>
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
    render(<Late />);
    await userEvent.click(field());
    await act(async () => {
      field().setSelectionRange(6, 6);
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await act(() => new Promise((resolve) => setTimeout(resolve, 40)));
    expect(field().value).toBe('hi @Alan Turing there');
    expect(field().selectionStart).toBe(15);
  });

  describe('with a product that commits the draft later', () => {
    function Late({ loads, opened, expose }: { loads: string[]; opened: string[]; expose: (result: ReturnType<typeof useMentions>) => void }) {
      const [draft, setDraft] = useState<MentionDraft>({ text: '@al @gracehopperxx @zz', tokens: [] });
      const mentions = useMentions({
        triggers: [{ char: '@', loadOptions: (query) => (loads.push(query), Promise.resolve(people)) }],
        value: draft,
        onValueChange: (next) => setTimeout(() => setDraft(next), 30),
      });
      expose(mentions);
      if (mentions.open) opened.push(mentions.query);
      return (
        <main data-appearance="light" data-density="comfortable" style={{ inlineSize: '24rem' }}>
          <Field.Root aria-label="Message">
            <Field.Textarea {...mentions.getTextareaProps()} />
          </Field.Root>
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
    async function setup() {
      const loads: string[] = [];
      const opened: string[] = [];
      let result!: ReturnType<typeof useMentions>;
      render(<Late loads={loads} opened={opened} expose={(r) => (result = r)} />);
      await userEvent.click(field());
      await act(async () => {
        field().setSelectionRange(3, 3);
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      loads.length = 0;
      opened.length = 0;
      return { loads, opened, result: () => result };
    }

    it('opens no list for another word while a pick waits for its text', async () => {
      const { loads, opened } = await setup();
      await userEvent.keyboard('{Enter}');
      await act(() => new Promise((resolve) => setTimeout(resolve, 80)));
      expect(field().value).toBe('@Ada Lovelace @gracehopperxx @zz');
      expect(field().selectionStart).toBe(13);
      expect(loads).toEqual([]);
      expect(opened).toEqual([]);
    });

    it('opens no list for another word while a pick made outside a React event waits', async () => {
      const { loads, opened, result } = await setup();
      await act(async () => {
        setTimeout(() => result().select('ada'), 0);
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(field().value).toBe('@Ada Lovelace @gracehopperxx @zz');
      expect(loads).toEqual([]);
      expect(opened).toEqual([]);
    });
  });

  it('picks with a click and keeps focus in the textarea', async () => {
    render(<Chat />);
    await userEvent.click(field());
    await userEvent.keyboard('@gr');
    await userEvent.click(screen.getByRole('option', { name: 'Grace Hopper' }));
    expect(field().value).toBe('@Grace Hopper ');
    expect(document.activeElement).toBe(field());
  });

  it('follows the direction dir="auto" resolves from the text', async () => {
    function Auto() {
      const mentions = useMentions({ triggers: TRIGGERS });
      return (
        <main data-appearance="light" data-density="comfortable" style={{ inlineSize: '24rem' }}>
          <Field.Root aria-label="Message">
            <Field.Textarea {...mentions.getTextareaProps()} dir="auto" rows={2} />
          </Field.Root>
        </main>
      );
    }
    render(<Auto />);
    await userEvent.click(field());
    await userEvent.keyboard('שלום @a{Enter}');
    const layer = document.querySelector('[data-kind="@"]')!.parentElement!;
    expect(getComputedStyle(field()).direction).toBe('rtl');
    expect(getComputedStyle(layer).direction).toBe('rtl');
  });

  it("copies the textarea's own lang to the layer, and keeps page translation off it", async () => {
    function Lang() {
      const mentions = useMentions({
        triggers: TRIGGERS,
        defaultValue: { text: '@Ada', tokens: [{ start: 0, end: 4, char: '@', value: 'ada', text: '@Ada' }] },
      });
      return (
        <main data-appearance="light" data-density="comfortable">
          <Field.Root aria-label="Message">
            <Field.Textarea {...mentions.getTextareaProps()} lang="ja" />
          </Field.Root>
        </main>
      );
    }
    render(<Lang />);
    const layer = document.querySelector('[data-kind="@"]')!.parentElement!;
    expect(layer.getAttribute('lang')).toBe('ja');
    expect(layer.getAttribute('translate')).toBe('no');
  });

  it('passes axe while open', async () => {
    render(<Chat />);
    await userEvent.click(field());
    await userEvent.keyboard('@a');
    const results = await axe.run(document.body, { rules: { 'color-contrast': { enabled: false } } });
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
