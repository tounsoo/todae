import { getCandidates } from '../overlay/tabbables.js';

export type TipAttrs = {
  readonly id: string;
  readonly role: 'tooltip';
  readonly popover: 'manual';
  readonly 'data-surface': 'tip';
};

export type PanelAttrs = {
  readonly id: string;
  readonly role: 'dialog';
  readonly popover: 'manual';
  readonly 'data-surface': 'panel';
};

export type TipSurface = {
  readonly kind: 'tip';
  readonly attrs: TipAttrs;
};

export type PanelSurface = {
  readonly kind: 'panel';
  readonly attrs: PanelAttrs;
};

export type TooltipSurface = TipSurface | PanelSurface;

export function resolveSurface(interactive: boolean, id: string): TooltipSurface {
  if (interactive) {
    return {
      kind: 'panel',
      attrs: {
        id,
        role: 'dialog',
        popover: 'manual',
        'data-surface': 'panel',
      },
    };
  }
  return {
    kind: 'tip',
    attrs: {
      id,
      role: 'tooltip',
      popover: 'manual',
      'data-surface': 'tip',
    },
  };
}

/** A panel stays mounted so the pointer can bridge into it; a tip mounts only while open. */
export function isMounted(surface: TooltipSurface, open: boolean): boolean {
  return surface.kind === 'panel' || open;
}

// Elements that close an open <p> in the HTML parser. Tooltip.Root is a span, so a
// paragraph can hold it, but only while its content is phrasing content.
const NON_PHRASING =
  'address,article,aside,blockquote,details,dialog,div,dl,fieldset,figcaption,figure,footer,form,h1,h2,h3,h4,h5,h6,header,hgroup,hr,main,menu,nav,ol,p,pre,search,section,table,ul';

export function contentPolicyError(surface: TooltipSurface, el: HTMLElement): string | null {
  if (el.querySelector(NON_PHRASING)) {
    return 'Tooltip holds phrasing content only, such as text, links and spans, so it can sit in a paragraph.';
  }
  // What kinds of control the content holds, not what Tab reaches now: a panel
  // mounts closed, and a control taken out of the tab order is still one.
  const tabbables = getCandidates(el).filter((node) => !node.matches(':disabled'));
  if (surface.kind === 'tip') {
    return tabbables.length > 0 ? 'Tooltip is text-only. Use useTooltip({ interactive: true }) for a link.' : null;
  }
  const illegal = tabbables.some((node) => node.tagName !== 'A' || !node.hasAttribute('href'));
  return illegal ? 'Interactive Tooltip allows links only. Use Popover.' : null;
}
