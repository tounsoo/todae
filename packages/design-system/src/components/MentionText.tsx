import type { ReactNode } from 'react';
import type { MentionDraft, MentionToken } from '../hooks/useMentions.js';
import type { MentionSource } from '../mentions/source.js';
import { Mention } from './Mention.js';

export type MentionTextProps = {
  value: MentionDraft;
  sources: readonly MentionSource[];
  className?: string;
};

function inRange(text: string, token: MentionToken, at: number): boolean {
  return token.start >= at && token.end <= text.length && token.end > token.start;
}

/** Splits a draft into text and Mention.Root for each token whose character has a source. */
export function MentionText({ value, sources, className }: MentionTextProps) {
  const tokens = [...value.tokens].sort((a, b) => a.start - b.start || a.end - b.end);
  const parts: ReactNode[] = [];
  let at = 0;
  for (const token of tokens) {
    if (!inRange(value.text, token, at)) continue;
    if (token.start > at) parts.push(value.text.slice(at, token.start));
    const source = sources.find((item) => item.char === token.char);
    const slice = value.text.slice(token.start, token.end);
    if (source) {
      parts.push(
        <Mention.Root key={`${token.start}:${token.end}:${token.value}`} source={source} id={token.value}>
          {slice}
        </Mention.Root>,
      );
    } else {
      parts.push(slice);
    }
    at = token.end;
  }
  if (at < value.text.length) parts.push(value.text.slice(at));
  return <span className={className}>{parts}</span>;
}
