// @vitest-environment jsdom
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { flatLinks, SITE_GROUPS } from '../../components/siteGroups';
import { PAGE_FILES } from '../../lib/i18n/pages';
import HomePage from './page';

// Every page under app/, as a URL path. A route group adds no segment;
// private folders, dynamic segments and parallel slots are not plain links.
function pagePaths(dir: string, path = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    // `(.)x` and `(..)x` intercept other routes; they are not pages of their own.
    if (!entry.isDirectory() || /^([_[@]|\(\.)/.test(entry.name)) return [];
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
    const listed = new Set<string>(SITE_GROUPS.flatMap((group) => flatLinks(group.links).map(([href]) => href)));
    expect(pagePaths(__dirname).filter((path) => !listed.has(path))).toEqual([]);
  });

  it('lists a page under Components only when it documents an exported component', () => {
    // A page with a props table documents an export; anything else is a guide or a recipe.
    const components = SITE_GROUPS.find((group) => group.id === 'components')?.links ?? [];
    expect(components.length).toBeGreaterThan(0);
    const hasProps = (href: string) => /^<PropsTable name="/m.test(readFileSync(join(__dirname, href, 'page.mdx'), 'utf8'));
    expect(components.map(([href]) => href).filter((href) => !hasProps(href))).toEqual([]);
  });
});
