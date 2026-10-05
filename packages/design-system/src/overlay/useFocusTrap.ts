import { useEffect } from 'react';
import { getTabbables } from './tabbables';

function attachTrap(root: HTMLElement): () => void {
  function wrap(event: KeyboardEvent) {
    if (event.key !== 'Tab') return;
    const tabbables = getTabbables(root);
    const first = tabbables[0];
    const last = tabbables[tabbables.length - 1];
    if (!first || !last) {
      event.preventDefault();
      root.focus();
      return;
    }
    const current = document.activeElement;
    if (event.shiftKey && (current === first || !root.contains(current))) {
      event.preventDefault();
      last.focus();
      return;
    }
    if (!event.shiftKey && (current === last || !root.contains(current))) {
      event.preventDefault();
      first.focus();
    }
  }

  function pullBack(event: FocusEvent) {
    const next = event.target;
    if (!(next instanceof Node) || root.contains(next)) return;
    (getTabbables(root)[0] ?? root).focus();
  }

  root.addEventListener('keydown', wrap);
  document.addEventListener('focusin', pullBack);
  return () => {
    root.removeEventListener('keydown', wrap);
    document.removeEventListener('focusin', pullBack);
  };
}

/**
 * Takes the container node, not a ref: a portaled container can mount a commit
 * after its owner, and an effect keyed on a ref would never see it arrive.
 */
export function useFocusTrap(root: HTMLElement | null, active: boolean): void {
  useEffect(() => {
    if (!active || !root) return;
    return attachTrap(root);
  }, [active, root]);
}
