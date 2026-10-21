import { FORM_ROOTS } from './Form.model.js';
import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';

/** What a submit finds in the input: text no number (`flag` marks it; a check that runs blocks the submit, and where none will run, a `noValidate` form that is not Form.Root or a submitter with `formNoValidate`, the submit is cancelled here and focus moves to the text), or a draft the submit commits. */
export type SubmitDraft = { unreadable: true; flag: () => void } | { unreadable?: false; commit: () => void };

// The submits whose invalid text has been given focus, so a form with several unreadable inputs focuses one of them, not the last.
const focused = new WeakSet<Event>();

type Held = { form: HTMLFormElement; submitter: HTMLElement | null };

// The submit again, from the same submitter while it still belongs to the form.
function send({ form, submitter }: Held) {
  form.requestSubmit(submitter?.isConnected && (submitter as HTMLButtonElement).form === form ? submitter : undefined);
}

// The attribute the input carries its commit count in, so the page itself says which commit it shows.
const COUNT = 'data-todae-commits';

// The one watcher of a held submit, started when the submit is held and standing on the input's root node, not on the input: a capture listener folds every later submit of the form into the held one (the newest submitter is kept), and a MutationObserver sends it once, when the input is gone from the page or the page shows its commit. Both run outside React's commit, so a product's `onSubmit` sees the whole layout commit (the DOM, refs and layout effects, not passive effects, which a commit outside a discrete event runs later) and may call `flushSync`.
function watch(node: HTMLElement, held: Held, behind: (node: HTMLElement) => boolean, end: () => void) {
  const root = node.getRootNode();
  // Not a copy of the input's listener: that one is removed when the input's effects turn off (an Activity or a Suspense boundary hides it), and the watcher still has to fold then.
  const onSubmit = (event: Event) => {
    if (event.target !== held.form) return;
    fold(held, event);
  };
  const observer = new MutationObserver(() => {
    if (node.isConnected && behind(node)) return;
    root.removeEventListener('submit', onSubmit, true);
    observer.disconnect();
    end();
    if (held.form.isConnected) send(held);
  });
  root.addEventListener('submit', onSubmit, true);
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: [COUNT] });
}

// A later submit of the form joins the held one: cancelled, and the newest submitter is the one that is sent.
function fold(held: Held, event: Event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  held.submitter = (event as SubmitEvent).submitter;
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
 *   is behind `asked`. The page is the one place that knows what has been
 *   shown, whether or not the input's effects ran.
 * - Text that is no number is not a value, so no submit sends the old number
 *   in its place. The unreadable text makes the value input invalid, so a
 *   form that checks (the browser's check, or Form.Root's, which words it)
 *   blocks the submit and this only flags the text. Where no check will run,
 *   a `noValidate` form that is not Form.Root (which registers its `<form>` in
 *   `FORM_ROOTS`) or a submitter with `formNoValidate` (a Form.Root's
 *   included), the submit is cancelled here, with `preventDefault` and
 *   `stopPropagation` (so every unreadable input of the form still flags),
 *   flagged, and focus moves to the text.
 * - A submit of the input's form that finds a draft that reads (`read`), or
 *   the input waiting (a product's auto-submit in `onValueChange`, a step with
 *   no draft), is cancelled and held: `preventDefault` and
 *   `stopImmediatePropagation`. The draft commits as blur does.
 * - One watcher holds it from then on, on the input's root node, so it does
 *   not depend on the input's effects, which a Suspense boundary or an
 *   Activity turns off. Every later submit of the form is folded into the
 *   held one (cancelled, the newest submitter kept), and a MutationObserver
 *   sends the form once, from the observer's callback after React's commit,
 *   when the input is gone from the page (the product moved on, and the form
 *   still goes if it is in the page) or the page shows the commit (the count
 *   level). So a number the product refuses is never sent, the product is
 *   never told a number other than the one sent, and the form never sends
 *   twice. A hidden input, a Suspense boundary that keeps the old page and
 *   a removed one all settle by that one rule.
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
  const latest = useRef(read);
  // A hidden input's ref is cleared, so the element the watcher saw is asked, not `input.current`.
  const behind = useCallback((node: HTMLElement | null) => asked.current !== Number(node?.getAttribute(COUNT) ?? 0), []);
  // For event handlers: render does not read it.
  const waiting = useCallback(() => behind(input.current), [behind, input]);

  useLayoutEffect(() => {
    latest.current = read;
  });

  useLayoutEffect(() => {
    const node = input.current;
    if (!node) return;
    const root = node.getRootNode();
    const onSubmit = (event: Event) => {
      if (event.target !== node.form) return;
      // A submit while one is held joins it.
      if (held.current) return fold(held.current, event);
      const draft = latest.current();
      const submitter = (event as SubmitEvent).submitter;
      if (draft?.unreadable) {
        draft.flag();
        // A check that runs blocks it: the browser's before `submit` fires, or Form.Root's, which words the error and so has to hear the event. Where none will run, a plain `noValidate` form or a submitter with `formNoValidate` (in a Form.Root too, whose own handler would send it), nothing else stops the old number going out. It is cancelled, and focus moves to the text so the person hears which field is invalid. Not `stopImmediatePropagation`: the other inputs of the form listen on this node too, and each flags its own text.
        const form = event.target as HTMLFormElement;
        if ((form.noValidate && !FORM_ROOTS.has(form)) || (submitter as HTMLButtonElement | null)?.formNoValidate) {
          event.preventDefault();
          event.stopPropagation();
          // The first unreadable input in the order the inputs listen, which is the order they mounted in, takes focus.
          if (!focused.has(event)) {
            focused.add(event);
            node.focus();
          }
        }
        return;
      }
      if (!draft && !waiting()) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const hold: Held = { form: event.target as HTMLFormElement, submitter };
      held.current = hold;
      watch(node, hold, behind, () => {
        if (held.current === hold) held.current = null;
      });
      draft?.commit();
    };
    root.addEventListener('submit', onSubmit, true);
    return () => root.removeEventListener('submit', onSubmit, true);
  }, [input, waiting, behind]);

  return {
    committed: () => {
      asked.current += 1;
      setCount(asked.current);
    },
    waiting,
    mark: { [COUNT]: count },
  };
}
