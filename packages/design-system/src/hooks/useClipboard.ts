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
  /** The latest copy's outcome, until `resetAfter` passes. `idle` while a copy is pending. */
  status: ClipboardStatus;
  /** Sets `status` back to `idle`. */
  reset: () => void;
};

const DEFAULT_RESET_AFTER = 2000;

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
  const [status, setStatus] = useState<ClipboardStatus>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Each copy takes a number, so only the latest one sets status.
  const latest = useRef(0);
  // Read at settle time, so a copy uses the options of the latest render.
  const current = { resetAfter, copied: copiedMessage ?? strings.copied, failed: failedMessage ?? strings.copyFailed };
  const settings = useRef(current);
  settings.current = current;

  useEffect(
    () => () => {
      clearTimeout(timer.current);
      // A copy that settles after unmount sets nothing.
      latest.current += 1;
    },
    [],
  );

  const reset = useCallback(() => {
    clearTimeout(timer.current);
    latest.current += 1;
    setStatus('idle');
  }, []);

  const copy = useCallback(
    async (text: string) => {
      const id = ++latest.current;
      clearTimeout(timer.current);
      // The last outcome no longer describes what is being copied.
      setStatus('idle');
      let ok: boolean;
      try {
        await navigator.clipboard.writeText(text);
        ok = true;
      } catch {
        // Covers a missing navigator.clipboard too: reading writeText off undefined throws here.
        ok = false;
      }
      if (id !== latest.current) return ok;
      const { resetAfter: after, copied, failed } = settings.current;
      setStatus(ok ? 'copied' : 'failed');
      if (ok) {
        if (copied) announce(copied);
      } else if (failed) {
        announce(failed, { politeness: 'assertive' });
      }
      if (after !== false && Number.isFinite(after)) {
        timer.current = setTimeout(() => {
          if (id === latest.current) setStatus('idle');
        }, Math.max(0, after));
      }
      return ok;
    },
    [announce],
  );

  return { copy, status, reset };
}
