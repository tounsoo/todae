import { isValidElement, useLayoutEffect, useRef, useState, type ReactNode, type Ref } from 'react';
import { useComposedRefs } from './props';

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
 * The accessible name for a dismiss button: `ariaLabel` when given, none when
 * the button's own rendered text names it, and "Dismiss" otherwise. Put the
 * returned ref on the button.
 */
export function useDismissLabel(
  children: ReactNode,
  ariaLabel: string | undefined,
  ref: Ref<HTMLButtonElement> | undefined,
): [string | undefined, Ref<HTMLButtonElement>] {
  // The rendered text decides, so a component that renders text (such as a
  // translation) names the button too. The children are a first guess for SSR.
  const [worded, setWorded] = useState(() => hasWords(children));
  const buttonRef = useRef<HTMLButtonElement>(null);
  const refs = useComposedRefs(buttonRef, ref);
  // Every commit, as the text can change; the same value bails out.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const button = buttonRef.current;
    setWorded(button ? isWorded(spokenText(button)) : false);
  });
  return [ariaLabel ?? (worded ? undefined : 'Dismiss'), refs];
}
