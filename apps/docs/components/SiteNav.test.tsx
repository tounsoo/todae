// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SiteNav } from './SiteNav';

vi.mock('next/navigation', () => ({ usePathname: () => '/recipes/chip-list' }));

const HREFS = [
  '/composition',
  '/button',
  '/chip',
  '/field',
  '/label',
  '/description',
  '/errormessage',
  '/checkbox',
  '/radio',
  '/switch',
  '/dialog',
  '/popover',
  '/tooltip',
  '/optionlist',
  '/bottomsheet',
  '/stack',
  '/text',
  '/recipes/chip-list',
  '/recipes/combobox',
  '/tokens',
  '/playground',
];

describe('SiteNav', () => {
  it('groups the same links under Site', () => {
    render(<SiteNav />);
    const nav = screen.getByRole('navigation', { name: 'Site' });
    expect(screen.getAllByRole('list')).toHaveLength(4);
    for (const name of ['Components', 'Recipes', 'Foundations', 'Tools']) {
      expect(screen.getByRole('list', { name })).toBeTruthy();
      expect(screen.getByText(name).tagName).toBe('SPAN');
    }
    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toBe('Chip list with overflow');
    expect([...nav.querySelectorAll('a')].map((link) => link.getAttribute('href'))).toEqual(HREFS);
    expect(nav.textContent).not.toContain('Recipes:');
  });
});
