import { isValidElement, useCallback, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { useComposedRefs } from './props.js';

/**
 * Two or more letters or digits name the button, such as "Got it" or "닫기";
 * a symbol such as × or a lone "x" glyph does not.
 */
function isWorded(text: string): boolean {
  return (text.match(/[\p{L}\p{N}]/gu) ?? []).length >= 2;
}

function hasWords(children: ReactNode): boolean {
  if (typeof children === 'string' || typeof children === 'number') return isWorded(String(children));
  if (Array.isArray(children)) return children.some(hasWords);
  if (isValidElement<{ children?: ReactNode; 'aria-hidden'?: unknown }>(children)) {
    // Like spokenText: SVG text, such as a <title>, does not count.
    if (children.type === 'svg') return false;
    const hidden = children.props['aria-hidden'];
    return hidden !== true && hidden !== 'true' && hasWords(children.props.children);
  }
  return false;
}

/** The text a screen reader reads from the button's content: not aria-hidden parts or SVG titles. */
export function spokenText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (!(node instanceof Element) || node.getAttribute('aria-hidden') === 'true' || node.namespaceURI === 'http://www.w3.org/2000/svg') {
    return '';
  }
  return [...node.childNodes].map(spokenText).join('');
}

type Watched = [Element, MutationObserverInit][];

/**
 * Calls `onChange` when any of the elements `find` returns changes as its
 * options say. The elements are found again after each change, so a replaced
 * one is followed; `refresh` finds them again on demand. Returns both, and
 * the cleanup. Without MutationObserver it does nothing.
 */
function watchElements(find: () => Watched, onChange: () => void) {
  const observer = typeof MutationObserver === 'undefined' ? null : new MutationObserver(() => {
    onChange();
    refresh();
  });
  function refresh() {
    if (!observer) return;
    observer.disconnect();
    for (const [element, options] of find()) observer.observe(element, options);
  }
  refresh();
  return { refresh, stop: () => observer?.disconnect() };
}

const BUTTON_CHANGES: MutationObserverInit = {
  childList: true,
  subtree: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['aria-hidden'],
};

/**
 * The accessible name for a button that Todae names, such as a dismiss or step
 * button: `ariaLabel` when not empty, none when the button's own rendered text
 * names it, and `fallback`, a string from StringsProvider, otherwise. Put the
 * returned ref on the button.
 */
export function useButtonName(
  children: ReactNode,
  ariaLabel: string | undefined,
  ref: Ref<HTMLButtonElement> | undefined,
  fallback: string,
): [string | undefined, Ref<HTMLButtonElement>] {
  // The rendered text decides, so a component that renders text (such as a
  // translation) names the button too. The children are a first guess for SSR.
  const [worded, setWorded] = useState(() => hasWords(children));
  const buttonRef = useRef<HTMLButtonElement>(null);
  const refs = useComposedRefs(buttonRef, ref);
  const read = useCallback(() => {
    const button = buttonRef.current;
    setWorded(button ? isWorded(spokenText(button)) : false);
  }, []);
  // Every commit, as the text can change; the same value bails out.
  useLayoutEffect(read);
  // A child can render its text from its own state, such as a translation
  // that loads later, without this component rendering again.
  useLayoutEffect(() => {
    const button = buttonRef.current;
    if (!button) return;
    return watchElements(() => [[button, BUTTON_CHANGES]], read).stop;
  }, [read]);
  return [ariaLabel || (worded ? undefined : fallback), refs];
}

/** What names an input, from its own attributes: the elements its `aria-labelledby` points at, else its `aria-label`, else its `<label>`s. Empty without one. */
export function labelOf(input: HTMLInputElement | null): string {
  if (!input) return '';
  const ids = input.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean) ?? [];
  const own = input.getAttribute('aria-label');
  const spoken = ids.length
    ? ids.map((id) => spokenText(input.ownerDocument.getElementById(id) ?? input.ownerDocument.createTextNode(''))).join(' ')
    : own || [...(input.labels ?? [])].map(spokenText).join(' ');
  return spoken.replace(/\s+/g, ' ').trim();
}

/**
 * Calls `onChange` with the input's label text now and whenever it changes: its
 * `<label>`s or the elements its `aria-labelledby` names, as their text or
 * attributes change, and the input's own `aria-label` and `aria-labelledby`.
 * `read` reads it again and follows the elements it now has, for a label that
 * mounted, was replaced or went since the last change: call it after each
 * commit. `stop` ends the watch.
 */
export function watchLabel(input: HTMLInputElement | null, onChange: (label: string) => void): { read: () => void; stop: () => void } {
  if (!input) return { read: () => {}, stop: () => {} };
  const find = (): Watched => {
    const ids = input.getAttribute('aria-labelledby')?.split(/\s+/).filter(Boolean) ?? [];
    const named = ids.length ? ids.map((id) => input.ownerDocument.getElementById(id)) : [...(input.labels ?? [])];
    return [
      [input, { attributes: true, attributeFilter: ['aria-label', 'aria-labelledby'] }],
      ...named.flatMap((element): Watched => (element ? [[element, { childList: true, subtree: true, characterData: true, attributes: true }]] : [])),
    ];
  };
  const watch = watchElements(find, () => onChange(labelOf(input)));
  const read = () => {
    onChange(labelOf(input));
    watch.refresh();
  };
  onChange(labelOf(input));
  return { read, stop: watch.stop };
}
