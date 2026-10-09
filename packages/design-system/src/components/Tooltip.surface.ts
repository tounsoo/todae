import { getTabbables } from '../overlay/tabbables';

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
  readonly bridges: false;
  readonly topLayer: true;
  readonly attrs: TipAttrs;
};

export type PanelSurface = {
  readonly kind: 'panel';
  readonly bridges: true;
  readonly topLayer: true;
  readonly attrs: PanelAttrs;
};

export type TooltipSurface = TipSurface | PanelSurface;

export function resolveSurface(interactive: boolean, id: string): TooltipSurface {
  if (interactive) {
    return {
      kind: 'panel',
      bridges: true,
      topLayer: true,
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
    bridges: false,
    // In the top layer, so no transformed or overflow: hidden ancestor clips it.
    topLayer: true,
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

export function contentPolicyError(surface: TooltipSurface, el: HTMLElement): string | null {
  const tabbables = getTabbables(el);
  if (surface.kind === 'tip') {
    return tabbables.length > 0 ? 'Tooltip is text-only. Use useTooltip({ interactive: true }) for a link.' : null;
  }
  const illegal = tabbables.some((node) => node.tagName !== 'A' || !node.hasAttribute('href'));
  return illegal ? 'Interactive Tooltip allows links only. Use Popover.' : null;
}
