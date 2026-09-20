import { getTabbables } from '../overlay/tabbables';

export type TipAttrs = {
  readonly id: string;
  readonly role: 'tooltip';
  readonly 'data-surface': 'tip';
  readonly popover?: never;
};

export type PanelAttrs = {
  readonly id: string;
  readonly popover: 'manual';
  readonly 'data-surface': 'panel';
  readonly role?: never;
};

export type TipSurface = {
  readonly kind: 'tip';
  readonly bridges: false;
  readonly topLayer: false;
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
        popover: 'manual',
        'data-surface': 'panel',
      },
    };
  }
  return {
    kind: 'tip',
    bridges: false,
    topLayer: false,
    attrs: {
      id,
      role: 'tooltip',
      'data-surface': 'tip',
    },
  };
}

export function isMounted(surface: TooltipSurface, open: boolean): boolean {
  return surface.topLayer || open;
}

export function contentPolicyError(surface: TooltipSurface, el: HTMLElement): string | null {
  const tabbables = getTabbables(el);
  if (surface.kind === 'tip') {
    return tabbables.length > 0 ? 'Tooltip.Content is text-only. Add `interactive` for a link.' : null;
  }
  const illegal = tabbables.some((node) => node.tagName !== 'A' || !node.hasAttribute('href'));
  return illegal ? 'Interactive Tooltip.Content allows links only. Use Popover.' : null;
}
