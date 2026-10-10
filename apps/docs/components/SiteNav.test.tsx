// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SiteNav } from './SiteNav';

vi.mock('next/navigation', () => ({ usePathname: () => '/chip-list' }));

describe('SiteNav', () => {
  it('groups the same links under Site', () => {
    render(<SiteNav locale="en" />);
    const nav = screen.getByRole('navigation', { name: 'Site' });
    expect(screen.getAllByRole('list')).toHaveLength(5);
    for (const name of ['Foundations', 'Components', 'Utilities', 'Recipes', 'Tools']) {
      expect(screen.getByRole('list', { name })).toBeTruthy();
      expect(screen.getByText(name).tagName).toBe('SPAN');
    }
    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toBe('ChipList');
    expect(nav.textContent).not.toContain('Recipes:');
    expect(screen.getByRole('list', { name: 'Foundations' }).getAttribute('aria-labelledby')).toBe('nav-foundations');
    const hrefsIn = (name: string) =>
      [...screen.getByRole('list', { name }).querySelectorAll('a')].map((link) => link.getAttribute('href'));
    expect(hrefsIn('Components')).not.toContain('/composition');
    expect(hrefsIn('Foundations')).toEqual(['/guides/build-on-todae', '/composition', '/tokens', '/guides/css-layers', '/platform']);
  });

  it('keeps group label ids unique for a second copy', () => {
    const { container } = render(
      <>
        <SiteNav locale="en" />
        <SiteNav locale="en" idPrefix="drawer-nav" />
      </>,
    );
    const ids = [...container.querySelectorAll('.site-nav-label')].map((label) => label.id);
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(ids.length);
    for (const list of container.querySelectorAll('ul[aria-labelledby]')) {
      expect(container.querySelector(`#${list.getAttribute('aria-labelledby')}`)).not.toBeNull();
    }
  });
});
