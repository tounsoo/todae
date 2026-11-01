'use client';

import {
  Attachment,
  Button,
  Field,
  Mention,
  MentionText,
  Popover,
  defineMentionSource,
  useMentions,
  usePopover,
  type MentionDraft,
  type MentionSource,
  type MentionToken,
} from '@tounsoo/todae';
import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import styles from './chat-composer.module.css';

type Person = { name: string; role: string; place: string };

const FACES: Record<string, { initials: string; tone: string }> = {
  mina: { initials: 'MP', tone: '5' },
  minjun: { initials: 'MC', tone: '2' },
  mira: { initials: 'MS', tone: '7' },
};

export const people = defineMentionSource<Person>({
  char: '@',
  label: 'People',
  options: [
    { value: 'mina', label: 'Mina Park' },
    { value: 'minjun', label: 'Min-jun Choi' },
    { value: 'mira', label: 'Mira Seo' },
  ],
  resolve: (id) =>
    id === 'mina'
      ? { name: 'Mina Park', role: 'Design systems', place: 'Seoul' }
      : id === 'minjun'
        ? { name: 'Min-jun Choi', role: 'Engineering', place: 'Seoul' }
        : id === 'mira'
          ? { name: 'Mira Seo', role: 'Design', place: 'Seoul' }
          : undefined,
  peekLabel: (person) => person.name,
  renderPeek: (person, peek) => (
    <div className={styles.peek}>
      <div className={styles.row}>
        <div className={`${styles.avatar} ${styles.avatarLarge}`}>MP</div>
        <div>
          <div className={styles.name}>{person.name}</div>
          <div className={styles.muted}>
            {peek.mode === 'caret' ? `${person.role} · Active now` : `${person.role} · ${person.place}`}
          </div>
        </div>
      </div>
      {peek.mode === 'interactive' ? (
        <>
          <div className={styles.muted}>Local time 3:02 PM KST · Active now</div>
          <div className={styles.actions}>
            <Button.Root type="button" variant="primary" className={styles.message}>
              Message
            </Button.Root>
            <button type="button" className={styles.view} onClick={peek.close}>
              View profile
            </button>
          </div>
        </>
      ) : null}
    </div>
  ),
});

function tokenAtCaret(tokens: readonly MentionToken[], caret: number): MentionToken | null {
  return tokens.find((token) => caret > token.start && caret <= token.end) ?? null;
}

const SHIP = 'Shipping the Acid fix. @Mina Park can you sanity check the dark track?';
const SHIP_AT = SHIP.indexOf('@Mina Park');

function onEnter(event: KeyboardEvent<HTMLFormElement>) {
  if (event.key !== 'Enter' || event.shiftKey || event.defaultPrevented) return;
  if (event.nativeEvent.isComposing || event.keyCode === 229) return;
  if (!(event.target instanceof HTMLTextAreaElement)) return;
  event.preventDefault();
  event.currentTarget.requestSubmit();
}

