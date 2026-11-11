import { useId } from 'react';

/**
 * A value made safe for an id, one-to-one so two values never share an id:
 * every character outside [A-Za-z0-9-], `_` included, becomes `_<hex>_`.
 */
export function domSafe(value: string): string {
  return value.replace(/[^A-Za-z0-9-]/gu, (char) => `_${char.codePointAt(0)!.toString(16)}_`);
}

/**
 * A useId value safe in an id selector and a CSS custom ident: React's
 * separators (`:` in 18, `«»` in 19.1) are dropped.
 */
export function useDomId(): string {
  return useId().replace(/[^A-Za-z0-9_-]/gu, '');
}
