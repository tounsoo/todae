import { useEffect, useState, type RefObject } from 'react';

/** Whether the page `ref` sits in is hidden, such as in a background tab. */
export function usePageHidden(ref: RefObject<Element | null>): boolean {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    const doc = ref.current?.ownerDocument;
    if (!doc) return;
    const sync = () => setHidden(doc.visibilityState === 'hidden');
    sync();
    doc.addEventListener('visibilitychange', sync);
    return () => doc.removeEventListener('visibilitychange', sync);
  }, [ref]);
  return hidden;
}
