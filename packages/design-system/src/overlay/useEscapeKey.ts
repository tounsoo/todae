import { useEffect } from 'react';

export function useEscapeKey(active: boolean, enabled: boolean, handler: () => void): void {
  useEffect(() => {
    if (!active || !enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      handler();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, enabled, handler]);
}
