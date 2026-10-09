import { describe, expect, it } from 'vitest';
import { contentPolicyError, isMounted, resolveSurface } from './Tooltip.surface';

describe('Tooltip.surface', () => {
  it('resolves tip attrs as a manual popover in the top layer', () => {
    const surface = resolveSurface(false, 'tip-1');
    expect(surface).toEqual({
      kind: 'tip',
      attrs: {
        id: 'tip-1',
        role: 'tooltip',
        popover: 'manual',
        'data-surface': 'tip',
      },
    });
  });

  it('resolves panel attrs as a named dialog, never tooltip', () => {
    const surface = resolveSurface(true, 'panel-1');
    expect(surface).toEqual({
      kind: 'panel',
      attrs: {
        id: 'panel-1',
        role: 'dialog',
        popover: 'manual',
        'data-surface': 'panel',
      },
    });
    expect(surface.attrs.role).toBe('dialog');
    expect(surface.attrs.role === 'tooltip').toBe(false);
  });

  it('mounts tip only while open and panel always', () => {
    const tip = resolveSurface(false, 'tip-1');
    const panel = resolveSurface(true, 'panel-1');
    expect(isMounted(tip, false)).toBe(false);
    expect(isMounted(tip, true)).toBe(true);
    expect(isMounted(panel, false)).toBe(true);
    expect(isMounted(panel, true)).toBe(true);
  });

  it('rejects tabbables in tip content', () => {
    const tip = resolveSurface(false, 'tip-1');
    const el = document.createElement('div');
    el.textContent = 'Archive';
    expect(contentPolicyError(tip, el)).toBeNull();
    el.innerHTML = '<a href="/tooltip">Read the policy</a>';
    expect(contentPolicyError(tip, el)).toBe(
      'Tooltip is text-only. Use useTooltip({ interactive: true }) for a link.',
    );
  });

  it('allows only href links in panel content', () => {
    const panel = resolveSurface(true, 'panel-1');
    const el = document.createElement('div');
    el.innerHTML = '<a href="/tooltip">Read the policy</a>';
    expect(contentPolicyError(panel, el)).toBeNull();
    el.innerHTML = '<button type="button">No</button>';
    expect(contentPolicyError(panel, el)).toBe(
      'Interactive Tooltip allows links only. Use Popover.',
    );
    el.innerHTML = '<a>Missing href</a>';
    expect(contentPolicyError(panel, el)).toBeNull();
  });
});
