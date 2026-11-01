// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { flatLinks, SITE_GROUPS } from './siteGroups';
import { GroupIndex } from './GroupIndex';
import { pageDescriptions } from '../lib/pageDescriptions';

const components = SITE_GROUPS.find((group) => group.id === 'components');
const componentHrefs = flatLinks(components?.links ?? []).map(([href]) => href);

describe('GroupIndex', () => {
  afterEach(cleanup);

  it('lists every page in the group, and only the descriptions it was given', () => {
    const { container } = render(
      <GroupIndex locale="en" id="components" descriptions={new Map([['button', 'The button control.']])} />,
    );
    const hrefs = [...container.querySelectorAll('a')].map((link) => link.getAttribute('href'));
    expect(hrefs).toEqual(componentHrefs);
    expect(screen.getByRole('heading', { level: 1, name: 'Components' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Button' }).closest('li')?.textContent).toContain('The button control.');
    expect(screen.getByRole('link', { name: 'Alert' }).closest('li')?.querySelector('p')).toBeNull();
    expect(hrefs).toContain('/field/chip-input');
  });

  it('uses the Korean catalog title and Korean URLs', () => {
    const { container } = render(<GroupIndex locale="ko" id="utilities" descriptions={new Map()} />);
    expect(screen.getByRole('heading', { level: 1, name: '유틸리티' })).toBeTruthy();
    const hrefs = [...container.querySelectorAll('a')].map((link) => link.getAttribute('href'));
    expect(hrefs.every((href) => href?.startsWith('/ko/utilities/'))).toBe(true);
    expect(hrefs).toHaveLength(flatLinks(SITE_GROUPS.find((group) => group.id === 'utilities')?.links ?? []).length);
  });

  it('shows a page summary when the page has one, and none for the catalog slug', () => {
    const button = pageDescriptions('en').get('button') ?? '';
    expect(button.startsWith('Button.Root is the control.')).toBe(true);
    expect(pageDescriptions('en').has('components')).toBe(false);
    expect(pageDescriptions('ko').get('button')).toBeTruthy();
    const { container } = render(<GroupIndex locale="en" id="components" descriptions={pageDescriptions('en')} />);
    expect(container.textContent).toContain(button);
  });
});
