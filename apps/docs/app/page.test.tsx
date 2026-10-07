// @vitest-environment jsdom
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SITE_GROUPS } from '../components/siteGroups';
import HomePage from './page';

// next.config pageExtensions.
const PAGE_FILES = ['js', 'jsx', 'md', 'mdx', 'ts', 'tsx'].map((ext) => `page.${ext}`);

// Every page under app/, as a URL path. A route group adds no segment;
// private folders, dynamic segments and parallel slots are not plain links.
function pagePaths(dir: string, path = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || /^[_[@]/.test(entry.name)) return [];
    const child = entry.name.startsWith('(') ? path : `${path}/${entry.name}`;
    const own = PAGE_FILES.some((file) => existsSync(join(dir, entry.name, file))) ? [child] : [];
    return [...own, ...pagePaths(join(dir, entry.name), child)];
  });
}

describe('HomePage', () => {
  it('lists each section, and every link has a page', () => {
    const { container } = render(<HomePage />);
    for (const name of ['Components', 'Utilities', 'Recipes', 'Foundations', 'Tools']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeTruthy();
    }
    const hrefs = [...container.querySelectorAll('a')].map((link) => link.getAttribute('href') ?? '');
    expect(hrefs.length).toBeGreaterThan(0);
    const pages = new Set(pagePaths(__dirname));
    // Internal links only; an external one has no page here.
    for (const href of hrefs.filter((link) => link.startsWith('/'))) {
      expect(pages.has(href.replace(/[?#].*$/, '')), href).toBe(true);
    }
  });

  it('lists every docs page in a section', () => {
    const listed = new Set<string>(SITE_GROUPS.flatMap((group) => group.links.map(([href]) => href)));
    expect(pagePaths(__dirname).filter((path) => !listed.has(path))).toEqual([]);
  });
});
