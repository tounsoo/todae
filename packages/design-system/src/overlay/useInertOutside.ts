import { useLayoutEffect } from 'react';

export function useInertOutside(containerEl: HTMLElement | null, active: boolean): void {
  useLayoutEffect(() => {
    if (!active || !containerEl) return;
    const prior = new Map<HTMLElement, boolean>();
    for (const child of document.body.children) {
      if (!(child instanceof HTMLElement) || child === containerEl) continue;
      prior.set(child, child.inert);
      child.inert = true;
    }
    return () => {
      for (const [el, was] of prior) el.inert = was;
    };
  }, [active, containerEl]);
}
