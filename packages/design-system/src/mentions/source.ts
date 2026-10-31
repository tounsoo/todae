import type { ReactNode } from 'react';
import { warnOnce } from '../components/warnOnce.js';
import type { MentionTrigger } from '../hooks/useMentions.js';

/** Which peek is open, and a way for the consumer's own content to close it. */
export type MentionPeekContext = {
  /** The token value the source resolves. */
  id: string;
  /** `caret` is the peek while the caret rests in a token. It never takes focus. */
  mode: 'interactive' | 'caret';
  /** Closes the peek. Focus returns to the mention, or stays on the textarea. */
  close: () => void;
};

/**
 * A mention trigger plus how to look up and show the thing it names.
 * `useMentions` already accepts one, because this is a `MentionTrigger` with
 * extra fields.
 */
export type MentionSource<T = unknown> = MentionTrigger & {
  /** Look up the entity for a token's value. Sync or async. */
  resolve?(id: string, signal: AbortSignal): T | Promise<T | undefined> | undefined;
  /**
   * Peek contents, entirely consumer-owned. The result is the Popover's only
   * child. Omit for no peek. The same function fills the rendered peek and
   * the caret peek.
   */
  renderPeek?(entity: T, peek: MentionPeekContext): ReactNode;
  /** Accessible name of the peek dialog. Default: the mention's text. */
  peekLabel?(entity: T): string;
  /** Href when the rendered mention is a link. Otherwise it is a button. */
  href?(id: string, entity: T | undefined): string | undefined;
};

/** Returns `source`. In development, warns when `char` is not one character. */
export function defineMentionSource<T>(source: MentionSource<T>): MentionSource<T> {
  if (process.env.NODE_ENV !== 'production' && [...source.char].length !== 1) {
    warnOnce(
      `mention-char:${source.char}`,
      `defineMentionSource: char must be one character, received ${JSON.stringify(source.char)}.`,
    );
  }
  return source;
}
