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
function spokenText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? '';
  if (!(node instanceof Element) || node.getAttribute('aria-hidden') === 'true' || node.namespaceURI === 'http://www.w3.org/2000/svg') {
    return '';
  }
  return [...node.childNodes].map(spokenText).join('');
}

/**
 * The accessible name for a dismiss button: `ariaLabel` when not empty, none when
 * the button's own rendered text names it, and `fallback`, a string from
 * StringsProvider, otherwise. Put the returned ref on the button.
 */
export function useDismissLabel(
  children: ReactNode,
  ariaLabel: string | undefined,
  ref: Ref<HTMLButtonElement> | undefined,
  fallback: string,
): [string | undefined, Ref<HTMLButtonElement>] {
  // The rendered text decides, so a component that renders text (such as a
  // translation) names the button too. The children are a first guess for SSR.
  const [worded, setWorded] = useState(() => hasWords(children));
  const buttonRef = useRef<HTMLButtonElement>(null);
  // The element as state too, so the observer below follows a button that
  // unmounts and mounts again, as one that renders nothing at times does.
  const [button, setButton] = useState<HTMLButtonElement | null>(null);
  const refs = useComposedRefs(buttonRef, setButton, ref);
  const read = useCallback(() => {
    const el = buttonRef.current;
    setWorded(el ? isWorded(spokenText(el)) : false);
  }, []);
  // Every commit, as the text can change; the same value bails out.
  useLayoutEffect(read);
  // A child can render its text from its own state, such as a translation
  // that loads later, without this component rendering again.
  useLayoutEffect(() => {
    if (!button || typeof MutationObserver === 'undefined') return;
    const observer = new MutationObserver(read);
    observer.observe(button, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['aria-hidden'],
    });
    return () => observer.disconnect();
  }, [button, read]);
  return [ariaLabel || (worded ? undefined : fallback), refs];
}
