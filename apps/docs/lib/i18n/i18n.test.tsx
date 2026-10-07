// @vitest-environment jsdom
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HomeContent } from '../../components/HomeContent';
import { LanguageSwitcher } from '../../components/LanguageSwitcher';
import { LocalizedLink } from '../../components/LocalizedLink';
import { SiteNav } from '../../components/SiteNav';
import { SITE_GROUPS } from '../../components/siteGroups';
import { UntranslatedPage } from '../../components/UntranslatedPage';
import { LOCALES } from './config';
import { DICTIONARIES } from './dictionaries';
import { ENGLISH_PAGES } from './englishPages';
import { PAGE_FILES, untranslatedSlugs } from './pages';

const path = vi.hoisted(() => ({ current: '/ko/button' }));
vi.mock('next/navigation', () => ({ usePathname: () => path.current }));

const APP = join(process.cwd(), 'app');

// Static page slugs under `dir`; dynamic segments are not pages of their own.
function slugs(dir: string, prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (!entry.isDirectory() || /^[_[@(]/.test(entry.name)) return [];
    const slug = `${prefix}${entry.name}`;
    const own = PAGE_FILES.some((file) => existsSync(join(dir, entry.name, file))) ? [slug] : [];
    return [...own, ...slugs(join(dir, entry.name), `${slug}/`)];
  });
}