function MentionField({
  mentions,
  label,
  value,
  defaultValue,
  onValueChange,
  bare,
}: {
  mentions: readonly MentionSource<Person>[];
  label: string;
  value?: MentionDraft;
  defaultValue?: MentionDraft;
  onValueChange?: (next: MentionDraft) => void;
  bare?: boolean;
}) {
  const api = useMentions({ triggers: mentions, value, defaultValue, onValueChange });
  const [caret, setCaret] = useState<number | null>(null);
  const [focused, setFocused] = useState(false);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const [entity, setEntity] = useState<Person | undefined>(undefined);
  const token = !api.open && caret !== null ? tokenAtCaret(api.value.tokens, caret) : null;
  const source = token ? (mentions.find((item) => item.char === token.char) ?? null) : null;
  const tokenKey = token ? `${token.start}:${token.end}:${token.value}` : null;
  if (dismissedKey !== null && dismissedKey !== tokenKey) setDismissedKey(null);
  const dismissed = tokenKey !== null && dismissedKey === tokenKey;
  const peek = usePopover({
    open: focused && token !== null && entity !== undefined && !dismissed,
    onOpenChange: (next) => {
      if (!next && tokenKey) setDismissedKey(tokenKey);
    },
  });
  useEffect(() => {
    const node = api.textareaRef.current;
    if (!node) return;
    const sync = () => {
      if (node.selectionStart === node.selectionEnd) setCaret(node.selectionStart);
    };
    sync();
    node.addEventListener('selectionchange', sync);
    node.addEventListener('keyup', sync);
    node.addEventListener('click', sync);
    return () => {
      node.removeEventListener('selectionchange', sync);
      node.removeEventListener('keyup', sync);
      node.removeEventListener('click', sync);
    };
  });
  useEffect(() => {
    if (!source || !token) {
      setEntity(undefined);
      return;
    }
    const result = source.resolve?.(token.value, new AbortController().signal);
    if (result instanceof Promise) {
      let live = true;
      void result.then((person) => {
        if (live) setEntity(person);
      });
      return () => {
        live = false;
      };
    }
    setEntity(result);
  }, [source, token]);
  const wire = peek.getPopoverProps();
  return (
    <>
      <Field.Root aria-label={label} className={bare ? styles.bare : undefined}>
        <Field.Textarea
          {...api.getTextareaProps({
            rows: 1,
            spellCheck: false,
            className: bare ? `${styles.area} ${styles.input}` : styles.area,
            onPointerDown: () => {
              setDismissedKey(null);
            },
            onFocus: () => {
              setFocused(true);
            },
            onBlur: () => {
              setFocused(false);
              if (tokenKey) setDismissedKey(tokenKey);
            },
          })}
        />
      </Field.Root>
      <Popover.Root {...api.getPopoverProps()}>
        <div
          id={api.ids.listbox}
          role="listbox"
          aria-label={api.trigger?.label ?? 'Suggestions'}
          tabIndex={-1}
          className={styles.list}
        >
          {api.open && api.trigger?.label ? <div className={styles.lbl}>{api.trigger.label}</div> : null}
          {api.open
            ? api.items.map((item) => {
                const face = FACES[item.option.value];
                const on = item.option.value === api.activeValue;
                return (
                  <div
                    key={item.id}
                    id={item.id}
                    role="option"
                    aria-selected={on}
                    className={on ? `${styles.opt} ${styles.on}` : styles.opt}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => api.highlight(item.option.value)}
                    onClick={() => api.select(item.option.value)}
                  >
                    <span
                      className={styles.face}
                      style={
                        face
                          ? {
                              background: `var(--todae-avatar-category-${face.tone}-bg)`,
                              color: `var(--todae-avatar-category-${face.tone}-fg)`,
                            }
                          : undefined
                      }
                    >
                      {face?.initials ?? item.option.label.slice(0, 1)}
                    </span>
                    <span>{item.option.label}</span>
                    <span className={styles.handle}>@{item.option.value}</span>
                  </div>
                );
              })
            : null}
        </div>
      </Popover.Root>
      {source?.renderPeek && token ? (
        <Popover.Root
          {...wire}
          inert
          style={{
            ...wire.style,
            ['--todae-popover-anchor' as string]: api.caretPeekAnchorName ?? undefined,
            positionAnchor: api.caretPeekAnchorName ?? undefined,
          }}
        >
          {entity !== undefined ? source.renderPeek(entity, { id: token.value, mode: 'caret', close: () => setCaret(null) }) : null}
        </Popover.Root>
      ) : null}
    </>
  );
}

export function ChatComposerCard() {
  const [draft, setDraft] = useState<MentionDraft>({
    text: SHIP,
    tokens: [{ char: '@', value: 'mina', text: '@Mina Park', start: SHIP_AT, end: SHIP_AT + '@Mina Park'.length }],
  });
  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setDraft({ text: '', tokens: [] });
  };
  return (
    <form className={styles.card} onSubmit={send} onKeyDown={onEnter}>
      <div className={styles.attachments}>
        <Attachment.Root>
          <Attachment.Preview className={styles.badge}>PNG</Attachment.Preview>
          <Attachment.Name>peek-card.png</Attachment.Name>
          <Attachment.Meta>248 KB</Attachment.Meta>
          <Attachment.Remove className={styles.dismiss}>✕</Attachment.Remove>
        </Attachment.Root>
        <Attachment.Root>
          <Attachment.Preview className={styles.badge}>PDF</Attachment.Preview>
          <Attachment.Name>m8-contrast.pdf</Attachment.Name>
          <Attachment.Meta>1.2 MB</Attachment.Meta>
          <Attachment.Remove className={styles.dismiss}>✕</Attachment.Remove>
        </Attachment.Root>
      </div>
      <MentionField mentions={[people]} label="Message" value={draft} onValueChange={setDraft} bare />
      <div className={styles.toolbar}>
        <button className={styles.icon} type="button">
          ＋
        </button>
        <button className={styles.icon} type="button">
          @
        </button>
        <button className={styles.icon} type="button">
          /
        </button>
        <span className={styles.spacer} />
        <span className={styles.hint}>Enter to send</span>
        <Button.Root className={styles.send} type="submit" variant="primary" aria-label="Send">
          ↑
        </Button.Root>
      </div>
    </form>
  );
}

