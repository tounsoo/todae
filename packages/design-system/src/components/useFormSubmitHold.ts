import { useLayoutEffect, useReducer, useRef, type RefObject } from 'react';

/** What a submit finds in the input: text no number (`flag` marks it, and the form's own check blocks the submit), or a draft the submit commits. */
export type SubmitDraft = { unreadable: true; flag: () => void } | { unreadable?: false; commit: () => void };

type Held = { form: HTMLFormElement; submitter: HTMLElement | null };

// The submit again, from the same submitter while it still belongs to the form.
function send({ form, submitter }: Held) {
  form.requestSubmit(submitter?.isConnected && (submitter as HTMLButtonElement).form === form ? submitter : undefined);
}

/**
 * Makes a submit of an input's form wait for the input's commit, so the form
 * reads what the product rendered, and returns `committed`, which the input
 * calls from every commit that may change its value.
 *
 * A submit is not forced into a commit with `flushSync`: that split the
 * product's state from the payload when the submit began in a commit phase,
 * and re-read stale closures. Instead:
 *
 * - `committed()` marks the input as waiting and bumps a render tick, so a
 *   render always follows, even when the product refuses the number and
 *   changes nothing. The layout effect of the render that shows the last
 *   tick clears the waiting.
 * - A submit of the input's form that finds a draft that reads (`read`), or
 *   the input waiting (a product's auto-submit in `onValueChange`, a step with
 *   no draft), is cancelled and held: `preventDefault` and
 *   `stopImmediatePropagation`. The draft commits as blur does. The effect
 *   that clears the waiting sends the held submit again, once, with the
 *   submitter, so a number the product refuses is never sent and the product
 *   is never told a number other than the one sent.
 * - If the commit unmounts the input, the held submit goes out from the
 *   cleanup, in a microtask, while the form is still connected.
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
export function useFormSubmitHold(input: RefObject<HTMLInputElement | null>, read: () => SubmitDraft | null): () => void {
  // Every commit asks for one tick, and a render shows the ticks it has processed.
  const [tick, bump] = useReducer((count: number) => count + 1, 0);
  const asked = useRef(0);
  const shown = useRef(0);
  const held = useRef<Held | null>(null);
  const latest = useRef(read);
  const waiting = () => asked.current !== shown.current;

  useLayoutEffect(() => {
    latest.current = read;
    shown.current = tick;
    // Not the render of a tick that has not come: a commit started inside another's effect is shown by the next one.
    if (waiting()) return;
    const sent = held.current;
    held.current = null;
    if (!sent?.form.isConnected) return;
    send(sent);
  });

  useLayoutEffect(() => {
    const node = input.current;
    if (!node) return;
    const root = node.getRootNode();
    const onSubmit = (event: Event) => {
      if (event.target !== node.form) return;
      const draft = latest.current();
      if (draft?.unreadable) return draft.flag();
      if (!draft && !waiting()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      held.current = { form: event.target as HTMLFormElement, submitter: (event as SubmitEvent).submitter };
      draft?.commit();
    };
    root.addEventListener('submit', onSubmit, true);
    return () => {
      root.removeEventListener('submit', onSubmit, true);
      const sent = held.current;
      held.current = null;
      if (!sent) return;
      // The commit took the input out of the page: the product moved on, and the form still goes.
      queueMicrotask(() => {
        if (sent.form.isConnected) send(sent);
      });
    };
  }, [input]);

  return () => {
    asked.current += 1;
    bump();
  };
}
