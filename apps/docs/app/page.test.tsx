// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SiteNav } from '../components/SiteNav';
import HomePage from './page';

vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

describe('HomePage', () => {
  it('lists every sidebar link under the same section names', () => {
    const { container } = render(<HomePage />);
    const home = [...container.querySelectorAll('a')].map((link) => link.getAttribute('href'));
    for (const name of ['Components', 'Utilities', 'Recipes', 'Foundations', 'Tools']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeTruthy();
    }
    const nav = render(<SiteNav />).container;
    expect(home).toEqual([...nav.querySelectorAll('a')].map((link) => link.getAttribute('href')));
  });
});
