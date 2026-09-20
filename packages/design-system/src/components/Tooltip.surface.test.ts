import { describe, expect, it } from 'vitest';
import { contentPolicyError, isMounted, resolveSurface } from './Tooltip.surface';

describe('Tooltip.surface', () => {
  it('resolves tip attrs without popover', () => {
    const surface = resolveSurface(false, 'tip-1');
    expect(surface).toEqual({
      kind: 'tip',
      bridges: false,
      topLayer: false,
      attrs: {
        id: 'tip-1',
        role: 'tooltip',
        'data-surface': 'tip',
      },
    });
    expect('popover' in surface.attrs).toBe(false);
  });

  it('resolves panel attrs without role', () => {
    const surface = resolveSurface(true, 'panel-1');
    expect(surface).toEqual({
      kind: 'panel',
      bridges: true,
      topLayer: true,
      attrs: {
        id: 'panel-1',
        popover: 'manual',
        'data-surface': 'panel',
      },
    });
    expect('role' in surface.attrs).toBe(false);
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
      'Tooltip.Content is text-only. Add `interactive` for a link.',
    );
  });

  it('allows only href links in panel content', () => {
    const panel = resolveSurface(true, 'panel-1');
    const el = document.createElement('div');
    el.innerHTML = '<a href="/tooltip">Read the policy</a>';
    expect(contentPolicyError(panel, el)).toBeNull();
    el.innerHTML = '<button type="button">No</button>';
    expect(contentPolicyError(panel, el)).toBe(
      'Interactive Tooltip.Content allows links only. Use Popover.',
    );
    el.innerHTML = '<a>Missing href</a>';
    expect(contentPolicyError(panel, el)).toBeNull();
  });
});
