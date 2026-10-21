import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** What a submit finds in the input: text no number (`flag` marks it; the form's own check blocks the submit, and where a submitter turns that check off, the submit is cancelled here), or a draft the submit commits. */
export type SubmitDraft = { unreadable: true; flag: () => void } | { unreadable?: false; commit: () => void };

type Held = { form: HTMLFormElement; submitter: HTMLElement | null };

// The submit again, from the same submitter while it still belongs to the form.
function send({ form, submitter }: Held) {
  form.requestSubmit(submitter?.isConnected && (submitter as HTMLButtonElement).form === form ? submitter : undefined);
}

// The attribute the input carries its commit count in, so the page itself says which commit it shows.
const COUNT = 'data-todae-commits';

// Watches a submit held for an input whose effects are off, from the page and not from the input's own effects: the input leaving the page, or the page showing its commit (`waiting` ends), ends the hold with the send, and a submit of the same form ends it without one (that one goes out, so this would be its twin). Returns its stop.
function watchHidden(node: HTMLElement, { form }: Held, waiting: () => boolean, end: (sendIt: boolean) => void): () => void {
  const root = node.getRootNode();
  const onSubmit = (event: Event) => {
    if (event.target !== form) return;
    stop();
    end(false);
  };
  const observer = new MutationObserver(() => {
    if (node.isConnected && waiting()) return;
    stop();
    end(true);
  });
  function stop() {
    root.removeEventListener('submit', onSubmit, true);
    observer.disconnect();
  }
  root.addEventListener('submit', onSubmit, true);
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: [COUNT] });
  return stop;
}

/**
 * Makes a submit of an input's form wait for the input's commit, so the form
 * reads what the product rendered, and returns `committed`, which the input
 * calls from every commit that may change its value, `waiting`, whether a
 * commit has not yet been shown by a render, and `mark`, the props the input
 * renders so the page says which commit it shows.
 *
 * A submit is not forced into a commit with `flushSync`: that split the
 * product's state from the payload when the submit began in a commit phase,
 * and re-read stale closures. Instead:
 *
 * - `committed()` counts the commit (`asked`) and renders that count, so a
 *   render always follows, even when the product refuses the number and
 *   changes nothing. The input is waiting while the count in the page (`mark`)
 *   is behind `asked`, and the layout effect of the render that brings it
 *   level sends a held submit. The page is the one place that knows what
 *   has been shown, whether or not the input's effects ran.
 * - Text that is no number is not a value, so no submit sends the old number
 *   in its place. The unreadable text makes the value input invalid, so a
 *   form that checks (the browser's check, or Form.Root's, which words it)
 *   blocks the submit and this only flags the text. A submit whose submitter
 *   has `formNoValidate` skips every check, so it is cancelled here, with
 *   `preventDefault` and `stopImmediatePropagation`, and flagged.
 * - A submit of the input's form that finds a draft that reads (`read`), or
 *   the input waiting (a product's auto-submit in `onValueChange`, a step with
 *   no draft), is cancelled and held: `preventDefault` and
 *   `stopImmediatePropagation`. The draft commits as blur does. The effect
 *   that brings the count level sends the held submit again, once, with the
 *   submitter, so a number the product refuses is never sent and the product
 *   is never told a number other than the one sent.
 * - When the input's effects are cleaned up (a Suspense boundary or an
 *   Activity hides it, or it is removed), a microtask later, when the commit
 *   is done, the held submit is settled by what the page shows. An input that
 *   is gone means the product moved on, and the form still goes, if it is
 *   still in the page. An input in the page with the count level shows the
 *   commit already, so it goes at once. Otherwise the render has not reached
 *   the page: a Suspense boundary keeps the old page until it shows the new
 *   render, and an Activity renders its hidden content a moment after. The
 *   submit stays held, and `watchHidden` sends it when the page shows the
 *   commit (an Activity) or the input is removed, and drops it if another
 *   submit of the form comes first, so it is never sent twice. The layout
 *   effect sends it when the input shows again with the committed render.
 * - The listeners sit in the capture phase on the input's root node, a
 *   document or a shadow root (`submit` is not composed, so a form in a shadow
 *   tree is heard there only), and test the target at event time, so a `form`
 *   attribute that names a form mounted later works. They run before React's
 *   handlers on the root, such as Form.Root's `onSubmit`.
 *
 * Limits: a form that validates natively checks before it fires `submit`, so a
 * submit with a stale invalid number is blocked before this hears it. And the
 * held submit goes out after the render that answers the commit, so the
 * product must set its value synchronously in `onValueChange`, not in a
 * transition or a store that updates later.
 */
export function useFormSubmitHold(
  input: RefObject<HTMLInputElement | null>,
  read: () => SubmitDraft | null,
): { committed: () => void; waiting: () => boolean; mark: { [COUNT]: number } } {
  // `asked` counts the commits at once, and `count` is that number as state, which the input renders for the page to show.
  const [count, setCount] = useState(0);
  const asked = useRef(0);
  const held = useRef<Held | null>(null);
  const unwatch = useRef<(() => void) | null>(null);
  const latest = useRef(read);
  // A hidden input's ref is cleared, so the element the effect saw is asked, not `input.current`.
  const behind = useCallback((node: HTMLElement | null) => asked.current !== Number(node?.getAttribute(COUNT) ?? 0), []);
  const waiting = useCallback(() => behind(input.current), [behind, input]);

  // Ends the hold, sending the submit or not.
  const release = useCallback((sendIt: boolean) => {
    const sent = held.current;
    held.current = null;
    unwatch.current?.();
    unwatch.current = null;
    if (sendIt && sent?.form.isConnected) send(sent);
  }, []);

  useLayoutEffect(() => {
    latest.current = read;
    // Not the render of a commit that has not come: one started inside another's effect is shown by the next render.
    if (!waiting()) release(true);
  });

  useLayoutEffect(() => {
    const node = input.current;
    if (!node) return;
    const root = node.getRootNode();
    const onSubmit = (event: Event) => {
      if (event.target !== node.form) return;
      const draft = latest.current();
      const submitter = (event as SubmitEvent).submitter;
      if (draft?.unreadable) {
        draft.flag();
        // The form's own check blocks it, unless the submitter turns the check off.
        if ((submitter as HTMLButtonElement | null)?.formNoValidate) {
          event.preventDefault();
          event.stopImmediatePropagation();
        }
        return;
      }
      if (!draft && !waiting()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      held.current = { form: event.target as HTMLFormElement, submitter };
      draft?.commit();
    };
    root.addEventListener('submit', onSubmit, true);
    return () => {
      root.removeEventListener('submit', onSubmit, true);
      if (!held.current) return;
      queueMicrotask(() => {
        const sent = held.current;
        if (!sent) return;
        if (!node.isConnected || !behind(node)) release(true);
        else unwatch.current = watchHidden(node, sent, () => behind(node), release);
      });
    };
  }, [input, waiting, behind, release]);

  return {
    committed: () => {
      asked.current += 1;
      setCount(asked.current);
    },
    waiting,
    mark: { [COUNT]: count },
  };
}
