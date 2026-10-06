import type { CSSProperties } from 'react';

/**
 * The trigger style for an overlay anchored by `name`. `anchor-name` takes a
 * list, so a trigger that is also another overlay's anchor (a menu trigger
 * with a tooltip) keeps both names.
 */
export function anchorTriggerStyle(variable: string, name: string, existing?: CSSProperties): CSSProperties {
  const names = (existing?.anchorName ?? '')
    .split(',')
    .map((n) => n.trim())
    .filter((n) => n !== '' && n !== 'none' && n !== name);
  return {
    [variable as string]: name,
    anchorName: [...names, name].join(', '),
  } as CSSProperties;
}