function MessageLine({ shot, text }: { shot?: string; text: string }) {
  return (
    <div className={styles.msg}>
      <div className={styles.avatar}>JK</div>
      <div>
        <div className={styles.header}>
          <b>Jun Kim</b> · 3:02 PM
        </div>
        <div className={styles.body}>
          Can <Mention.Root id="mina" source={people} data-shot={shot}>{text}</Mention.Root> review the token diff before Friday?
        </div>
      </div>
    </div>
  );
}

export function SentFrames() {
  return (
    <div className={styles.frame} id="sent">
      <div>
        <p className={styles.cap}>Rest</p>
        <MessageLine text="@Mina Park" />
      </div>
      <div>
        <p className={styles.cap}>Hover</p>
        <MessageLine shot="hover-mention" text="@Mina Park" />
      </div>
      <div>
        <p className={styles.cap}>Keyboard focus</p>
        <MessageLine shot="focus-mention" text="@Mina Park" />
      </div>
    </div>
  );
}

export function PeekFrame() {
  return (
    <div className={styles.frame} id="peek" style={{ minHeight: 320 }}>
      <MessageLine shot="peek-mention" text="@Mina Park" />
    </div>
  );
}

export function ComposingFrames() {
  const [query, setQuery] = useState<MentionDraft>({ text: 'Thanks @mi', tokens: [] });
  const text = 'Thanks @Mina Park for the review';
  const start = text.indexOf('@Mina Park');
  const [inside, setInside] = useState<MentionDraft>({
    text,
    tokens: [{ char: '@', value: 'mina', text: '@Mina Park', start, end: start + '@Mina Park'.length }],
  });
  return (
    <div className={styles.frame} id="composing" style={{ minHeight: 560 }}>
      <div id="q">
        <MentionField mentions={[people]} label="Composing query" value={query} onValueChange={setQuery} />
      </div>
      <div style={{ height: 200 }} />
      <div id="c">
        <MentionField mentions={[people]} label="Caret peek" value={inside} onValueChange={setInside} />
      </div>
    </div>
  );
}

export function ComposerFrame() {
  return (
    <div className={styles.frame} id="composer">
      <ChatComposerCard />
    </div>
  );
}

const refPeople = defineMentionSource<Person>({
  ...people,
  renderPeek: (person) => (
    <div className={styles.peek}>
      <div className={styles.row}>
        <div className={`${styles.avatar} ${styles.avatarLarge}`}>MP</div>
        <div>
          <div className={styles.name}>{person.name}</div>
          <div className={styles.muted}>{person.role}</div>
        </div>
      </div>
    </div>
  ),
});

export function RefFrame() {
  const [open, setOpen] = useState(false);
  const popover = usePopover({ open, onOpenChange: setOpen });
  return (
    <div className={styles.frame} id="ref">
      <div className={styles.ref}>
        <button type="button" {...popover.getTriggerProps()}>
          Open popover
        </button>
        <div className={styles.msg}>
          <div className={styles.avatar}>JK</div>
          <div>
            <div className={styles.header}>
              <b>Jun Kim</b> · 3:02 PM
            </div>
            <div className={styles.body}>
              <Mention.Root id="mina" source={refPeople} data-shot="ref-mention">
                @Mina Park
              </Mention.Root>
            </div>
          </div>
        </div>
      </div>
      <Popover.Root {...popover.getPopoverProps()}>Popover content</Popover.Root>
    </div>
  );
}

export function SentMessage({ value }: { value: MentionDraft }) {
  return <MentionText value={value} sources={[people]} />;
}
