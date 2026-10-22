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

  it('flags a control with a negative tabindex or under aria-hidden', () => {
    const tip = resolveSurface(false, 'tip-1');
    const panel = resolveSurface(true, 'panel-1');
    const el = document.createElement('div');
    for (const html of [
      '<button type="button" tabindex="-1">Undo</button>',
      '<button type="button" aria-hidden="true">Undo</button>',
      '<span aria-hidden="true"><button type="button">Undo</button></span>',
    ]) {
      el.innerHTML = html;
      expect(contentPolicyError(tip, el)).toBe(
        'Tooltip is text-only. Use useTooltip({ interactive: true }) for a link.',
      );
      expect(contentPolicyError(panel, el)).toBe('Interactive Tooltip allows links only. Use Popover.');
    }
  });

  it('rejects content that would close a paragraph', () => {
    const error = 'Tooltip holds phrasing content only, such as text, links and spans, so it can sit in a paragraph.';
    for (const surface of [resolveSurface(false, 'tip-1'), resolveSurface(true, 'panel-1')]) {
      const el = document.createElement('span');
      el.innerHTML = '<strong>Popover API</strong><br><span>developer.mozilla.org</span>';
      expect(contentPolicyError(surface, el)).toBeNull();
      for (const html of ['<p>Text</p>', '<div>Text</div>', '<ul><li>Text</li></ul>']) {
        el.innerHTML = html;
        expect(contentPolicyError(surface, el)).toBe(error);
      }
    }
  });
});
