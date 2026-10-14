import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { StrictMode, startTransition, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Field } from '../components/Field';
import { validTokens } from './useMentions.detect';
import { useMentions, type MentionToken, type UseMentionsResult } from './useMentions';

afterEach(cleanup);
const people = [
  { value: 'ada', label: 'Ada Lovelace' },
  { value: 'alan', label: 'Alan Turing' },
];
const short = [{ value: 'ada', label: 'Ada' }];
const ada = { start: 0, end: 4, char: '@', value: 'ada', text: '@Ada' };
const tick = (ms = 20) => act(() => new Promise((r) => setTimeout(r, ms)));
const el = () => screen.getByRole('textbox') as HTMLTextAreaElement;

type Commit = 'sync' | 'timeout' | 'transition';
function Mirror({
  initial = '',
  initialTokens = [],
  accept = () => true,
  commit = 'sync',
  tokensCommit = 'sync',
  onTokens,
  expose,
  options = people,
  loadOptions,
}: {
  initial?: string;
  initialTokens?: MentionToken[];
  accept?: (v: string) => boolean;
  commit?: Commit;
  tokensCommit?: Commit;
  onTokens?: (t: MentionToken[]) => void;
  expose?: (r: UseMentionsResult, state: { value: string; tokens: MentionToken[] }) => void;
  options?: { value: string; label: string }[];
  loadOptions?: (q: string) => Promise<{ value: string; label: string }[]>;
}) {
  const [value, setValue] = useState(initial);
  const [tokens, setTokens] = useState<MentionToken[]>(initialTokens);
  const run = (how: Commit, f: () => void) => (how === 'sync' ? f() : how === 'timeout' ? setTimeout(f, 10) : startTransition(f));
  const mentions = useMentions({
    triggers: [loadOptions ? { char: '@', loadOptions } : { char: '@', options }],
    value,
    onValueChange: (v) => accept(v) && run(commit, () => setValue(v)),
    tokens,
    onTokensChange: (t) => {
      onTokens?.(t);
      run(tokensCommit, () => setTokens(t));
    },
  });
  expose?.(mentions, { value, tokens });
  return (
    <Field.Root aria-label="Message">
      <Field.Textarea {...mentions.getTextareaProps()} />
    </Field.Root>
  );
}