describe('docs locales', () => {
  afterEach(cleanup);

  it('can fall back to every English page', () => {
    expect(Object.keys(ENGLISH_PAGES).sort()).toEqual(slugs(join(APP, '(en)')).sort());
  });

  it('translates only pages that exist in English', () => {
    const english = new Set(Object.keys(ENGLISH_PAGES));
    for (const locale of LOCALES.filter((item) => item !== 'en')) {
      for (const slug of slugs(join(APP, locale))) expect(english.has(slug), `${locale}/${slug}`).toBe(true);
    }
  });

  it('falls back only where there is no translation', () => {
    expect(untranslatedSlugs('ko').length + slugs(join(APP, 'ko')).length).toBe(Object.keys(ENGLISH_PAGES).length);
    // A locale with one translated page falls back for the rest.
    const app = mkdtempSync(join(tmpdir(), 'todae-i18n-'));
    try {
      mkdirSync(join(app, 'ko', 'guides', 'build-on-todae'), { recursive: true });
      writeFileSync(join(app, 'ko', 'guides', 'build-on-todae', 'page.mdx'), '# Guide\n');
      const fallback = untranslatedSlugs('ko', app);
      expect(fallback).toContain('button');
      expect(fallback).not.toContain('guides/build-on-todae');
      expect(fallback).toHaveLength(Object.keys(ENGLISH_PAGES).length - 1);
    } finally {
      rmSync(app, { recursive: true, force: true });
    }
  });

  it('redirects old URLs in every locale', () => {
    const config = readFileSync(join(process.cwd(), 'next.config.mjs'), 'utf8');
    const prefixes = /LOCALE_PREFIXES = (\[[^\]]*\])/.exec(config)?.[1]?.replaceAll("'", '"');
    expect(JSON.parse(prefixes ?? '[]')).toEqual(LOCALES.filter((locale) => locale !== 'en').map((locale) => `/${locale}`));
  });

  it('refuses to guess when the app directory is wrong', () => {
    expect(() => untranslatedSlugs('ko', join(APP, 'missing'))).toThrow(/No ko pages/);
  });

  it('keeps component and pattern names in English in Korean link text', () => {
    // A recipe is named after the component or pattern it builds; that name stays as it is in English.
    const recipes = SITE_GROUPS.find((group) => group.id === 'recipes')?.links ?? [];
    for (const [href, label] of recipes) {
      const name = label.replace(/ with .*$/, '');
      expect(DICTIONARIES.ko.links[href] ?? label, href).toContain(name);
    }
  });

  it('names every section in Korean', () => {
    expect(SITE_GROUPS.filter((group) => !DICTIONARIES.ko.groups[group.id])).toEqual([]);
  });

  it('keeps the Korean sidebar in Korean URLs', () => {
    path.current = '/ko/guides/build-on-todae';
    render(<SiteNav locale="ko" />);
    const nav = screen.getByRole('navigation', { name: '사이트' });
    const hrefs = [...nav.querySelectorAll('a')].map((link) => link.getAttribute('href'));
    expect(hrefs).toHaveLength(SITE_GROUPS.reduce((count, group) => count + group.links.length, 0));
    expect(hrefs.every((href) => href?.startsWith('/ko/'))).toBe(true);
    expect(screen.getByRole('list', { name: '컴포넌트' })).toBeTruthy();
    const current = [...nav.querySelectorAll('[aria-current="page"]')];
    expect(current.map((link) => link.textContent)).toEqual(['Todae로 디자인 시스템 만들기']);
  });

  it('switches to the same page in each language', () => {
    path.current = '/ko/utilities/use-field';
    render(<LanguageSwitcher locale="ko" />);
    const nav = screen.getByRole('navigation', { name: '언어' });
    const links = [...nav.querySelectorAll('a')];
    expect(links.map((link) => [link.getAttribute('href'), link.getAttribute('lang'), link.textContent])).toEqual([
      ['/utilities/use-field', 'en', 'English'],
      ['/ko/utilities/use-field', 'ko', '한국어'],
    ]);
    expect(links.map((link) => link.getAttribute('aria-current'))).toEqual([null, 'true']);
  });

  it('keeps the query and hash when switching', () => {
    path.current = '/tokens';
    window.history.replaceState(null, '', '/tokens?x=1#contrast');
    render(<LanguageSwitcher locale="en" />);
    expect(screen.getByRole('link', { name: '한국어' }).getAttribute('href')).toBe('/ko/tokens?x=1#contrast');
    act(() => {
      window.history.replaceState(null, '', '/tokens#props');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('link', { name: '한국어' }).getAttribute('href')).toBe('/ko/tokens#props');
    window.history.replaceState(null, '', '/');
  });

  it('switches from the English home page to the Korean one', () => {
    path.current = '/';
    render(<LanguageSwitcher locale="en" />);
    expect(screen.getByRole('link', { name: '한국어' }).getAttribute('href')).toBe('/ko');
  });

  it('lists the Korean home page in Korean', () => {
    const { container } = render(<HomeContent locale="ko" />);
    for (const name of SITE_GROUPS.map((group) => DICTIONARIES.ko.groups[group.id] ?? '')) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeTruthy();
    }
    const hrefs = [...container.querySelectorAll('a')].map((link) => link.getAttribute('href') ?? '');
    const pages = new Set([...Object.keys(ENGLISH_PAGES)].map((slug) => `/ko/${slug}`));
    for (const href of hrefs) expect(pages.has(href), href).toBe(true);
  });

  it('keeps MDX links in the reader’s language', () => {
    path.current = '/ko/button';
    render(
      <>
        <LocalizedLink href="/tokens">Tokens</LocalizedLink>
        <LocalizedLink href="https://example.com">External</LocalizedLink>
      </>,
    );
    expect(screen.getByRole('link', { name: 'Tokens' }).getAttribute('href')).toBe('/ko/tokens');
    expect(screen.getByRole('link', { name: 'External' }).getAttribute('href')).toBe('https://example.com');
  });

  it('localizes every same-site link in a page or demo', () => {
    // MDX maps markdown links to LocalizedLink, but not a JSX <a>, so those must use LocalizedLink themselves.
    const files = [join(APP, '(en)'), join(APP, 'ko'), join(process.cwd(), 'components/demos')].flatMap((dir) =>
      readdirSync(dir, { recursive: true, encoding: 'utf8' })
        .filter((file) => /\.(mdx|tsx)$/.test(file) && !file.includes('.test.'))
        .map((file) => join(dir, file)),
    );
    expect(files.length).toBeGreaterThan(30);
    // <a> or next/link's <Link> with href="/x", href={'/x'} or href={`/x`}.
    const sameSite = /<(a|Link)\s[^>]*href=\{?["'`]\/(?!\/)/;
    expect(files.filter((file) => sameSite.test(readFileSync(file, 'utf8')))).toEqual([]);
  });

  it('marks an untranslated page as English and links the guide', () => {
    const { container } = render(
      <UntranslatedPage locale="ko">
        <h1>Button</h1>
      </UntranslatedPage>,
    );
    expect(screen.getByRole('note').textContent).toContain(DICTIONARIES.ko.untranslated);
    expect(screen.getByRole('link', { name: DICTIONARIES.ko.contribute }).getAttribute('href')).toMatch(/TRANSLATING\.md$/);
    expect(container.querySelector('[lang="en"] h1')?.textContent).toBe('Button');
  });
});
