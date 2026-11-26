import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { flatLinks, SITE_GROUPS } from '../components/siteGroups';
import { sections } from './i18n/sections';

// ARCHITECTURE.md's page shape: a component or hook page ends with these sections, in this order.
// The docs MCP server reads "When to use". A recipe composes parts, so it has no Props of its own.
// The Korean twins keep the same sections, which i18n.test.tsx checks.
const REQUIRED: Record<string, readonly string[]> = {
  components: ['Accessible composition', 'When to use', 'Props'],
  utilities: ['Accessible composition', 'When to use', 'Props'],
  recipes: ['Accessible composition', 'When to use'],
};

// Pages written before the rule, with the sections they still lack. Write the section, then remove the entry here.
const MISSING: Record<string, readonly string[]> = {
  mention: ['Accessible composition'],
  'utilities/compose-refs': ['Accessible composition'],
  'utilities/use-controlled-state': ['Accessible composition'],
  'utilities/use-sheet-presentation': ['Accessible composition'],
};

const pages = SITE_GROUPS.flatMap((group) =>
  group.id in REQUIRED ? flatLinks(group.links).map(([href]) => ({ slug: href.slice(1), required: REQUIRED[group.id]! })) : [],
);

const headings = (slug: string) =>
  sections(readFileSync(join(process.cwd(), 'app/(en)', slug, 'page.mdx'), 'utf8'))
    .filter((section) => section.level === 2)
    .map((section) => section.heading.replace(/^##\s+/, ''));

describe('docs page sections', () => {
  it('finds the component, utility and recipe pages', () => {
    expect(pages.length).toBeGreaterThan(100);
  });

  it('gives every component, utility and recipe page its required sections, in order', () => {
    const problems = pages.flatMap(({ slug, required }) => {
      const found = headings(slug);
      const wanted = required.filter((heading) => !MISSING[slug]?.includes(heading));
      const missing = wanted.filter((heading) => !found.includes(heading));
      if (missing.length) return [`app/(en)/${slug}/page.mdx: add ${missing.map((heading) => `## ${heading}`).join(', ')}`];
      const order = found.filter((heading) => wanted.includes(heading));
      if (order.join() !== wanted.join()) return [`app/(en)/${slug}/page.mdx: put ${wanted.map((heading) => `## ${heading}`).join(', then ')} in that order`];
      return [];
    });
    expect(
      problems,
      'Each page needs these sections, as ARCHITECTURE.md "Page shape" says. Add them to the English page and its Korean twin in app/ko, then run pnpm --filter docs i18n:stamp ko <slug>',
    ).toEqual([]);
  });

  it('lists in MISSING only sections that are still missing', () => {
    const written = Object.entries(MISSING).flatMap(([slug, list]) =>
      list.filter((heading) => headings(slug).includes(heading)).map((heading) => `${slug}: ${heading}`),
    );
    expect(written, 'These sections now exist, so remove them from MISSING in apps/docs/lib/pageSections.test.ts').toEqual([]);
  });
});
