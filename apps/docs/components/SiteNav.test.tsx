// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SiteNav } from './SiteNav';

const path = vi.hoisted(() => ({ current: '/chip-list' }));
vi.mock('next/navigation', () => ({ usePathname: () => path.current }));

describe('SiteNav', () => {
  afterEach(() => {
    cleanup();
    path.current = '/chip-list';
  });

  it('groups the same links under Site', () => {
    render(<SiteNav locale="en" />);
    const nav = screen.getByRole('navigation', { name: 'Site' });
    // Five sections, and Field's child pages.
    expect(screen.getAllByRole('list')).toHaveLength(6);
    for (const name of ['Foundations', 'Components', 'Utilities', 'Recipes', 'Tools']) {
      expect(screen.getByRole('list', { name })).toBeTruthy();
      expect(screen.getByText(name).tagName).toBe('SPAN');
    }
    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current).toHaveLength(1);
    expect(current[0]?.textContent).toBe('ChipList');
    expect(nav.textContent).not.toContain('Recipes:');
    const hrefsIn = (name: string) =>
      [...screen.getByRole('list', { name }).querySelectorAll('a')].map((link) => link.getAttribute('href'));
    expect(hrefsIn('Components')).not.toContain('/composition');
    expect(hrefsIn('Foundations')).toEqual(['/guides/get-started', '/guides/build-on-todae', '/composition', '/tokens', '/guides/css-layers', '/platform']);
  });

  it('keeps group label ids unique for a second copy', () => {
    const { container } = render(
      <>
        <SiteNav locale="en" />
        <SiteNav locale="en" />
      </>,
    );
    const ids = [...container.querySelectorAll('ul[aria-labelledby]')].map((list) => list.getAttribute('aria-labelledby'));
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(document.getElementById(id ?? '')).not.toBeNull();
  });

  it('nests child pages under their parent link, open on the parent or a child', () => {
    const fieldPages = () => {
      const field = screen.getByRole('link', { name: 'Field' });
      const details = field.parentElement?.querySelector('details');
      return { field, details, links: [...(details?.querySelectorAll('ul a') ?? [])] };
    };
    render(<SiteNav locale="en" />);
    const closed = fieldPages();
    expect(closed.field.getAttribute('href')).toBe('/field');
    expect(closed.details?.open).toBe(false);
    expect(closed.details?.querySelector('summary')?.textContent).toBe('Field pages');
    expect(closed.links.map((link) => link.getAttribute('href'))).toEqual([
      '/field/chip-input',
      '/field/color-picker',
      '/field/date-picker',
      '/field/date-time-picker',
      '/field/number-input',
      '/field/select',
      '/field/textarea',
      '/field/text-input',
      '/field/time-picker',
    ]);
    cleanup();

    path.current = '/field';
    render(<SiteNav locale="en" />);
    expect(fieldPages().details?.open).toBe(true);
    expect(fieldPages().field.getAttribute('aria-current')).toBe('page');
    cleanup();

    path.current = '/field/select';
    render(<SiteNav locale="en" />);
    const open = fieldPages();
    expect(open.details?.open).toBe(true);
    expect(open.field.getAttribute('aria-current')).toBeNull();
    const current = screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page');
    expect(current.map((link) => link.getAttribute('href'))).toEqual(['/field/select']);
  });
});
