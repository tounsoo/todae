// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SiteNav } from './SiteNav';

vi.mock('next/navigation', () => ({ usePathname: () => '/recipes/chip-list' }));

const HREFS = [
  '/button',
  '/chip',
  '/field',
  '/label',
  '/description',
  '/errormessage',
  '/fieldset',
  '/checkbox',
  '/radio',
  '/switch',
  '/dialog',
  '/popover',
  '/menu',
  '/tooltip',
  '/tabs',
  '/optionlist',
  '/bottomsheet',
  '/alert',
  '/stack',
  '/text',
  '/link',
  '/disclosure',
  '/visually-hidden',
  '/utilities/use-chip-field',
  '/utilities/use-chip-list',
  '/utilities/use-combobox',
  '/utilities/use-field',
  '/utilities/use-highlight',
  '/utilities/use-popover',
  '/utilities/use-roving-focus',
  '/utilities/use-sheet-presentation',
  '/utilities/use-tooltip',
  '/recipes/chip-list',
  '/recipes/combobox',
  '/composition',
  '/tokens',
  '/guides/build-on-todae',
  '/platform',
  '/playground',
];

describe('SiteNav', () => {
  it('groups the same links under Site', () => {
    render(<SiteNav locale="en" />);
    const nav = screen.getByRole('navigation', { name: 'Site' });
    expect(screen.getAllByRole('list')).toHaveLength(5);
    for (const name of ['Components', 'Utilities', 'Recipes', 'Foundations', 'Tools']) {
      expect(screen.getByRole('list', { name })).toBeTruthy();
      expect(screen.getByText(name).tagName).toBe('SPAN');
    }
    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toBe('Chip list with overflow');
    expect([...nav.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual(HREFS);
    expect(nav.textContent).not.toContain('Recipes:');
    const hrefsIn = (name: string) =>
      [...screen.getByRole('list', { name }).querySelectorAll('a')].map((link) => link.getAttribute('href'));
    expect(hrefsIn('Components')).not.toContain('/composition');
    expect(hrefsIn('Foundations')).toEqual(['/composition', '/tokens', '/guides/build-on-todae', '/platform']);
    expect(hrefsIn('Utilities')).toEqual([
      '/utilities/use-chip-field',
      '/utilities/use-chip-list',
      '/utilities/use-combobox',
      '/utilities/use-field',
      '/utilities/use-highlight',
      '/utilities/use-popover',
      '/utilities/use-roving-focus',
      '/utilities/use-sheet-presentation',
      '/utilities/use-tooltip',
    ]);
  });
});
