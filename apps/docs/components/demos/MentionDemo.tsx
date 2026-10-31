'use client';

import { Composer, MentionText, defineMentionSource, type MentionDraft } from '@tounsoo/todae';
import { useState, type FormEvent } from 'react';

type Person = { name: string; role: string };

const people = defineMentionSource<Person>({
  char: '@',
  label: 'People',
  options: [
    { value: 'mina', label: 'Mina Park' },
    { value: 'minjun', label: 'Min-jun Choi' },
  ],
  resolve: (id) =>
    id === 'mina'
      ? { name: 'Mina Park', role: 'Design systems' }
      : id === 'minjun'
        ? { name: 'Min-jun Choi', role: 'Engineering' }
        : undefined,
  peekLabel: (person) => person.name,
  renderPeek: (person, peek) => (
    <span>
      {person.name}
      <span> {person.role}</span>
      {peek.mode === 'interactive' ? (
        <button type="button" onClick={peek.close}>
          Close
        </button>
      ) : null}
    </span>
  ),
});

const EMPTY: MentionDraft = { text: '', tokens: [] };

export function MentionExample() {
  const [draft, setDraft] = useState<MentionDraft>(EMPTY);
  const [sent, setSent] = useState<MentionDraft[]>([]);
  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent((all) => [...all, draft]);
    setDraft(EMPTY);
  };
  return (
    <div style={{ inlineSize: '100%', maxInlineSize: '36rem' }}>
      {sent.map((message, index) => (
        <p key={index}>
          <MentionText value={message} sources={[people]} />
        </p>
      ))}
      <Composer.Root onSubmit={send}>
        <Composer.Input aria-label="Message" mentions={[people]} value={draft} onValueChange={setDraft} placeholder="Type @" />
        <Composer.Toolbar>
          <Composer.Submit disabled={draft.text.trim() === ''} />
        </Composer.Toolbar>
      </Composer.Root>
    </div>
  );
}
