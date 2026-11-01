// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { flatLinks, INDEX_GROUPS, SITE_GROUPS } from './siteGroups';
import { GroupIndex } from './GroupIndex';
import { pageDescriptions } from '../lib/pageDescriptions';

function hrefsFor(id: (typeof INDEX_GROUPS)[number]) {
  const group = SITE_GROUPS.find((item) => item.id === id);
  if (!group) throw new Error(`SITE_GROUPS has no ${id} group`);
  return flatLinks(group.links).map(([href]) => href);
}

describe('GroupIndex', () => {
  afterEach(cleanup);

  it('lists every page in the group, and only the descriptions it was given', () => {
    const { container } = render(
      <GroupIndex locale="en" id="components" descriptions={new Map([['button', 'The button control.']])} />,
    );
    const hrefs = [...container.querySelectorAll('a')].map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(hrefsFor('components'));
    expect(screen.getByRole('heading', { level: 1, name: 'Components' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Button' }).closest('li')?.textContent).toContain('The button control.');
    expect(screen.getByRole('link', { name: 'Alert' }).closest('li')?.querySelector('p')).toBeNull();
    expect(hrefs).toContain('/field/chip-input');
  });

  it('lists every page in each catalog, in Korean URLs for Korean', () => {
    const titles = { components: '컴포넌트', utilities: '유틸리티', recipes: '레시피' } as const;
    for (const id of INDEX_GROUPS) {
      const { container, unmount } = render(<GroupIndex locale="ko" id={id} descriptions={new Map()} />);
      const hrefs = [...container.querySelectorAll('a')].map((link) => link.getAttribute('href'));
      expect(hrefs, id).toEqual(hrefsFor(id).map((href) => `/ko${href}`));
      expect(screen.getByRole('heading', { level: 1, name: titles[id] })).toBeTruthy();
      unmount();
    }
  });

  it('shows a page summary when the page has one, and none for the catalog slug', () => {
    const button = pageDescriptions('en').get('button') ?? '';
    expect(button.startsWith('Button.Root is the control.')).toBe(true);
    expect(pageDescriptions('ko').get('button')).toBeTruthy();
    const { container } = render(<GroupIndex locale="en" id="components" descriptions={pageDescriptions('en')} />);
    expect(container.textContent).toContain(button);
  });
});
