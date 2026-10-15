import { describe, expect, it } from 'vitest';
import { contentPolicyError, resolveSurface } from './Tooltip.surface.js';

describe('Tooltip.surface', () => {
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
