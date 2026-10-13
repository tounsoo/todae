import { useCallback, useEffect, useRef, useState } from 'react';
import { useStrings } from '../providers/StringsProvider';
import { useAnnouncer } from './useAnnouncer';

export type ClipboardStatus = 'idle' | 'copied' | 'failed';

export type UseClipboardOptions = {
  /** Milliseconds before `status` returns to `idle`. Default 2000. `false` keeps it until the next copy or `reset()`. */
  resetAfter?: number | false;
  /** Read to screen readers after a copy. Default is the `copied` string. An empty string reads nothing. */
  copiedMessage?: string;
  /** Read to screen readers, assertively, when a copy fails. Default is the `copyFailed` string. An empty string reads nothing. */
  failedMessage?: string;
};

export type UseClipboardResult = {
  /** Writes text to the clipboard. Resolves to true when it was copied. */
  copy: (text: string) => Promise<boolean>;
  /** The outcome of the latest copy once it settles, until `resetAfter` passes. */
  status: ClipboardStatus;
  /** The text `status` is about, or null while `status` is `idle`. */
  text: string | null;
  /** Sets `status` back to `idle` and `text` to null. */
  reset: () => void;
};

// `after` is resetAfter as it was when the copy settled.
type State = { status: ClipboardStatus; text: string | null; settled: number; after: number | false };

const DEFAULT_RESET_AFTER = 2000;
// setTimeout runs a longer delay at once, so a resetAfter past it never resets.
const MAX_DELAY = 2 ** 31 - 1;

/**
 * Copies text with `navigator.clipboard.writeText`, keeps the outcome as
 * `status`, and announces it. There is no `execCommand` fallback: where the
 * Clipboard API is missing or refused, such as on a page that isn't a secure
 * context, the copy fails.
 */
export function useClipboard(options: UseClipboardOptions = {}): UseClipboardResult {
  const { resetAfter = DEFAULT_RESET_AFTER, copiedMessage, failedMessage } = options;
  const strings = useStrings();
  const announce = useAnnouncer();
  const [state, setState] = useState<State>({ status: 'idle', text: null, settled: 0, after: false });
  // Each copy takes a number, so only the latest one sets status and is announced.
  const latest = useRef(0);
  // Read at settle time, so a copy uses the options of the latest render.
  const current = { resetAfter, copied: copiedMessage ?? strings.copied, failed: failedMessage ?? strings.copyFailed };
  const messages = useRef(current);
  messages.current = current;

  // The reset timer lives in an effect, so it starts again when effects are
  // re-run, as when an Activity is shown again.
  const { status, settled, after } = state;
  useEffect(() => {
    if (status === 'idle' || after === false || !(after <= MAX_DELAY)) return;
    const timer = setTimeout(() => {
      setState((prev) => (prev.settled === settled ? { ...prev, status: 'idle', text: null } : prev));
    }, Math.max(0, after));
    return () => clearTimeout(timer);
  }, [status, settled, after]);

  const reset = useCallback(() => {
    setState((prev) => (prev.status === 'idle' ? prev : { ...prev, status: 'idle', text: null }));
  }, []);

  const copy = useCallback(
    async (text: string) => {
      const id = ++latest.current;
      let ok: boolean;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        // Covers a missing navigator.clipboard too: reading writeText off undefined throws here.
        ok = false;
      }
      if (id !== latest.current) return ok;
      // Announced even when the component has unmounted since.
      const { resetAfter: after, copied, failed } = messages.current;
      if (ok) {
        if (copied) announce(copied);
      } else if (failed) {
        announce(failed, { politeness: 'assertive' });
      }
      setState((prev) => ({ status: ok ? 'copied' : 'failed', text, settled: prev.settled + 1, after }));
      return ok;
    },
    [announce],
  );

  return { copy, status, text: state.text, reset };
}
