// @vitest-environment jsdom
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { flatLinks, HOME_FEATURED, INDEX_GROUPS, SITE_GROUPS } from '../../components/siteGroups';
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

  it('features eight items per catalog and links the whole catalog', () => {
    render(<HomePage />);
    const region = (name: string) => within(screen.getByRole('region', { name }));
    const items = (name: string) => region(name).getAllByRole('listitem').map((item) => item.textContent);
    const featured = {
      Components: {
        items: ['Button', 'TextInput', 'Select', 'Dialog', 'Menu', 'Tooltip', 'Mention', 'Conversation'],
        all: ['See all 57', '/components'],
      },
      Utilities: {
        items: ['useField', 'usePopover', 'useTooltip', 'useMentions', 'useRovingFocus', 'useCombobox', 'useHotkey', 'useDropzone'],
        all: ['See all 26', '/utilities'],
      },
      Recipes: {
        items: ['App shell', 'Sign-in and sign-up', 'Data table', 'Command palette', 'Chat composer mentions', 'Tool call', 'Reasoning', 'File upload'],
        all: ['See all 19', '/recipes'],
      },
    };
    for (const [name, { items: expected, all }] of Object.entries(featured)) {
      expect(items(name), name).toEqual(expected);
      expect(region(name).getByRole('link', { name: all[0] }).getAttribute('href'), name).toBe(all[1]);
    }
    for (const name of ['Foundations', 'Tools']) {
      expect(region(name).queryAllByRole('link', { name: /^See all/ }), name).toEqual([]);
    }
    expect(screen.queryByRole('link', { name: 'Alert' })).toBeNull();
    expect(region('Foundations').getByRole('link', { name: 'Get started' })).toBeTruthy();
  });

  it('features only hrefs that belong to the group, once each', () => {
    const misses = INDEX_GROUPS.flatMap((id) => {
      const group = SITE_GROUPS.find((item) => item.id === id);
      const own = new Set<string>(flatLinks(group?.links ?? []).map(([href]) => href));
      const featured: readonly string[] = HOME_FEATURED[id];
      return [
        ...featured.filter((href) => !own.has(href)).map((href) => `${id}: ${href} is not in the group`),
        ...featured.filter((href, index) => featured.indexOf(href) !== index).map((href) => `${id}: ${href} is listed twice`),
      ];
    });
    expect(misses).toEqual([]);
  });

  it('lists every docs page in a section', () => {
    const listed = new Set<string>(SITE_GROUPS.flatMap((group) => flatLinks(group.links).map(([href]) => href)));
    const catalogs = new Set(INDEX_GROUPS.map((id) => `/${id}`));
    expect(pagePaths(__dirname).filter((path) => !listed.has(path) && !catalogs.has(path))).toEqual([]);
  });

  it('lists a page under Components only when it documents an exported component', () => {
    // A page with a props table documents an export; anything else is a guide or a recipe.
    const components = SITE_GROUPS.find((group) => group.id === 'components')?.links ?? [];
    expect(components.length).toBeGreaterThan(0);
    const hasProps = (href: string) => /^<PropsTable name="/m.test(readFileSync(join(__dirname, href, 'page.mdx'), 'utf8'));
    expect(components.map(([href]) => href).filter((href) => !hasProps(href))).toEqual([]);
  });
});