describe('useMentions with tokens the product holds', () => {
  it('a mirroring parent that rejects an edit keeps its token, and is not called', () => {
    let r!: UseMentionsResult;
    let st!: { value: string; tokens: MentionToken[] };
    const onTokens = vi.fn();
    render(<Mirror initial="@Ada hi" initialTokens={[ada]} accept={(v) => v.length <= 7} onTokens={onTokens} expose={(x, s) => ((r = x), (st = s))} />);
    fireEvent.change(el(), { target: { value: 'Z@Ada hi', selectionStart: 1, selectionEnd: 1 } });
    expect(onTokens).not.toHaveBeenCalled();
    expect(st.tokens).toEqual([ada]);
    expect(r.tokens).toEqual([ada]);
    expect(el().value).toBe('@Ada hi');
    fireEvent.change(el(), { target: { value: '@Ada h', selectionStart: 6, selectionEnd: 6 } });
    expect(st.tokens).toEqual([ada]);
  });

  for (const commit of ['timeout', 'transition'] as const) {
    it(`value committed later (${commit}) keeps a typed shift`, async () => {
      let st!: { value: string; tokens: MentionToken[] };
      render(<Mirror initial="@Ada hi" initialTokens={[ada]} commit={commit} expose={(_x, s) => (st = s)} />);
      fireEvent.change(el(), { target: { value: 'Z@Ada hi', selectionStart: 1, selectionEnd: 1 } });
      await tick();
      expect(st.value).toBe('Z@Ada hi');
      expect(st.tokens).toEqual([{ ...ada, start: 1, end: 5 }]);
    });
    it(`value committed later (${commit}) keeps a fallback pick`, async () => {
      let r!: UseMentionsResult;
      let st!: { value: string; tokens: MentionToken[] };
      render(<Mirror commit={commit} expose={(x, s) => ((r = x), (st = s))} />);
      el().focus();
      fireEvent.change(el(), { target: { value: '@a', selectionStart: 2, selectionEnd: 2 } });
      await tick();
      act(() => r.select('ada'));
      await tick();
      expect(st.value).toBe('@Ada Lovelace ');
      expect(st.tokens).toEqual([{ start: 0, end: 13, char: '@', value: 'ada', text: '@Ada Lovelace' }]);
    });
    it(`tokens committed later (${commit}) still land`, async () => {
      let st!: { value: string; tokens: MentionToken[] };
      render(<Mirror initial="@Ada hi" initialTokens={[ada]} tokensCommit={commit} expose={(_x, s) => (st = s)} />);
      fireEvent.change(el(), { target: { value: 'Z@Ada hi', selectionStart: 1, selectionEnd: 1 } });
      await tick();
      expect(st.tokens).toEqual([{ ...ada, start: 1, end: 5 }]);
    });
    it(`tokens committed later (${commit}) survive a second edit before they arrive`, async () => {
      let st!: { value: string; tokens: MentionToken[] };
      render(<Mirror initial="@Ada hi" initialTokens={[ada]} tokensCommit={commit} expose={(_x, s) => (st = s)} />);
      fireEvent.change(el(), { target: { value: 'Z@Ada hi', selectionStart: 1, selectionEnd: 1 } });
      fireEvent.change(el(), { target: { value: 'ZZ@Ada hi', selectionStart: 2, selectionEnd: 2 } });
      await tick();
      expect(st.value).toBe('ZZ@Ada hi');
      expect(st.tokens).toEqual([{ ...ada, start: 2, end: 6 }]);
    });
  }

  it('Escape before a deferred commit stays dismissed', async () => {
    let r!: UseMentionsResult;
    render(<Mirror initial="@abc" commit="timeout" expose={(x) => (r = x)} />);
    el().focus();
    el().setSelectionRange(4, 4);
    fireEvent.select(el());
    fireEvent.change(el(), { target: { value: '@ab', selectionStart: 3, selectionEnd: 3 } });
    expect(r.open).toBe(true);
    fireEvent.keyDown(el(), { key: 'Escape' });
    await tick();
    expect(r.value).toBe('@ab');
    expect(r.open).toBe(false);
  });

  it('shows each text with its own tokens, and the parent holds them once each edit settles (StrictMode, one call per change)', () => {
    let r!: UseMentionsResult;
    let st!: { value: string; tokens: MentionToken[] };
    const onTokens = vi.fn();
    render(
      <StrictMode>
        <Mirror
          onTokens={onTokens}
          expose={(x, s) => {
            r = x;
            st = s;
            expect(validTokens(x.value, x.tokens)).toEqual(x.tokens);
            if (x.value.includes('@Ada Lovelace ')) expect(x.tokens).toHaveLength(1);
          }}
        />
      </StrictMode>,
    );
    el().focus();
    fireEvent.change(el(), { target: { value: '@a', selectionStart: 2, selectionEnd: 2 } });
    act(() => r.select('ada'));
    expect(onTokens).toHaveBeenCalledTimes(1);
    expect(validTokens(st.value, st.tokens)).toEqual(st.tokens);
    fireEvent.change(el(), { target: { value: 'Hi @Ada Lovelace ', selectionStart: 3, selectionEnd: 3 } });
    expect(onTokens).toHaveBeenCalledTimes(2);
    expect(st.tokens).toEqual([{ start: 3, end: 16, char: '@', value: 'ada', text: '@Ada Lovelace' }]);
  });

  it('a controlled pick of a one-word option before whitespace does not reopen the list or reload', async () => {
    const load = vi.fn(async () => short);
    let r!: UseMentionsResult;
    let st!: { value: string; tokens: MentionToken[] };
    render(<Mirror initial={'@Ad\nnext'} loadOptions={load} expose={(x, s) => ((r = x), (st = s))} />);
    el().focus();
    el().setSelectionRange(3, 3);
    fireEvent.select(el());
    await act(async () => {});
    expect(r.open).toBe(true);
    act(() => r.select('ada'));
    await act(async () => {});
    expect(st.tokens).toEqual([ada]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('a parent that changes only its tokens keeps them', () => {
    let st!: { value: string; tokens: MentionToken[] };
    let setT!: (t: MentionToken[]) => void;
    function P() {
      const [value, setValue] = useState('@Ada hi');
      const [tokens, setTokens] = useState<MentionToken[]>([ada]);
      setT = setTokens;
      st = { value, tokens };
      const m = useMentions({ triggers: [{ char: '@', options: people }], value, onValueChange: setValue, tokens, onTokensChange: setTokens });
      return (
        <Field.Root aria-label="Message">
          <Field.Textarea {...m.getTextareaProps()} />
        </Field.Root>
      );
    }
    render(<P />);
    act(() => setT([]));
    expect(st.tokens).toEqual([]);
    fireEvent.change(el(), { target: { value: '@Ada hi!', selectionStart: 8, selectionEnd: 8 } });
    expect(st.tokens).toEqual([]);
  });

  it('a parent that sets its own tokens in onValueChange keeps them', () => {
    let st!: { value: string; tokens: MentionToken[] };
    function P() {
      const [value, setValue] = useState('');
      const [tokens, setTokens] = useState<MentionToken[]>([]);
      st = { value, tokens };
      const m = useMentions({
        triggers: [{ char: '@', options: people }],
        value,
        onValueChange: (v) => (setValue(v), setTokens([])),
        tokens,
        onTokensChange: () => {},
      });
      return (
        <Field.Root aria-label="Message">
          <Field.Textarea {...m.getTextareaProps()} />
        </Field.Root>
      );
    }
    render(<P />);
    fireEvent.change(el(), { target: { value: 'hi', selectionStart: 2, selectionEnd: 2 } });
    expect(st.tokens).toEqual([]);
  });

  it('a pick that leaves the text as it is commits its token (controlled)', () => {
    let r!: UseMentionsResult;
    let st!: { value: string; tokens: MentionToken[] };
    render(<Mirror initial="@Ada hi" options={short} expose={(x, s) => ((r = x), (st = s))} />);
    el().focus();
    el().setSelectionRange(4, 4);
    fireEvent.select(el());
    act(() => r.select('ada'));
    expect(st.tokens).toEqual([ada]);
  });

  it('a pick that leaves the text as it is closes the list and hands out once while the tokens commit later', async () => {
    let r!: UseMentionsResult;
    const onTokens = vi.fn();
    render(<Mirror initial="@Ada hi" options={short} tokensCommit="timeout" onTokens={onTokens} expose={(x) => (r = x)} />);
    el().focus();
    el().setSelectionRange(4, 4);
    fireEvent.select(el());
    act(() => r.select('ada'));
    expect(r.open).toBe(false);
    fireEvent.keyDown(el(), { key: 'Enter' });
    await tick();
    expect(onTokens).toHaveBeenCalledTimes(1);
  });

  it('a pick that leaves the text as it is commits its token (uncontrolled)', () => {
    let r!: UseMentionsResult;
    const onTokens = vi.fn();
    function U() {
      r = useMentions({ triggers: [{ char: '@', options: short }], defaultValue: '@Ada hi', onTokensChange: onTokens });
      return (
        <Field.Root aria-label="Message">
          <Field.Textarea {...r.getTextareaProps()} />
        </Field.Root>
      );
    }
    render(<U />);
    el().focus();
    el().setSelectionRange(4, 4);
    fireEvent.select(el());
    act(() => r.select('ada'));
    expect(r.tokens).toEqual([ada]);
    expect(onTokens).toHaveBeenCalledTimes(1);
  });
});
